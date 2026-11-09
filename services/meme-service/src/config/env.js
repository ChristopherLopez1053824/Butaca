import 'dotenv/config';
import { z } from 'zod';

function optional(schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3006),

  // Proveedor de contenido bíblico. Por ahora solo "api.bible" está
  // implementado (ver src/clients/bible.client.js). BIBLE_API_KEY se deja
  // vacía a propósito: el servicio debe arrancar sin ella y responder con un
  // error controlado solo cuando se piden versículos, nunca al iniciar.
  BIBLE_API_PROVIDER: optional(z.string().min(1).default('api.bible')),
  BIBLE_API_BASE_URL: optional(z.url().default('https://rest.api.bible/v1')),
  BIBLE_API_KEY: optional(z.string().min(1).optional()),
  // Identificador de la Biblia en el proveedor configurado (no es un nombre
  // libre: en api.bible es el bibleId opaco que aparece en GET /v1/bibles
  // una vez autenticado). El valor por defecto es solo un marcador de
  // posición documentado en .env.example.
  BIBLE_API_TRANSLATION: optional(z.string().min(1).default('RVR1960')),
  BIBLE_API_TIMEOUT_MS: optional(z.coerce.number().int().min(1).default(5000))
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Configuración de entorno inválida: ${details}`);
}

export const env = Object.freeze(result.data);
