import { z } from 'zod';

export const detailsParamsSchema = z.object({
  tmdbId: z.coerce.number()
    .int('tmdbId debe ser un número entero')
    .positive('tmdbId debe ser un número positivo')
});

export const detailsQuerySchema = z.object({
  mediaType: z.enum(['MOVIE', 'TV'])
});
