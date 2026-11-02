import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

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
    service: 'dashboard-service',
    timestamp: new Date().toISOString()
  });
});

export default app;
