import { env } from '../config/env.js';
import { AppError, ERROR_CODES } from '../errors.js';

function invalidResponseError() {
  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message: 'Emotion Service devolvió una respuesta inválida'
  });
}

function serviceUnavailableError() {
  return new AppError({
    statusCode: 503,
    code: ERROR_CODES.SERVICE_UNAVAILABLE,
    message: 'Emotion Service no está disponible'
  });
}

function isTimeoutError(error) {
  return error?.name === 'TimeoutError';
}

function upstreamMessage(body, fallback) {
  return typeof body?.error?.message === 'string' && body.error.message.length > 0
    ? body.error.message
    : fallback;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildUrl(pathname, params = {}) {
  const baseUrl = env.EMOTION_SERVICE_URL.replace(/\/+$/, '');
  const url = new URL(`${baseUrl}${pathname}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function httpError(status, body, { notFoundMessage } = {}) {
  if (status === 400) {
    return new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: upstreamMessage(body, 'Emotion Service rechazó la solicitud')
    });
  }

  if (status === 401) {
    return new AppError({
      statusCode: 401,
      code: ERROR_CODES.UNAUTHORIZED,
      message: upstreamMessage(body, 'No autorizado para consultar emociones')
    });
  }

  if (status === 403) {
    return new AppError({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: upstreamMessage(body, 'No tiene permisos sobre el registro emocional')
    });
  }

  if (status === 404) {
    return new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: notFoundMessage ?? upstreamMessage(body, 'El registro emocional no existe')
    });
  }

  if (status === 503) {
    return new AppError({
      statusCode: 503,
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      message: upstreamMessage(body, 'Emotion Service no está disponible')
    });
  }

  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message: upstreamMessage(body, 'Emotion Service devolvió un error interno')
  });
}

async function requestJson(pathname, {
  authorization,
  params,
  notFoundMessage
} = {}) {
  const headers = {
    Accept: 'application/json'
  };

  if (typeof authorization === 'string' && authorization.length > 0) {
    headers.Authorization = authorization;
  }

  let response;

  try {
    response = await fetch(buildUrl(pathname, params).toString(), {
      headers,
      signal: AbortSignal.timeout(env.EMOTION_SERVICE_TIMEOUT_MS)
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new AppError({
        statusCode: 504,
        code: ERROR_CODES.GATEWAY_TIMEOUT,
        message: 'Emotion Service no respondió a tiempo'
      });
    }

    throw serviceUnavailableError();
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw httpError(response.status, body, { notFoundMessage });
  }

  if (!body || typeof body !== 'object' || body.success !== true) {
    throw invalidResponseError();
  }

  return body;
}

function normalizeRecord(record, expectedId) {
  if (
    !record
    || typeof record !== 'object'
    || typeof record.id !== 'string'
    || record.id.length === 0
    || (expectedId !== undefined && record.id !== expectedId)
    || typeof record.userId !== 'string'
    || record.userId.length === 0
    || typeof record.emotion !== 'string'
    || record.emotion.length === 0
    || typeof record.createdAt !== 'string'
    || Number.isNaN(Date.parse(record.createdAt))
    || (
      record.intensity !== undefined
      && record.intensity !== null
      && (!Number.isFinite(record.intensity) || record.intensity < 0)
    )
  ) {
    throw invalidResponseError();
  }

  return {
    id: record.id,
    userId: record.userId,
    emotion: record.emotion,
    ...(record.intensity === undefined || record.intensity === null
      ? {}
      : { intensity: record.intensity }),
    createdAt: record.createdAt
  };
}

function normalizePagination(pagination) {
  if (
    !pagination
    || typeof pagination !== 'object'
    || !Number.isInteger(pagination.page)
    || pagination.page < 1
    || !Number.isInteger(pagination.limit)
    || pagination.limit < 1
    || !Number.isInteger(pagination.total)
    || pagination.total < 0
    || !Number.isInteger(pagination.totalPages)
    || pagination.totalPages < 0
    || typeof pagination.hasNextPage !== 'boolean'
    || typeof pagination.hasPreviousPage !== 'boolean'
  ) {
    throw invalidResponseError();
  }

  return {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasNextPage: pagination.hasNextPage,
    hasPreviousPage: pagination.hasPreviousPage
  };
}

export async function getEmotionRecord(emotionRecordId, { authorization } = {}) {
  const body = await requestJson(`/api/emotions/${encodeURIComponent(emotionRecordId)}`, {
    authorization,
    notFoundMessage: 'El registro emocional no existe'
  });

  return normalizeRecord(body.data, emotionRecordId);
}

export async function listEmotionRecords({
  page = 1,
  limit = 10,
  from,
  to,
  authorization
} = {}) {
  const body = await requestJson('/api/emotions', {
    authorization,
    params: { page, limit, from, to },
    notFoundMessage: 'El historial emocional no existe'
  });

  if (!Array.isArray(body.data)) {
    throw invalidResponseError();
  }

  return {
    data: body.data.map((record) => normalizeRecord(record)),
    pagination: normalizePagination(body.pagination)
  };
}

export const emotionClient = Object.freeze({
  getEmotionRecord,
  listEmotionRecords
});

export default emotionClient;
