import { Router } from 'express';
import {
  generateRecommendations,
  listRecommendations
} from '../controllers/recommendation.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  generateRecommendationsSchema,
  listRecommendationsQuerySchema
} from '../validators/recommendation.validator.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  validate({ query: listRecommendationsQuerySchema }),
  listRecommendations
);

router.post(
  '/',
  validate({ body: generateRecommendationsSchema }),
  generateRecommendations
);

export default router;
