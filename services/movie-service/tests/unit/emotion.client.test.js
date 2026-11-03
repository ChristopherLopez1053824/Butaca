import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEmotionRecord,
  listEmotionRecords
} from '../../src/clients/emotion.client.js';

const EMOTION_RECORD_ID = '11111111-2222-4333-8444-555555555555';
const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';
const CREATED_AT = '2026-11-03T15:30:00.000Z';

let fetchMock;

function mockResponse({ status = 200, body, jsonError } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jsonError
      ? vi.fn().mockRejectedValue(jsonError)
      : vi.fn().mockResolvedValue(body)
  };
}

function emotionResponse(overrides = {}) {
  return {
    success: true,
    data: {
      id: EMOTION_RECORD_ID,
      userId: USER_ID,
      emotion: 'HAPPY',
      intensity: 8,
      createdAt: CREATED_AT,
      ...overrides
    }
  };
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('emotion client', () => {
  it('consulta el registro emocional con timeout y authorization', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: emotionResponse() }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID, {
      authorization: 'Bearer token'
    })).resolves.toEqual({
      id: EMOTION_RECORD_ID,
      userId: USER_ID,
      emotion: 'HAPPY',
      intensity: 8,
      createdAt: CREATED_AT
    });

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(`http://127.0.0.1:3002/api/emotions/${EMOTION_RECORD_ID}`);
    expect(options.headers.Authorization).toBe('Bearer token');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('acepta el contrato aunque no exista intensity', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: emotionResponse({ intensity: undefined })
    }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).resolves.toEqual({
      id: EMOTION_RECORD_ID,
      userId: USER_ID,
      emotion: 'HAPPY',
      createdAt: CREATED_AT
    });
  });

  it('consulta el historial con filtros y paginación', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: {
        success: true,
        data: [emotionResponse().data],
        pagination: {
          page: 2,
          limit: 5,
          total: 7,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true
        }
      }
    }));

    await expect(listEmotionRecords({
      page: 2,
      limit: 5,
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-03T23:59:59.999Z',
      authorization: 'Bearer token'
    })).resolves.toEqual({
      data: [{
        id: EMOTION_RECORD_ID,
        userId: USER_ID,
        emotion: 'HAPPY',
        intensity: 8,
        createdAt: CREATED_AT
      }],
      pagination: {
        page: 2,
        limit: 5,
        total: 7,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true
      }
    });

    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/emotions');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('limit')).toBe('5');
    expect(parsed.searchParams.get('from')).toBe('2026-11-01T00:00:00.000Z');
    expect(parsed.searchParams.get('to')).toBe('2026-11-03T23:59:59.999Z');
    expect(options.headers.Authorization).toBe('Bearer token');
  });

  it('propaga 400 como solicitud inválida', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      status: 400,
      body: {
        success: false,
        error: { code: 'INVALID_PARAMETERS', message: 'limit inválido' }
      }
    }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'limit inválido'
    });
  });

  it('propaga 401 como no autorizado', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 401 }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED'
    });
  });

  it('propaga 403 como falta de permisos', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 403 }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN'
    });
  });

  it('propaga 404 como emoción no encontrada', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      status: 404,
      body: {
        success: false,
        error: { code: 'EMOTION_NOT_FOUND', message: 'No se encontró la emoción.' }
      }
    }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'El registro emocional no existe'
    });
  });

  it('propaga 500 de Emotion Service sin convertirlo en 404', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 500 }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'Emotion Service devolvió un error interno'
    });
  });

  it('propaga 503 como servicio no disponible', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 503 }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE'
    });
  });

  it('normaliza un timeout', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeoutError);

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 504,
      code: 'GATEWAY_TIMEOUT'
    });
  });

  it('normaliza un error de red como servicio no disponible', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE'
    });
  });

  it('rechaza una respuesta sin success true', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: { data: emotionResponse().data }
    }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'Emotion Service devolvió una respuesta inválida'
    });
  });

  it('rechaza un registro con id distinto al solicitado', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: emotionResponse({ id: '99999999-2222-4333-8444-555555555555' })
    }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR'
    });
  });

  it('rechaza un historial con paginación inválida', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: {
        success: true,
        data: [],
        pagination: { page: 1, limit: 10 }
      }
    }));

    await expect(listEmotionRecords()).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'Emotion Service devolvió una respuesta inválida'
    });
  });
});
