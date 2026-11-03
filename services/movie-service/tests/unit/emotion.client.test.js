import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEmotionRecord } from '../../src/clients/emotion.client.js';

const EMOTION_RECORD_ID = '11111111-2222-4333-8444-555555555555';

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
    fetchMock.mockResolvedValue(mockResponse({
      body: {
        status: 'ok',
        data: {
          id: EMOTION_RECORD_ID,
          emotion: 'HAPPY'
        }
      }
    }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID, {
      authorization: 'Bearer token'
    })).resolves.toEqual({
      id: EMOTION_RECORD_ID,
      emotion: 'HAPPY'
    });

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(`http://127.0.0.1:3002/emotion-records/${EMOTION_RECORD_ID}`);
    expect(options.headers.Authorization).toBe('Bearer token');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('acepta una respuesta directa con el registro', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: {
        id: EMOTION_RECORD_ID,
        emotion: 'SAD'
      }
    }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).resolves.toEqual({
      id: EMOTION_RECORD_ID,
      emotion: 'SAD'
    });
  });

  it('distingue un registro de otro usuario', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 403 }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'El registro emocional pertenece a otro usuario'
    });
  });

  it('distingue un registro inexistente', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      status: 404,
      body: { code: 'NOT_FOUND' }
    }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'El registro emocional no existe'
    });
  });

  it('no confunde un contrato pendiente con un registro inexistente', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 404 }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'Emotion Service no expone el contrato de emociones esperado'
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

  it('normaliza una respuesta inválida', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: { status: 'ok', data: { id: EMOTION_RECORD_ID } }
    }));

    await expect(getEmotionRecord(EMOTION_RECORD_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'Emotion Service devolvió una respuesta inválida'
    });
  });
});
