import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError, ERROR_CODES } from '../errors.js';

const CURSOR_VERSION = 1;
const MAX_DELIVERED_KEYS = 1000;
const MAX_PAGE = 500;

function invalidCursorError() {
  return new AppError({
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: 'El cursor de recomendaciones es inválido'
  });
}

function configurationError() {
  return new AppError({
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'La firma de cursores no está configurada'
  });
}

function getSecret() {
  const secret = env.RECOMMENDATIONS_CURSOR_SECRET;

  if (typeof secret !== 'string' || secret.length === 0) {
    throw configurationError();
  }

  return secret;
}

function sign(body) {
  return createHmac('sha256', getSecret())
    .update(body)
    .digest('base64url');
}

function isValidPage(page) {
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE;
}

function isValidPayload(payload) {
  return Boolean(
    payload
    && payload.v === CURSOR_VERSION
    && typeof payload.userId === 'string'
    && payload.userId.length > 0
    && typeof payload.emotionRecordId === 'string'
    && payload.emotionRecordId.length > 0
    && isValidPage(payload.moviePage)
    && isValidPage(payload.tvPage)
    && typeof payload.movieExhausted === 'boolean'
    && typeof payload.tvExhausted === 'boolean'
    && Array.isArray(payload.delivered)
    && payload.delivered.length <= MAX_DELIVERED_KEYS
    && payload.delivered.every((key) => (
      typeof key === 'string' && /^(MOVIE|TV):\d+$/.test(key)
    ))
  );
}

export function encodeCursor(payload) {
  const state = {
    v: CURSOR_VERSION,
    userId: payload.userId,
    emotionRecordId: payload.emotionRecordId,
    moviePage: payload.moviePage,
    tvPage: payload.tvPage,
    movieExhausted: payload.movieExhausted,
    tvExhausted: payload.tvExhausted,
    delivered: [...new Set(payload.delivered)].slice(-MAX_DELIVERED_KEYS)
  };

  if (!isValidPayload(state)) {
    throw configurationError();
  }

  const body = Buffer.from(JSON.stringify(state)).toString('base64url');
  const signature = sign(body);

  return `${body}.${signature}`;
}

export function decodeCursor(cursor) {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    throw invalidCursorError();
  }

  const [body, signature, extra] = cursor.split('.');

  if (!body || !signature || extra !== undefined) {
    throw invalidCursorError();
  }

  const expectedSignature = sign(body);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw invalidCursorError();
  }

  let payload;

  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursorError();
  }

  if (!isValidPayload(payload)) {
    throw invalidCursorError();
  }

  return payload;
}

export const CURSOR_VERSION_NUMBER = CURSOR_VERSION;
