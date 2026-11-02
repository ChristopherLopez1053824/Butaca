import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requireAuth } from '@butaca/auth';

const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(cors({
  origin: process.env.WEB_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false
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
  ['users', 'USER_SERVICE_URL', 'http://localhost:3001'],
  ['emotions', 'EMOTION_SERVICE_URL', 'http://localhost:3002'],
  ['movies', 'MOVIE_SERVICE_URL', 'http://localhost:3003'],
  ['favorites', 'FAVORITES_SERVICE_URL', 'http://localhost:3004'],
  ['dashboard', 'DASHBOARD_SERVICE_URL', 'http://localhost:3005'],
  ['memes', 'MEME_SERVICE_URL', 'http://localhost:3006']
];

app.use('/api', requireAuth);

for (const [route, env, defaultUrl] of services) {
  app.use(
    `/api/${route}`,
    createProxyMiddleware({
      target: process.env[env] || defaultUrl,
      changeOrigin: true,
      on: {
        error: (error, req, res) => {
          if (!res.headersSent) {
            res.writeHead(502, {
              'Content-Type': 'application/json'
            });
          }

          res.end(JSON.stringify({
            status: 'error',
            message: `El servicio ${route} no está disponible`,
            details: process.env.NODE_ENV === 'development'
              ? error.message
              : undefined
          }));
        }
      }
    })
  );
}

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `La ruta ${req.method} ${req.originalUrl} no existe en el API Gateway`
  });
});

export default app;
