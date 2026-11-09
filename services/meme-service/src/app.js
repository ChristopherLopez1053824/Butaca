import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '@butaca/auth';
import { withUserContext } from '@butaca/database';
import { env } from './config/env.js';
import { AppError, errorBody } from './errors.js';
import { getVerseForEmotion } from './services/verse.service.js';

const app = express();

app.disable('x-powered-by');

// Las peticiones llegan por el API Gateway, que envía la IP real del usuario
// en X-Forwarded-For. Confiar en un salto permite aplicar el rate limit por usuario.
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(
    errorBody('RATE_LIMIT_EXCEEDED', 'Se excedió el límite de solicitudes')
  )
}));

const emotionQuerySchema = z.object({
  emotion: z.string().min(1, 'emotion es obligatoria'),
  // Si el cliente pide una traducción explícita, debe coincidir con la que
  // el servicio tiene configurada: no fingimos tener otra disponible.
  translation: z.string().min(1).optional()
}).strict();

const historyBodySchema = z.object({
  provider: z.string().min(1, 'El proveedor es obligatorio').max(100),
  externalId: z.string().min(1, 'La referencia es obligatoria').max(255),
  title: z.string().max(300).nullable().optional(),
  emotionRecordId: z.string().uuid('El ID de emoción debe ser un UUID válido').optional()
}).strict();

const historyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional()
}).strict();

function serializeHistoryEntry(entry) {
  return {
    id: entry.id,
    emotionRecordId: entry.emotionRecordId,
    provider: entry.provider,
    externalId: entry.externalId,
    title: entry.title,
    createdAt: entry.createdAt.toISOString()
  };
}

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'meme-service',
    timestamp: new Date().toISOString()
  });
});

app.use(requireAuth);

// GET /api/memes?emotion=HAPPY&translation=RVR1960
// Devuelve un versículo relacionado con la emoción, obtenido en vivo del
// proveedor configurado. No guarda nada: eso lo hace POST /history aparte,
// a propósito de decisión del cliente, para no duplicar registros por cada
// consulta.
app.get('/', async (req, res, next) => {
  const parsed = emotionQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json(errorBody(
      'VALIDATION_ERROR',
      'Los parámetros de la consulta no son válidos',
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    ));
  }

  const { emotion, translation } = parsed.data;

  if (translation && translation.toUpperCase() !== env.BIBLE_API_TRANSLATION.toUpperCase()) {
    return res.status(400).json(errorBody(
      'VALIDATION_ERROR',
      `La traducción "${translation}" no está disponible; este servicio solo tiene configurada "${env.BIBLE_API_TRANSLATION}"`
    ));
  }

  try {
    const verse = await getVerseForEmotion(emotion);
    return res.status(200).json({ status: 'ok', data: verse });
  } catch (error) {
    return next(error);
  }
});

app.post('/history', async (req, res, next) => {
  try {
    const parsed = historyBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json(errorBody(
        'VALIDATION_ERROR',
        'Los datos del historial no son válidos',
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      ));
    }

    const { provider, externalId, title, emotionRecordId } = parsed.data;

    const entry = await withUserContext(req.auth.userId, (tx) =>
      tx.memeHistory.create({
        data: {
          userId: req.auth.userId,
          emotionRecordId: emotionRecordId ?? null,
          provider,
          externalId,
          title: title ?? null
        }
      })
    );

    return res.status(201).json({ status: 'ok', data: serializeHistoryEntry(entry) });
  } catch (error) {
    return next(error);
  }
});

app.get('/history', async (req, res, next) => {
  try {
    const parsed = historyQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json(errorBody(
        'VALIDATION_ERROR',
        'Los parámetros de paginación no son válidos',
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      ));
    }

    const { page, limit, from, to } = parsed.data;
    const skip = (page - 1) * limit;

    const where = { userId: req.auth.userId };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const { total, entries } = await withUserContext(req.auth.userId, async (tx) => {
      const [total, entries] = await Promise.all([
        tx.memeHistory.count({ where }),
        tx.memeHistory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        })
      ]);

      return { total, entries };
    });

    return res.status(200).json({
      status: 'ok',
      data: entries.map(serializeHistoryEntry),
      pagination: { page, limit, total }
    });
  } catch (error) {
    return next(error);
  }
});

app.use((req, res) => {
  res.status(404).json(errorBody(
    'NOT_FOUND',
    `La ruta ${req.method} ${req.originalUrl} no existe en meme-service`
  ));
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json(errorBody(error.code, error.message, error.details));
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json(errorBody('VALIDATION_ERROR', 'El cuerpo de la solicitud no contiene JSON válido'));
  }

  if (error?.code === 'P2002') {
    return res.status(409).json(errorBody('CONFLICT', 'Este registro ya existe'));
  }

  console.error(error);
  return res.status(500).json(errorBody('INTERNAL_ERROR', 'Ocurrió un error interno'));
});

export default app;
