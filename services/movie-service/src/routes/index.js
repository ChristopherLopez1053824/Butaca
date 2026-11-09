import { Router } from 'express';
import detailsRoutes from './details.routes.js';
import recommendationRoutes from './recommendation.routes.js';

const router = Router();

router.use('/recommendations', recommendationRoutes);
router.use('/details', detailsRoutes);

export default router;
