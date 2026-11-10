
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { emotionSchema } from './validations/emotion.schema.js';
import { requireAuth } from '@butaca/auth';
import { withUserContext } from '@butaca/database';

// ==========================================
// CONFIGURACIÓN DE EXPRESS
// ==========================================

const app = express();

app.disable('x-powered-by');

// Las peticiones llegan por el API Gateway, que envía la IP real del usuario
// en X-Forwarded-For. Confiar en un salto permite aplicar el rate limit por usuario.
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// ==========================================
// HEALTH CHECK
// ==========================================
// Registrada antes del rate limiter para que el health check de Render
// nunca comparta cupo con el tráfico de la API.

app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'emotion-service',
    timestamp: new Date().toISOString()
  });
});

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

// Respuesta de error según el contrato acordado
function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message
    }
  });
}

// Validación de parámetros del historial
const historySchema = z.object({
  page: z.string().regex(/^[1-9]\d*$/).optional(),
  limit: z.string().regex(/^[1-9]\d*$/).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional()
}).strict();

// ==========================================
// AUTENTICACIÓN
// ==========================================

// Proteger todas las rutas de emociones
app.use('/api/emotions', requireAuth, (req, res, next) => {
  if (req.auth.role !== 'authenticated') {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'No tienes permisos para acceder a este recurso.'
    );
  }

  next();
});

// ==========================================
// POST /api/emotions
// REGISTRAR UNA EMOCIÓN
// ==========================================

app.post('/api/emotions', async (req, res) => {
  // Validar los datos recibidos
  const result = emotionSchema.safeParse(req.body);

  if (!result.success) {
    return sendError(
      res,
      400,
      'INVALID_PARAMETERS',
      'Los datos de la emoción son inválidos.'
    );
  }

  try {
    // Obtener el usuario del JWT verificado
    const userId = req.auth.userId;

    // Registrar la emoción en Supabase con Prisma
    const emotionRecord = await withUserContext(
      userId,
      async (tx) => {
        return tx.emotionRecord.create({
          data: {
            userId,
            emotion: result.data.emotion,
            source: result.data.source,
            confidence: result.data.confidence ?? null
          }
        });
      }
    );

    return res.status(201).json({
      success: true,
      data: emotionRecord
    });

  } catch (error) {
    console.error('Error al registrar emoción:', error);

    return sendError(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'No se pudo registrar la emoción.'
    );
  }
});

// ==========================================
// GET /api/emotions
// CONSULTAR HISTORIAL DE EMOCIONES
// ==========================================

app.get('/api/emotions', async (req, res) => {
  // Validar los parámetros recibidos
  const result = historySchema.safeParse(req.query);

  if (!result.success) {
    return sendError(
      res,
      400,
      'INVALID_PARAMETERS',
      'Los parámetros del historial son inválidos.'
    );
  }

  // Paginación predeterminada
  const page = Number(result.data.page ?? 1);
  const limit = Number(result.data.limit ?? 10);

  // Validar rangos de paginación
  if (
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    return sendError(
      res,
      400,
      'INVALID_PARAMETERS',
      'La página debe ser positiva y el límite debe estar entre 1 y 100.'
    );
  }

  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    return sendError(
      res,
      400,
      'INVALID_PARAMETERS',
      'El número de página es demasiado grande.'
    );
  }

  // Obtener fechas opcionales
  const from = result.data.from
    ? new Date(result.data.from)
    : null;

  const to = result.data.to
    ? new Date(result.data.to)
    : null;

  // Validar rango de fechas
  if (from && to && from > to) {
    return sendError(
      res,
      400,
      'INVALID_DATE_RANGE',
      'La fecha inicial no puede ser posterior a la fecha final.'
    );
  }

  try {
    const userId = req.auth.userId;

    // Filtros de consulta
    const where = {
      userId
    };

    if (from || to) {
      where.createdAt = {};

      if (from) {
        where.createdAt.gte = from;
      }

      if (to) {
        where.createdAt.lte = to;
      }
    }

    // Consultar historial real en Supabase
    const { emotions, total } = await withUserContext(
      userId,
      async (tx) => {
        const total = await tx.emotionRecord.count({
          where
        });

        const emotions = await tx.emotionRecord.findMany({
          where,
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' }
          ],
          skip,
          take: limit
        });

        return { emotions, total };
      }
    );

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: emotions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0
      }
    });

  } catch (error) {
    console.error('Error al consultar historial:', error);

    return sendError(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'No se pudo consultar el historial de emociones.'
    );
  }
});

// ==========================================
// GET /api/emotions/:id
// CONSULTAR UNA EMOCIÓN ESPECÍFICA
// ==========================================

app.get('/api/emotions/:id', async (req, res) => {
  // Validar que el ID sea UUID
  const result = z.uuid().safeParse(req.params.id);

  if (!result.success) {
    return sendError(
      res,
      400,
      'INVALID_PARAMETERS',
      'El ID de la emoción no es válido.'
    );
  }

  try {
    const userId = req.auth.userId;

    // Buscar registro del usuario autenticado
    const emotionRecord = await withUserContext(
      userId,
      async (tx) => {
        return tx.emotionRecord.findFirst({
          where: {
            id: result.data,
            userId
          }
        });
      }
    );

    // No existe o pertenece a otro usuario
    if (!emotionRecord) {
      return sendError(
        res,
        404,
        'EMOTION_NOT_FOUND',
        'No se encontró la emoción solicitada.'
      );
    }

    return res.status(200).json({
      success: true,
      data: emotionRecord
    });

  } catch (error) {
    console.error('Error al consultar emoción:', error);

    return sendError(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'No se pudo consultar la emoción.'
    );
  }
});

// ==========================================
// MANEJO DE ERRORES GENERALES
// ==========================================

// Rutas inexistentes
app.use((req, res) => {
  return sendError(
    res,
    404,
    'NOT_FOUND',
    'La ruta solicitada no existe.'
  );
});

// Errores de Express, incluyendo JSON inválido
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return sendError(
      res,
      400,
      'INVALID_PARAMETERS',
      'El cuerpo de la solicitud no contiene JSON válido.'
    );
  }

  if (err.type === 'entity.too.large') {
    return sendError(
      res,
      413,
      'INVALID_PARAMETERS',
      'El cuerpo de la solicitud supera el tamaño permitido.'
    );
  }

  console.error('Error inesperado:', err);

  return sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    'Ocurrió un error inesperado.'
  );
});

export default app;
