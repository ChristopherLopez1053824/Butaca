import { env } from '../config/env.js';
import { AppError, ERROR_CODES } from '../errors.js';

const EMOTION_TIMEOUT_MS = 5000;

function upstreamError(message = 'Emotion Service no está disponible') {
  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message
  });
}

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

function buildUrl(emotionRecordId) {
  const baseUrl = env.EMOTION_SERVICE_URL.replace(/\/+$/, '');
  return `${baseUrl}/emotion-records/${encodeURIComponent(emotionRecordId)}`;
}

export async function getEmotionRecord(emotionRecordId, { authorization } = {}) {
  const headers = {
    Accept: 'application/json'
  };

  if (typeof authorization === 'string' && authorization.length > 0) {
    headers.Authorization = authorization;
  }

  let response;

  try {
    response = await fetch(buildUrl(emotionRecordId), {
      headers,
      signal: AbortSignal.timeout(EMOTION_TIMEOUT_MS)
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new AppError({
        statusCode: 504,
        code: ERROR_CODES.GATEWAY_TIMEOUT,
        message: 'Emotion Service no respondió a tiempo'
      });
    }

    throw upstreamError();
  }

  if (response.status === 403) {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: 'El registro emocional pertenece a otro usuario'
    });
  }

  if (response.status === 401) {
    throw new AppError({
      statusCode: 401,
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'No autorizado para consultar el registro emocional'
    });
  }

  if (response.status === 404) {
    const body = await readJson(response);

    if (body?.code === ERROR_CODES.NOT_FOUND) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: 'El registro emocional no existe'
      });
    }

    throw upstreamError('Emotion Service no expone el contrato de emociones esperado');
  }

  if (!response.ok) {
    throw upstreamError();
  }

  const body = await readJson(response);
  const record = body?.data ?? body;

  if (
    !record
    || typeof record !== 'object'
    || record.id !== emotionRecordId
    || typeof record.emotion !== 'string'
  ) {
    throw upstreamError('Emotion Service devolvió una respuesta inválida');
  }

  return {
    id: record.id,
    emotion: record.emotion
  };
}

export const emotionClient = Object.freeze({
  getEmotionRecord
});

export default emotionClient;
