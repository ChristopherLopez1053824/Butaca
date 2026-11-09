import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';

const mockGetSession = vi.fn();

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession
    }
  })
}));

beforeEach(() => {
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'token-de-prueba' } },
    error: null
  });
});

function mockFetch(status, body, headers = {}) {
  const response = new Response(body, { status, headers });
  globalThis.fetch = vi.fn(async () => response);
  return globalThis.fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiRequest', () => {
  it('envía el token y devuelve el JSON de la respuesta', async () => {
    const fetchMock = mockFetch(200, JSON.stringify({ status: 'ok', data: { id: 1 } }));

    const result = await apiRequest('/api/users/me');

    expect(result).toEqual({ status: 'ok', data: { id: 1 } });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/users/me');
    expect(options.headers.Authorization).toBe('Bearer token-de-prueba');
  });

  it('no envía el token cuando auth es false', async () => {
    const fetchMock = mockFetch(200, JSON.stringify({ status: 'ok' }));

    await apiRequest('/health', { auth: false });

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('devuelve null en una respuesta 204 sin cuerpo', async () => {
    mockFetch(204, null);

    await expect(apiRequest('/api/favorites/abc', { method: 'DELETE' })).resolves.toBeNull();
  });

  it('lanza el mensaje, el código y el X-Request-Id de un error de la API', async () => {
    mockFetch(
      400,
      JSON.stringify({ status: 'error', code: 'VALIDATION_ERROR', message: 'Datos inválidos' }),
      { 'X-Request-Id': 'req-123' }
    );

    await expect(apiRequest('/api/emotions', { method: 'POST' })).rejects.toMatchObject({
      message: 'Datos inválidos',
      status: 400,
      code: 'VALIDATION_ERROR',
      requestId: 'req-123'
    });
  });

  it('usa un mensaje general si el error no trae JSON', async () => {
    mockFetch(502, '<html>Bad Gateway</html>');

    await expect(apiRequest('/api/movies/recommendations')).rejects.toMatchObject({
      message: 'Error al comunicarse con Butaca',
      status: 502
    });
  });

  it('rechaza sin llamar al servidor cuando no hay una sesión activa', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    await expect(apiRequest('/api/emotions', { method: 'POST' })).rejects.toMatchObject({
      message: 'Debes iniciar sesión para realizar esta solicitud'
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propaga el error del Gateway cuando el token es inválido', async () => {
    mockFetch(
      401,
      JSON.stringify({ status: 'error', code: 'UNAUTHORIZED', message: 'Token de autenticación inválido' })
    );

    await expect(apiRequest('/api/emotions', { method: 'POST' })).rejects.toMatchObject({
      message: 'Token de autenticación inválido',
      status: 401,
      code: 'UNAUTHORIZED'
    });
  });

  it('propaga el error de configuración de autenticación del Gateway', async () => {
    mockFetch(
      500,
      JSON.stringify({
        status: 'error',
        code: 'AUTH_CONFIGURATION_ERROR',
        message: 'La autenticación no está configurada correctamente'
      })
    );

    await expect(apiRequest('/api/emotions', { method: 'POST' })).rejects.toMatchObject({
      message: 'La autenticación no está configurada correctamente',
      status: 500,
      code: 'AUTH_CONFIGURATION_ERROR'
    });
  });
});
