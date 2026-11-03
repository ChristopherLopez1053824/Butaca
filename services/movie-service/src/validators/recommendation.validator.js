import { z } from 'zod';

export const generateRecommendationsSchema = z.object({
  emotionRecordId: z.string().uuid('emotionRecordId debe ser un UUID válido'),
  cursor: z.string().min(1, 'cursor no puede estar vacío').optional()
});

export const listRecommendationsQuerySchema = z.object({
  emotionRecordId: z.string().uuid('emotionRecordId debe ser un UUID válido').optional(),
  from: z.string().datetime({ offset: true, message: 'from debe ser una fecha ISO 8601' }).optional(),
  to: z.string().datetime({ offset: true, message: 'to debe ser una fecha ISO 8601' }).optional(),
  page: z.coerce.number()
    .int('page debe ser un número entero')
    .min(1, 'page debe ser mayor o igual a 1')
    .default(1),
  limit: z.coerce.number()
    .int('limit debe ser un número entero')
    .min(1, 'limit debe ser mayor o igual a 1')
    .max(100, 'limit debe ser menor o igual a 100')
    .default(10)
}).superRefine((query, context) => {
  if (
    query.from !== undefined
    && query.to !== undefined
    && new Date(query.from).getTime() > new Date(query.to).getTime()
  ) {
    context.addIssue({
      code: 'custom',
      path: ['from'],
      message: 'from no puede ser posterior a to'
    });
  }
});
