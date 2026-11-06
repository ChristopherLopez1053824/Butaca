import { Router } from 'express';
import { getDetails } from '../controllers/details.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  detailsParamsSchema,
  detailsQuerySchema
} from '../validators/details.validator.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/:tmdbId',
  validate({
    params: detailsParamsSchema,
    query: detailsQuerySchema
  }),
  getDetails
);

export default router;
