import http from 'node:http';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const JWT_SECRET = 'clave-de-prueba-con-mas-de-32-caracteres';
const ISSUER = 'http://supabase.test/auth/v1';
const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let app;
let token;
let received;
let receivedHeaders;
let okServer;
let slowServer;
let emotionServer;

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function signToken(role) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setSubject(USER_ID)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

beforeAll(async () => {
  okServer = http.createServer((req, res) => {
    received = `${req.method} ${req.url}`;
    receivedHeaders = req.headers;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
  });

  // Simula Emotion Service, que responde con { success } y usa el prefijo /api/emotions.
  emotionServer = http.createServer((req, res) => {
    received = `${req.method} ${req.url}`;

    if (req.url.startsWith('/api/emotions/invalido')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: { code: 'INVALID_PARAMETERS', message: 'Datos inválidos' }
      }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { emotion: 'SAD' } }));
  });

  // Nunca responde: sirve para provocar el timeout del proxy.
  slowServer = http.createServer(() => {});

  const okUrl = `http://127.0.0.1:${await listen(okServer)}`;
  const slowUrl = `http://127.0.0.1:${await listen(slowServer)}`;
  const emotionUrl = `http://127.0.0.1:${await listen(emotionServer)}`;

  delete process.env.SUPABASE_URL;
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.SUPABASE_JWT_ISSUER = ISSUER;
  process.env.PROXY_TIMEOUT_MS = '200';
  process.env.USER_SERVICE_URL = okUrl;
  process.env.EMOTION_SERVICE_URL = emotionUrl;
  process.env.MOVIE_SERVICE_URL = okUrl;
  process.env.FAVORITES_SERVICE_URL = okUrl;
  process.env.DASHBOARD_SERVICE_URL = slowUrl;
  process.env.MEME_SERVICE_URL = 'http://127.0.0.1:1';

  vi.resetModules();
  ({ default: app } = await import('../../src/app.js'));
  token = await signToken('authenticated');
});

afterAll(() => {
  okServer.close();
  emotionServer.close();
  slowServer.closeAllConnections();
  slowServer.close();
});

describe('proxy del api-gateway', () => {
  it.each([
    ['get', '/api/users/me', 'GET /me'],
    ['patch', '/api/users/me', 'PATCH /me'],
    ['post', '/api/emotions', 'POST /api/emotions'],
    ['get', '/api/emotions/abc?page=2', 'GET /api/emotions/abc?page=2'],
    ['get', '/api/emotions/health', 'GET /health'],
    ['post', '/api/movies/recommendations', 'POST /recommendations'],
    ['get', '/api/movies/details/550?mediaType=MOVIE', 'GET /details/550?mediaType=MOVIE'],
    ['get', '/api/favorites?limit=5', 'GET /?limit=5'],
    ['delete', '/api/favorites/abc', 'DELETE /abc']
  ])('%s %s llega al servicio como %s', async (method, path, expected) => {
    const response = await request(app)[method](path)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(received).toBe(expected);
  });

  it('convierte la respuesta exitosa de Emotion al formato común', async () => {
    const response = await request(app)
      .get('/api/emotions/abc')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', data: { emotion: 'SAD' } });
  });

  it('convierte el error de Emotion al formato común', async () => {
    const response = await request(app)
      .post('/api/emotions/invalido')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Datos inválidos'
    });
  });

  it('responde 503 si el servicio está caído', async () => {
    const response = await request(app)
      .get('/api/memes/history')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('responde 504 si el servicio tarda demasiado', async () => {
    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(504);
    expect(response.body.code).toBe('GATEWAY_TIMEOUT');
  });

  it('responde 404 con code en una ruta inexistente', async () => {
    const response = await request(app)
      .get('/api/nada')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('responde 403 si el rol no es authenticated', async () => {
    const anonToken = await signToken('anon');
    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${anonToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('reemplaza el X-Forwarded-For del cliente por su IP real', async () => {
    await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', '203.0.113.7');

    expect(receivedHeaders['x-forwarded-for']).not.toContain('203.0.113.7');
    expect(receivedHeaders['x-forwarded-for']).toMatch(/127\.0\.0\.1|::1/);
  });

  it('genera un X-Request-Id y lo envía al servicio', async () => {
    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.headers['x-request-id']).toMatch(UUID);
    expect(receivedHeaders['x-request-id']).toBe(response.headers['x-request-id']);
  });

  it('conserva un X-Request-Id válido enviado por el cliente', async () => {
    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Request-Id', 'front-123');

    expect(response.headers['x-request-id']).toBe('front-123');
    expect(receivedHeaders['x-request-id']).toBe('front-123');
  });

  it('reemplaza un X-Request-Id con caracteres no permitidos', async () => {
    const response = await request(app)
      .get('/health')
      .set('X-Request-Id', 'id con espacios');

    expect(response.headers['x-request-id']).toMatch(UUID);
  });

  it('permite al frontend leer X-Request-Id por CORS', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-expose-headers']).toContain('X-Request-Id');
  });
});
