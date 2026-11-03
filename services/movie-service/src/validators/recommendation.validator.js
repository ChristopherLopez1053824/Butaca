import { z } from 'zod';

export const generateRecommendationsSchema = z.object({
  emotionRecordId: z.string().uuid('emotionRecordId debe ser un UUID válido'),
  cursor: z.string().min(1, 'cursor no puede estar vacío').optional()
});

export const listRecommendationsQuerySchema = z.object({
  emotionRecordId: z.string().uuid('emotionRecordId debe ser un UUID válido')
});
