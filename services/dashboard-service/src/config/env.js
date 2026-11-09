import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3005),
  EMOTION_SERVICE_URL: z.url().default('http://localhost:3002'),
  EMOTION_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(1).default(5000),
  MOVIE_SERVICE_URL: z.url().default('http://localhost:3003'),
  MOVIE_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(1).default(5000),
  FAVORITES_SERVICE_URL: z.url().default('http://localhost:3004'),
  FAVORITES_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(1).default(5000)
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Configuración de entorno inválida: ${details}`);
}

export const env = Object.freeze(result.data);
