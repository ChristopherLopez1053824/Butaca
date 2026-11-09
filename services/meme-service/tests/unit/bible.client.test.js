import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
  env: {
    BIBLE_API_PROVIDER: 'api.bible',
    BIBLE_API_BASE_URL: 'https://rest.api.bible/v1',
    BIBLE_API_KEY: undefined,
    BIBLE_API_TRANSLATION: 'test-bible-id',
    BIBLE_API_TIMEOUT_MS: 5000
  }
}));

const { env } = await import('../../src/config/env.js');
const { getPassage } = await import('../../src/clients/bible.client.js');

function mockFetchOnce(status, body) {
  const response = new Response(
    body === undefined ? undefined : JSON.stringify(body),
    { status }
  );
  globalThis.fetch = vi.fn().mockResolvedValue(response);
  return globalThis.fetch;
}

beforeEach(() => {
  env.BIBLE_API_PROVIDER = 'api.bible';
  env.BIBLE_API_KEY = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bible.client', () => {
  it('rechaza sin llamar al proveedor si falta BIBLE_API_KEY', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    await expect(getPassage('JHN.3.16')).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_NOT_CONFIGURED'
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza si el proveedor configurado no está soportado', async () => {
    env.BIBLE_API_KEY = 'una-clave';
    env.BIBLE_API_PROVIDER = 'youversion';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    await expect(getPassage('JHN.3.16')).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_NOT_CONFIGURED'
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía la clave en el header api-key y nunca en la URL', async () => {
    env.BIBLE_API_KEY = 'secreta-123';
    const fetchMock = mockFetchOnce(200, {
      data: {
        content: 'Porque de tal manera amó Dios al mundo...',
        reference: 'Juan 3:16',
        copyright: '© Sociedades Bíblicas Unidas'
      }
    });

    await getPassage('JHN.3.16');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).not.toContain('secreta-123');
    expect(options.headers['api-key']).toBe('secreta-123');
  });

  it('devuelve el pasaje normalizado en una respuesta válida', async () => {
    env.BIBLE_API_KEY = 'clave';
    mockFetchOnce(200, {
      data: {
        content: 'Texto del versículo',
        reference: 'Juan 3:16',
        copyright: '© Sociedades Bíblicas Unidas, usado con permiso'
      }
    });

    const passage = await getPassage('JHN.3.16');

    expect(passage).toEqual({
      content: 'Texto del versículo',
      reference: 'Juan 3:16',
      copyright: '© Sociedades Bíblicas Unidas, usado con permiso'
    });
  });

  it('responde NOT_FOUND si el proveedor devuelve 404', async () => {
    env.BIBLE_API_KEY = 'clave';
    mockFetchOnce(404, { error: 'not found' });

    await expect(getPassage('XXX.1.1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  });

  it('responde UPSTREAM_ERROR si el proveedor rechaza la clave (401/403)', async () => {
    env.BIBLE_API_KEY = 'clave-invalida';
    mockFetchOnce(401, { error: 'unauthorized' });

    await expect(getPassage('JHN.3.16')).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR'
    });
  });

  it('responde GATEWAY_TIMEOUT si la solicitud se agota', async () => {
    env.BIBLE_API_KEY = 'clave';
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const error = new Error('timeout');
      error.name = 'TimeoutError';
      return Promise.reject(error);
    });

    await expect(getPassage('JHN.3.16')).rejects.toMatchObject({
      statusCode: 504,
      code: 'GATEWAY_TIMEOUT'
    });
  });

  it('responde UPSTREAM_ERROR si la respuesta no tiene el formato esperado', async () => {
    env.BIBLE_API_KEY = 'clave';
    mockFetchOnce(200, { data: { content: '' } });

    await expect(getPassage('JHN.3.16')).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR'
    });
  });
});
