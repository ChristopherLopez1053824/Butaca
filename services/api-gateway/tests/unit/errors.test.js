import { describe, expect, it } from 'vitest';
import { errorBody, proxyError } from '../../src/errors.js';

describe('errorBody', () => {
  it('arma el formato común de error', () => {
    expect(errorBody('NOT_FOUND', 'No existe')).toEqual({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'No existe'
    });
  });
});

describe('proxyError', () => {
  it('responde 504 cuando se agota el tiempo', () => {
    const { statusCode, body } = proxyError(true, 'movies');

    expect(statusCode).toBe(504);
    expect(body.code).toBe('GATEWAY_TIMEOUT');
  });

  it('responde 503 cuando el servicio está caído', () => {
    const { statusCode, body } = proxyError(false, 'movies');

    expect(statusCode).toBe(503);
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
  });
});