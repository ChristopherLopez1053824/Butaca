import { Router } from 'express';
import recommendationRoutes from './recommendation.routes.js';

const router = Router();

router.use('/recommendations', recommendationRoutes);

export default router;
