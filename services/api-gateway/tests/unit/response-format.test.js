import { describe, expect, it } from 'vitest';
import { toCommonFormat } from '../../src/response-format.js';

describe('toCommonFormat', () => {
  it('convierte una respuesta exitosa y conserva data y pagination', () => {
    const body = { success: true, data: [], pagination: { page: 1, limit: 10, total: 0 } };

    expect(toCommonFormat(body)).toEqual({
      status: 'ok',
      data: [],
      pagination: { page: 1, limit: 10, total: 0 }
    });
  });

  it.each([
    ['INVALID_PARAMETERS', 'VALIDATION_ERROR'],
    ['INVALID_DATE_RANGE', 'VALIDATION_ERROR'],
    ['EMOTION_NOT_FOUND', 'NOT_FOUND'],
    ['INTERNAL_SERVER_ERROR', 'INTERNAL_ERROR'],
    ['FORBIDDEN', 'FORBIDDEN']
  ])('convierte el código %s en %s', (code, expected) => {
    const body = { success: false, error: { code, message: 'Texto' } };

    expect(toCommonFormat(body)).toEqual({ status: 'error', code: expected, message: 'Texto' });
  });

  it('no cambia una respuesta que ya usa el formato común', () => {
    const body = { status: 'error', code: 'UNAUTHORIZED', message: 'Token inválido' };

    expect(toCommonFormat(body)).toBe(body);
  });
});
