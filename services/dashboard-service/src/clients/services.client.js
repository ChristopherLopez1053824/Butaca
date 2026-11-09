import { env } from '../config/env.js';
import { AppError, ERROR_CODES } from '../errors.js';

function isTimeoutError(error) {
  return error?.name === 'TimeoutError';
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildUrl(baseUrl, pathname, params = {}) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}${pathname}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function fetchServiceJson(serviceName, url, { authorization, timeoutMs }) {
  const headers = { Accept: 'application/json' };

  if (typeof authorization === 'string' && authorization.length > 0) {
    headers.Authorization = authorization;
  }

  let response;

  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new AppError({
        statusCode: 504,
        code: ERROR_CODES.GATEWAY_TIMEOUT,
        message: `${serviceName} no respondió a tiempo`
      });
    }

    throw new AppError({
      statusCode: 503,
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      message: `${serviceName} no está disponible`
    });
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw new AppError({
      statusCode: response.status >= 500 ? 502 : 503,
      code: response.status >= 500 ? ERROR_CODES.UPSTREAM_ERROR : ERROR_CODES.SERVICE_UNAVAILABLE,
      message: `${serviceName} respondió con un error`
    });
  }

  return body;
}

export async function listEmotionRecords({ from, to, page = 1, limit = 100, authorization }) {
  const url = buildUrl(env.EMOTION_SERVICE_URL, '/api/emotions', { from, to, page, limit });
  const body = await fetchServiceJson('Emotion Service', url.toString(), {
    authorization,
    timeoutMs: env.EMOTION_SERVICE_TIMEOUT_MS
  });

  if (!body || body.success !== true || !Array.isArray(body.data)) {
    throw new AppError({
      statusCode: 502,
      code: ERROR_CODES.UPSTREAM_ERROR,
      message: 'Emotion Service devolvió una respuesta inválida'
    });
  }

  return {
    data: body.data,
    pagination: body.pagination
  };
}

export async function listRecommendationsForEmotion(emotionRecordId, { authorization } = {}) {
  const url = buildUrl(env.MOVIE_SERVICE_URL, '/recommendations', {
    emotionRecordId,
    limit: 100
  });
  const body = await fetchServiceJson('Movie Service', url.toString(), {
    authorization,
    timeoutMs: env.MOVIE_SERVICE_TIMEOUT_MS
  });

  if (!body || body.status !== 'ok' || !Array.isArray(body.data)) {
    throw new AppError({
      statusCode: 502,
      code: ERROR_CODES.UPSTREAM_ERROR,
      message: 'Movie Service devolvió una respuesta inválida'
    });
  }

  return body.data;
}

export async function getFavoritesCount({ authorization } = {}) {
  const url = buildUrl(env.FAVORITES_SERVICE_URL, '/', { limit: 1 });
  const body = await fetchServiceJson('Favorites Service', url.toString(), {
    authorization,
    timeoutMs: env.FAVORITES_SERVICE_TIMEOUT_MS
  });

  if (!body || body.status !== 'ok' || typeof body.pagination?.total !== 'number') {
    throw new AppError({
      statusCode: 502,
      code: ERROR_CODES.UPSTREAM_ERROR,
      message: 'Favorites Service devolvió una respuesta inválida'
    });
  }

  return body.pagination.total;
}
