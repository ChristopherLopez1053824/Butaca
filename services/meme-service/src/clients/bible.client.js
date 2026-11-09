import { env } from '../config/env.js';
import { AppError, ERROR_CODES } from '../errors.js';

// Proveedores soportados hoy. Agregar uno nuevo (p. ej. YouVersion Platform
// Services) implica añadir su nombre aquí y su propia función de
// construcción de URL/headers — nunca inventar su forma de respuesta sin
// confirmarla primero contra documentación pública real.
const SUPPORTED_PROVIDERS = Object.freeze(['api.bible']);

// Prefijo de número de versículo que api.bible incluye en content-type=text
// (p. ej. "     [16] Porque de tal manera..."). Es solo cosmético: lo
// quitamos para mostrar el texto limpio; el número real sigue disponible en
// reference/verseCount si se necesitara.
const VERSE_NUMBER_PREFIX = /^\s*\[\d+\]\s*/;

let cachedBibleInfo = null;

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

function notFoundError(message) {
  return new AppError({ statusCode: 404, code: ERROR_CODES.NOT_FOUND, message });
}

function unauthorizedUpstreamError() {
  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message: 'El proveedor de contenido bíblico rechazó la API Key configurada'
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

// Endpoints reales y documentados de api.bible
// (https://docs.api.bible/guides/bibles, /guides/passages). La clave va
// siempre en el header "api-key", nunca en la URL ni en query params, para
// no dejarla en logs de acceso.
async function requestJson(pathname, { params, notFoundMessage } = {}) {
  if (!env.BIBLE_API_KEY) {
    throw missingKeyError();
  }

  if (!SUPPORTED_PROVIDERS.includes(env.BIBLE_API_PROVIDER)) {
    throw unsupportedProviderError();
  }

  const url = buildUrl(pathname, params);
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
    throw notFoundError(
      notFoundMessage ?? 'El recurso solicitado no existe en el proveedor de contenido bíblico'
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw unauthorizedUpstreamError();
  }

  if (!response.ok) {
    throw upstreamUnavailableError();
  }

  try {
    return await response.json();
  } catch {
    throw invalidUpstreamResponseError();
  }
}

function normalizePassage(body) {
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
    content: data.content.trim().replace(VERSE_NUMBER_PREFIX, ''),
    reference: data.reference,
    copyright: data.copyright
  };
}

function normalizeBibleInfo(body) {
  const data = body?.data;

  if (
    !data
    || typeof data !== 'object'
    || typeof data.id !== 'string'
    || typeof data.abbreviationLocal !== 'string'
    || data.abbreviationLocal.trim().length === 0
    || typeof data.nameLocal !== 'string'
  ) {
    throw invalidUpstreamResponseError();
  }

  return {
    id: data.id,
    abbreviation: data.abbreviationLocal,
    name: data.nameLocal,
    copyright: typeof data.copyright === 'string' ? data.copyright : null
  };
}

export async function getPassage(passageId) {
  const body = await requestJson(
    `/bibles/${encodeURIComponent(env.BIBLE_API_TRANSLATION)}/passages/${encodeURIComponent(passageId)}`,
    {
      params: { 'content-type': 'text', 'include-notes': false },
      notFoundMessage: 'La referencia bíblica solicitada no existe en esta traducción, o la traducción configurada no está disponible para esta clave'
    }
  );

  return normalizePassage(body);
}

// Se cachea en memoria del proceso: el bibleId configurado no cambia en
// caliente, así que no hace falta volver a pedirlo en cada solicitud.
export async function getBibleInfo() {
  if (cachedBibleInfo) {
    return cachedBibleInfo;
  }

  const body = await requestJson(
    `/bibles/${encodeURIComponent(env.BIBLE_API_TRANSLATION)}`,
    { notFoundMessage: 'La traducción configurada no está disponible para esta clave' }
  );

  cachedBibleInfo = normalizeBibleInfo(body);
  return cachedBibleInfo;
}

// Solo para pruebas: getBibleInfo() cachea en memoria del proceso, así que
// los tests necesitan poder limpiar esa caché entre casos.
export function _resetBibleInfoCacheForTests() {
  cachedBibleInfo = null;
}

export const bibleClient = Object.freeze({ getPassage, getBibleInfo });

export default bibleClient;
