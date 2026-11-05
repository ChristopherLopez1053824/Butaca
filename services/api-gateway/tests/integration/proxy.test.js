import http from 'node:http';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const JWT_SECRET = 'clave-de-prueba-con-mas-de-32-caracteres';
const ISSUER = 'http://supabase.test/auth/v1';
const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';

let app;
let token;
let received;
let okServer;
let slowServer;

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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
  });

  // Nunca responde: sirve para provocar el timeout del proxy.
  slowServer = http.createServer(() => {});

  const okUrl = `http://127.0.0.1:${await listen(okServer)}`;
  const slowUrl = `http://127.0.0.1:${await listen(slowServer)}`;

  delete process.env.SUPABASE_URL;
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.SUPABASE_JWT_ISSUER = ISSUER;
  process.env.PROXY_TIMEOUT_MS = '200';
  process.env.USER_SERVICE_URL = okUrl;
  process.env.EMOTION_SERVICE_URL = okUrl;
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
  slowServer.closeAllConnections();
  slowServer.close();
});

describe('proxy del api-gateway', () => {
  it.each([
    ['get', '/api/users/me', 'GET /me'],
    ['patch', '/api/users/me', 'PATCH /me'],
    ['post', '/api/emotions', 'POST /'],
    ['get', '/api/emotions/abc', 'GET /abc'],
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
});