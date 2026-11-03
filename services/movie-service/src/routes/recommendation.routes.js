import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

export default router;
