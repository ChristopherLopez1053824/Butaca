import { z } from 'zod';

function emptyAsUndefined(schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema);
}

function serviceUrl(defaultUrl) {
  return emptyAsUndefined(
    z.url({ protocol: /^https?$/ }).default(defaultUrl)
  );
}

const envSchema = z.object({
  PORT: emptyAsUndefined(z.coerce.number().int().min(1).max(65535).default(3000)),
  WEB_URL: serviceUrl('http://localhost:5173'),
  PROXY_TIMEOUT_MS: emptyAsUndefined(z.coerce.number().int().positive().default(15000)),
  USER_SERVICE_URL: serviceUrl('http://localhost:3001'),
  EMOTION_SERVICE_URL: serviceUrl('http://localhost:3002'),
  MOVIE_SERVICE_URL: serviceUrl('http://localhost:3003'),
  FAVORITES_SERVICE_URL: serviceUrl('http://localhost:3004'),
  DASHBOARD_SERVICE_URL: serviceUrl('http://localhost:3005'),
  MEME_SERVICE_URL: serviceUrl('http://localhost:3006')
});

export function loadConfig(env = process.env) {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Configuración de entorno inválida: ${details}`);
  }

  return result.data;
}

export const config = loadConfig();