import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '@butaca/auth';
import { AppError, errorBody } from './errors.js';
import { getSummary } from './services/summary.service.js';

const app = express();

const summaryQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional()
}).strict();

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

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'dashboard-service',
    timestamp: new Date().toISOString()
  });
});

app.use(requireAuth);

app.get('/summary', async (req, res) => {
  const parsed = summaryQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json(errorBody(
      'VALIDATION_ERROR',
      'Los parámetros del resumen no son válidos',
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    ));
  }

  const { from, to } = parsed.data;

  if (from && to && new Date(from) > new Date(to)) {
    return res.status(400).json(errorBody(
      'VALIDATION_ERROR',
      'La fecha inicial no puede ser posterior a la fecha final'
    ));
  }

  try {
    const summary = await getSummary({
      from,
      to,
      authorization: req.headers.authorization
    });

    return res.status(200).json({
      status: 'ok',
      data: summary
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(
        errorBody(error.code, error.message, error.details)
      );
    }

    console.error(error);
    return res.status(500).json(
      errorBody('INTERNAL_ERROR', 'Ocurrió un error interno')
    );
  }
});

app.use((req, res) => {
  res.status(404).json(errorBody(
    'NOT_FOUND',
    `La ruta ${req.method} ${req.originalUrl} no existe en dashboard-service`
  ));
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json(errorBody(
      'VALIDATION_ERROR',
      'El cuerpo de la solicitud no contiene JSON válido'
    ));
  }

  console.error(error);
  return res.status(500).json(errorBody('INTERNAL_ERROR', 'Ocurrió un error interno'));
});

export default app;
