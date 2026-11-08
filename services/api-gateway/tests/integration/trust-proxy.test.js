import http from 'node:http';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Simula un despliegue con un proxy delante del Gateway (TRUST_PROXY=1).
const JWT_SECRET = 'clave-de-prueba-con-mas-de-32-caracteres';
const ISSUER = 'http://supabase.test/auth/v1';

let app;
let token;
let receivedHeaders;
let server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    receivedHeaders = req.headers;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  delete process.env.SUPABASE_URL;
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.SUPABASE_JWT_ISSUER = ISSUER;
  process.env.TRUST_PROXY = '1';
  process.env.USER_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;

  vi.resetModules();
  ({ default: app } = await import('../../src/app.js'));

  token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setSubject('7f1d6a2e-3b4c-4d5e-8f90-123456789abc')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(JWT_SECRET));
});

afterAll(() => {
  delete process.env.TRUST_PROXY;
  server.close();
});

describe('Gateway detrás de un proxy', () => {
  it('envía al servicio la IP del usuario que informó el proxy', async () => {
    await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', '203.0.113.7');

    expect(receivedHeaders['x-forwarded-for']).toBe('203.0.113.7');
  });
});
