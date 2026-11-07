import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { requireAuth } from '@butaca/auth';
import { config } from './config.js';
import { errorBody, proxyError } from './errors.js';
import { toCommonFormat } from './response-format.js';

const app = express();
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

app.disable('x-powered-by');

// Número de proxies delante del Gateway (0 en local). Define cómo se obtiene req.ip.
app.set('trust proxy', config.TRUST_PROXY);

// Identifica cada petición para seguirla en los logs del Gateway y de los servicios.
app.use((req, res, next) => {
  const incomingId = req.get('x-request-id');
  req.id = incomingId && REQUEST_ID_PATTERN.test(incomingId) ? incomingId : randomUUID();
  res.setHeader('X-Request-Id', req.id);

  if (config.LOG_REQUESTS) {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const path = req.originalUrl.split('?')[0];
      console.log(`[gateway] ${req.id} ${req.method} ${path} ${res.statusCode} ${ms.toFixed(0)}ms`);
    });
  }

  next();
});

app.use(helmet());

app.use(cors({
  origin: config.WEB_URL,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id']
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

// keepPrefix: el servicio declara sus rutas con /api/<servicio>.
// adaptFormat: el servicio usa { success } y se convierte al formato común.
const services = [
  ['users', config.USER_SERVICE_URL],
  ['emotions', config.EMOTION_SERVICE_URL, { keepPrefix: true, adaptFormat: true }],
  ['movies', config.MOVIE_SERVICE_URL],
  ['favorites', config.FAVORITES_SERVICE_URL],
  ['dashboard', config.DASHBOARD_SERVICE_URL],
  ['memes', config.MEME_SERVICE_URL]
];

const adaptResponse = responseInterceptor(async (buffer, proxyRes) => {
  const contentType = proxyRes.headers['content-type'] || '';

  if (!contentType.includes('application/json') || buffer.length === 0) {
    return buffer;
  }

  try {
    return JSON.stringify(toCommonFormat(JSON.parse(buffer.toString('utf8'))));
  } catch {
    return buffer;
  }
});

// Conserva /api/<servicio> en la ruta, excepto /health, que siempre es pública.
function keepPrefix(path, req) {
  return path.split('?')[0] === '/health' ? path : req.originalUrl;
}

app.use('/api', requireAuth);

app.use('/api', (req, res, next) => {
  if (req.auth.role !== 'authenticated') {
    return res.status(403).json(
      errorBody('FORBIDDEN', 'El token no tiene permiso para usar esta API')
    );
  }

  return next();
});

for (const [route, target, options = {}] of services) {
  const proxyOptions = {
    target,
    changeOrigin: true,
    proxyTimeout: config.PROXY_TIMEOUT_MS,
    on: {
      proxyReq: (proxyReq, req) => {
        // Reemplaza cualquier X-Forwarded-For del cliente por la IP que calculó el Gateway.
        // Así cada servicio aplica su rate limit por usuario y no por la IP del Gateway.
        proxyReq.setHeader('x-forwarded-for', req.ip);
        proxyReq.setHeader('x-request-id', req.id);

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
  };

  if (options.keepPrefix) {
    proxyOptions.pathRewrite = keepPrefix;
  }

  if (options.adaptFormat) {
    proxyOptions.selfHandleResponse = true;
    proxyOptions.on.proxyRes = adaptResponse;
  }

  app.use(`/api/${route}`, createProxyMiddleware(proxyOptions));
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