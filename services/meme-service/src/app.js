import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { requireAuth } from '@butaca/auth';
import { withUserContext } from '@butaca/database';

const app = express();

<<<<<<< HEAD
app.disable('x-powered-by');

// Las peticiones llegan por el API Gateway, que envía la IP real del usuario
// en X-Forwarded-For. Confiar en un salto permite aplicar el rate limit por usuario.
app.set('trust proxy', 1);
=======
>>>>>>> 599955b (feat(meme-service): implementar catalogo, historial con RLS y tests de integracion)
app.use(helmet());
app.use(cors());
app.use(express.json());

const MEMES_POR_EMOCION = {
  HAPPY: [
    { provider: 'internal', imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba' },
    { provider: 'internal', imageUrl: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1' }
  ],
  SAD: [
    { provider: 'internal', imageUrl: 'https://images.unsplash.com/photo-1534361960057-19889db9621e' },
    { provider: 'internal', imageUrl: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131' }
  ],
  SURPRISED: [
    { provider: 'internal', imageUrl: 'https://images.unsplash.com/photo-1561948955-570b270e7c36' }
  ],
  NEUTRAL: [
    { provider: 'internal', imageUrl: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5' }
  ]
};

const schemaNuevoMeme = z.object({
  provider: z.string().min(1, 'El proveedor es obligatorio'),
  imageUrl: z.string().url('La URL de la imagen debe ser valida'),
  emotionRecordId: z.string().uuid('El ID de emocion debe ser UUID valido').optional()
});

const schemaFiltrosHistorial = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'meme-service',
    timestamp: new Date().toISOString()
  });
});

const routerMemes = express.Router();
routerMemes.use(requireAuth);

routerMemes.get('/', (req, res) => {
  const emocion = (req.query.emotion || 'NEUTRAL').toString().toUpperCase();
  const lista = MEMES_POR_EMOCION[emocion] || MEMES_POR_EMOCION.NEUTRAL;

  return res.status(200).json({
    status: 'ok',
    data: lista
  });
});

routerMemes.post('/history', async (req, res, next) => {
  try {
    const validacion = schemaNuevoMeme.safeParse(req.body);
    if (!validacion.success) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Datos de meme invalidos',
        details: validacion.error.errors
      });
    }

    const { provider, imageUrl, emotionRecordId } = validacion.data;

    const nuevoRegistro = await withUserContext(req.auth.userId, async (tx) => {
      return await tx.memeHistory.create({
        data: {
          userId: req.auth.userId,
          emotionRecordId: emotionRecordId || null,
          provider,
          imageUrl
        }
      });
    });

    return res.status(201).json({
      status: 'ok',
      data: {
        id: nuevoRegistro.id,
        userId: nuevoRegistro.userId,
        emotionRecordId: nuevoRegistro.emotionRecordId,
        provider: nuevoRegistro.provider,
        imageUrl: nuevoRegistro.imageUrl,
        createdAt: nuevoRegistro.createdAt.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

routerMemes.get('/history', async (req, res, next) => {
  try {
    const validacion = schemaFiltrosHistorial.safeParse(req.query);
    if (!validacion.success) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Filtros de consulta invalidos',
        details: validacion.error.errors
      });
    }

    const { page, limit, from, to } = validacion.data;
    const skip = (page - 1) * limit;

    const condicion = { userId: req.auth.userId };
    if (from || to) {
      condicion.createdAt = {};
      if (from) condicion.createdAt.gte = new Date(from);
      if (to) condicion.createdAt.lte = new Date(to);
    }

    const resultado = await withUserContext(req.auth.userId, async (tx) => {
      const [total, registros] = await Promise.all([
        tx.memeHistory.count({ where: condicion }),
        tx.memeHistory.findMany({
          where: condicion,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        })
      ]);

      return { total, registros };
    });

    const items = resultado.registros.map((r) => ({
      id: r.id,
      userId: r.userId,
      emotionRecordId: r.emotionRecordId,
      provider: r.provider,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt.toISOString()
    }));

    return res.status(200).json({
      status: 'ok',
      data: items,
      pagination: {
        page,
        limit,
        total: resultado.total
      }
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/memes', routerMemes);
app.use('/', routerMemes);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Ruta ${req.originalUrl} no encontrada`
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  res.status(statusCode).json({
    status: 'error',
    code: errorCode,
    message: err.message || 'Error interno del servidor'
  });
});

export default app;