import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '@butaca/auth';
import { withUserContext } from '@butaca/database';

const app = express();
const favoriteSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['MOVIE', 'TV']),
  title: z.string().trim().min(1).max(300),
  posterPath: z.string().nullable().optional(),
  releaseDate: z.string()
    .refine((value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime())
        && date.toISOString().slice(0, 10) === value;
    }, 'La fecha debe tener el formato YYYY-MM-DD')
    .nullable()
    .optional(),
  voteAverage: z.number().min(0).max(10).nullable().optional()
}).strict();
const paginationSchema = z.object({
  page: z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().safe().max(Math.floor(Number.MAX_SAFE_INTEGER / 100)))
    .optional(),
  limit: z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional()
}).strict();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validationError(res, error, message) {
  return res.status(400).json({
    status: 'error',
    code: 'VALIDATION_ERROR',
    message,
    details: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }))
  });
}

function serializeFavorite(favorite) {
  const { userId, ...publicFavorite } = favorite;

  return {
    ...publicFavorite,
    releaseDate: publicFavorite.releaseDate
      ? publicFavorite.releaseDate.toISOString().slice(0, 10)
      : null
  };
}

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
  handler: (req, res) => res.status(429).json({
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Se excedió el límite de solicitudes'
  })
}));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'favorites-service',
    timestamp: new Date().toISOString()
  });
});

app.use(requireAuth);

app.post('/', async (req, res) => {
  const parsed = favoriteSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error, 'Los datos del favorito no son válidos');
  }

  const { releaseDate, ...fields } = parsed.data;
  const favorite = await withUserContext(req.auth.userId, (tx) =>
    tx.favorite.create({
      data: {
        ...fields,
        releaseDate: releaseDate
          ? new Date(`${releaseDate}T00:00:00.000Z`)
          : null,
        posterPath: fields.posterPath ?? null,
        voteAverage: fields.voteAverage ?? null,
        userId: req.auth.userId
      }
    })
  );

  return res.status(201).json({
    status: 'ok',
    data: serializeFavorite(favorite)
  });
});

app.get('/', async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);

  if (!parsed.success) {
    return validationError(res, parsed.error, 'Los parámetros de paginación no son válidos');
  }

  const page = parsed.data.page ?? 1;
  const limit = parsed.data.limit ?? 20;
  const [favorites, total] = await withUserContext(req.auth.userId, (tx) =>
    Promise.all([
      tx.favorite.findMany({
        where: { userId: req.auth.userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit
      }),
      tx.favorite.count({
        where: { userId: req.auth.userId }
      })
    ])
  );

  return res.status(200).json({
    status: 'ok',
    data: favorites.map(serializeFavorite),
    pagination: { page, limit, total }
  });
});

app.delete('/:id', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'El id del favorito debe ser un UUID válido'
    });
  }

  const result = await withUserContext(req.auth.userId, (tx) =>
    tx.favorite.deleteMany({
      where: {
        id: req.params.id,
        userId: req.auth.userId
      }
    })
  );

  if (result.count === 0) {
    return res.status(404).json({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'No se encontró el favorito'
    });
  }

  return res.status(204).end();
});

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `La ruta ${req.method} ${req.originalUrl} no existe en favorites-service`
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'El cuerpo de la solicitud no contiene JSON válido'
    });
  }

  if (error?.code === 'P2002') {
    return res.status(409).json({
      status: 'error',
      code: 'CONFLICT',
      message: 'Este favorito ya existe'
    });
  }

  console.error(error);
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'Ocurrió un error interno'
  });
});

export default app;
