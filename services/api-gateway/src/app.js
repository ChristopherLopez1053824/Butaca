import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requireAuth } from '@butaca/auth';
import { config } from './config.js';
import { errorBody, proxyError } from './errors.js';

const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(cors({
  origin: config.WEB_URL,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      errorBody('RATE_LIMIT_EXCEEDED', 'Se excedió el límite de solicitudes')
    );
  }
}));

app.use((req, res, next) => {
  for (const header of Object.keys(req.headers)) {
    if (header.startsWith('x-user-') || header.startsWith('x-internal-')) {
      delete req.headers[header];
    }
  }

  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

const services = [
  ['users', config.USER_SERVICE_URL],
  ['emotions', config.EMOTION_SERVICE_URL],
  ['movies', config.MOVIE_SERVICE_URL],
  ['favorites', config.FAVORITES_SERVICE_URL],
  ['dashboard', config.DASHBOARD_SERVICE_URL],
  ['memes', config.MEME_SERVICE_URL]
];

app.use('/api', requireAuth);

app.use('/api', (req, res, next) => {
  if (req.auth.role !== 'authenticated') {
    return res.status(403).json(
      errorBody('FORBIDDEN', 'El token no tiene permiso para usar esta API')
    );
  }

  return next();
});

for (const [route, target] of services) {
  app.use(
    `/api/${route}`,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      proxyTimeout: config.PROXY_TIMEOUT_MS,
      on: {
        proxyReq: (proxyReq, req) => {
          proxyReq.once('timeout', () => {
            req.proxyTimedOut = true;
          });
        },
        error: (error, req, res) => {
          console.error(`[proxy:${route}] ${error.code || error.message}`);

          if (res.headersSent) {
            res.destroy();
            return;
          }

          const { statusCode, body } = proxyError(req.proxyTimedOut, route);
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        }
      }
    })
  );
}

app.use((req, res) => {
  res.status(404).json(
    errorBody('NOT_FOUND', `La ruta ${req.method} ${req.originalUrl} no existe en el API Gateway`)
  );
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json(
    errorBody('INTERNAL_ERROR', 'Ocurrió un error inesperado')
  );
});

export default app;