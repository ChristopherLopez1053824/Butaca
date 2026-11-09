import { env } from '../config/env.js';
import { AppError, ERROR_CODES } from '../errors.js';

// Proveedores soportados hoy. Agregar uno nuevo (p. ej. YouVersion Platform
// Services) implica añadir su nombre aquí y su propia función de
// construcción de URL/headers — nunca inventar su forma de respuesta sin
// confirmarla primero contra documentación pública real.
const SUPPORTED_PROVIDERS = Object.freeze(['api.bible']);

function isTimeoutError(error) {
  return error?.name === 'TimeoutError';
}

function missingKeyError() {
  return new AppError({
    statusCode: 503,
    code: ERROR_CODES.SERVICE_NOT_CONFIGURED,
    message: 'El servicio de contenido bíblico todavía no está configurado. Falta BIBLE_API_KEY.'
  });
}

function unsupportedProviderError() {
  return new AppError({
    statusCode: 503,
    code: ERROR_CODES.SERVICE_NOT_CONFIGURED,
    message: `El proveedor "${env.BIBLE_API_PROVIDER}" no está soportado todavía`
  });
}

function upstreamUnavailableError() {
  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message: 'El proveedor de contenido bíblico no está disponible'
  });
}

function invalidUpstreamResponseError() {
  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message: 'El proveedor de contenido bíblico devolvió una respuesta inválida'
  });
}

function buildUrl(pathname, params = {}) {
  const baseUrl = env.BIBLE_API_BASE_URL.replace(/\/+$/, '');
  const url = new URL(`${baseUrl}${pathname}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

// GET /bibles/{bibleId}/passages/{passageId} es un endpoint real y
// documentado de api.bible (https://docs.api.bible/guides/passages). La
// clave va en el header "api-key", nunca en la URL ni en query params, para
// no dejarla en logs de acceso.
async function requestPassage(passageId) {
  if (!env.BIBLE_API_KEY) {
    throw missingKeyError();
  }

  if (!SUPPORTED_PROVIDERS.includes(env.BIBLE_API_PROVIDER)) {
    throw unsupportedProviderError();
  }

  const url = buildUrl(
    `/bibles/${encodeURIComponent(env.BIBLE_API_TRANSLATION)}/passages/${encodeURIComponent(passageId)}`,
    { 'content-type': 'text', 'include-notes': false }
  );

  let response;

  try {
    response = await fetch(url.toString(), {
      headers: { 'api-key': env.BIBLE_API_KEY },
      signal: AbortSignal.timeout(env.BIBLE_API_TIMEOUT_MS)
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new AppError({
        statusCode: 504,
        code: ERROR_CODES.GATEWAY_TIMEOUT,
        message: 'El proveedor de contenido bíblico no respondió a tiempo'
      });
    }

    throw upstreamUnavailableError();
  }

  if (response.status === 404) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: 'La referencia bíblica solicitada no existe en esta traducción, o la traducción configurada no está disponible para esta clave'
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw new AppError({
      statusCode: 502,
      code: ERROR_CODES.UPSTREAM_ERROR,
      message: 'El proveedor de contenido bíblico rechazó la API Key configurada'
    });
  }

  if (!response.ok) {
    throw upstreamUnavailableError();
  }

  let body;

  try {
    body = await response.json();
  } catch {
    throw invalidUpstreamResponseError();
  }

  const data = body?.data;

  if (
    !data
    || typeof data !== 'object'
    || typeof data.content !== 'string'
    || data.content.trim().length === 0
    || typeof data.reference !== 'string'
    || typeof data.copyright !== 'string'
    || data.copyright.trim().length === 0
  ) {
    throw invalidUpstreamResponseError();
  }

  return {
    content: data.content.trim(),
    reference: data.reference,
    copyright: data.copyright
  };
}

export async function getPassage(passageId) {
  return requestPassage(passageId);
}

export const bibleClient = Object.freeze({ getPassage });

export default bibleClient;
