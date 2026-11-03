import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFoundHandler } from './middlewares/not-found.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'movie-service',
    timestamp: new Date().toISOString()
  });
});

app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
