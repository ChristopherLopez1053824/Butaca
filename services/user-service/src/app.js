import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '@butaca/auth';
import { withUserContext } from '@butaca/database';

const app = express();
const profilePatchSchema = z.object({
  displayName: z.string().trim().max(120).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional()
}).strict().refine((profile) => Object.keys(profile).length > 0, {
  message: 'Debes proporcionar al menos un campo para actualizar'
});

app.disable('x-powered-by');
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
    service: 'user-service',
    timestamp: new Date().toISOString()
  });
});

app.use(requireAuth);

app.get('/me', async (req, res) => {
  const profile = await withUserContext(req.auth.userId, (tx) =>
    tx.profile.findUnique({
      where: { id: req.auth.userId }
    })
  );

  if (!profile) {
    return res.status(404).json({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'No se encontró el perfil del usuario'
    });
  }

  return res.status(200).json({ status: 'ok', data: profile });
});

app.patch('/me', async (req, res) => {
  const parsed = profilePatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Los datos del perfil no son válidos',
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
  }

  const profile = await withUserContext(req.auth.userId, (tx) =>
    tx.profile.update({
      where: { id: req.auth.userId },
      data: parsed.data
    })
  );

  return res.status(200).json({ status: 'ok', data: profile });
});

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `La ruta ${req.method} ${req.originalUrl} no existe en user-service`
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

  if (error?.code === 'P2025') {
    return res.status(404).json({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'No se encontró el perfil del usuario'
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
