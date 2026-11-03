import 'dotenv/config';
import { z } from 'zod';

function optional(schema) {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    schema
  );
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3003),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  TMDB_API_KEY: z.string().min(1, 'TMDB_API_KEY es obligatoria'),
  TMDB_BASE_URL: z.url().default('https://api.themoviedb.org/3'),
  EMOTION_SERVICE_URL: z.url().default('http://localhost:3002'),
  SUPABASE_URL: optional(z.url().optional()),
  SUPABASE_JWT_ISSUER: optional(z.url().optional()),
  SUPABASE_JWT_AUDIENCE: optional(z.string().min(1).default('authenticated')),
  SUPABASE_JWT_SECRET: optional(z.string().min(1).optional()),
  SUPABASE_JWKS_URL: optional(z.url().optional()),
  RECOMMENDATIONS_CURSOR_SECRET: optional(z.string().min(32).optional())
}).superRefine((data, context) => {
  if (!data.SUPABASE_URL && !data.SUPABASE_JWT_ISSUER) {
    context.addIssue({
      code: 'custom',
      path: ['SUPABASE_JWT_ISSUER'],
      message: 'SUPABASE_URL o SUPABASE_JWT_ISSUER es obligatoria'
    });
  }

  if (!data.SUPABASE_URL && !data.SUPABASE_JWKS_URL && !data.SUPABASE_JWT_SECRET) {
    context.addIssue({
      code: 'custom',
      path: ['SUPABASE_JWKS_URL'],
      message: 'SUPABASE_URL, SUPABASE_JWKS_URL o SUPABASE_JWT_SECRET es obligatoria'
    });
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Configuración de entorno inválida: ${details}`);
}

export const env = Object.freeze(result.data);
