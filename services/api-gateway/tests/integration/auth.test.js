import http from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  SignJWT,
  exportJWK,
  generateKeyPair
} from 'jose';

const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';

let app;
let issuer;
let privateKey;
let wrongPrivateKey;
let jwksServer;
let targetServer;
let targetUrl;
let targetRequests;

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function signToken({
  key = privateKey,
  sub = USER_ID,
  expirationTime = '5m'
} = {}) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'gateway-test-key' })
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(key);
}

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256');
  const wrongKeyPair = await generateKeyPair('RS256');
  privateKey = keyPair.privateKey;
  wrongPrivateKey = wrongKeyPair.privateKey;

  const publicJwk = await exportJWK(keyPair.publicKey);
  publicJwk.kid = 'gateway-test-key';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  jwksServer = http.createServer((req, res) => {
    if (req.url === '/auth/v1/.well-known/jwks.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  targetRequests = [];
  targetServer = http.createServer((req, res) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      targetRequests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        receivedHeaders: req.headers,
        receivedBody: body
      }));
    });
  });

  const jwksPort = await listen(jwksServer);
  const targetPort = await listen(targetServer);
  const supabaseUrl = `http://127.0.0.1:${jwksPort}`;
  targetUrl = `http://127.0.0.1:${targetPort}`;
  issuer = `${supabaseUrl}/auth/v1`;

  process.env.SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_JWT_ISSUER = issuer;
  process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
  delete process.env.SUPABASE_JWT_SECRET;
  process.env.USER_SERVICE_URL = targetUrl;

  vi.resetModules();
  ({ default: app } = await import('../../src/app.js'));
});

afterAll(async () => {
  await Promise.all([close(jwksServer), close(targetServer)]);
});

describe('api-gateway auth', () => {
  it('mantiene /health público', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('responde 401 en /api/* sin token', async () => {
    const response = await request(app).get('/api/users/health');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('responde 401 con un token malformado', async () => {
    const response = await request(app)
      .get('/api/users/health')
      .set('Authorization', 'Bearer no-es-un-jwt');

    expect(response.status).toBe(401);
  });

  it('responde 401 con una firma inválida', async () => {
    const token = await signToken({ key: wrongPrivateKey });
    const response = await request(app)
      .get('/api/users/health')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it('responde 401 con un token expirado', async () => {
    const token = await signToken({
      expirationTime: Math.floor(Date.now() / 1000) - 60
    });
    const response = await request(app)
      .get('/api/users/health')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Token de autenticación expirado');
  });

  it('permite llegar al proxy con un token válido', async () => {
    const token = await signToken();
    const response = await request(app)
      .get('/api/users/health')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(targetRequests).toHaveLength(1);
  });

  it('elimina cabeceras internas y propaga Authorization', async () => {
    targetRequests = [];
    const token = await signToken();
    const response = await request(app)
      .get('/api/users/health')
      .set('Authorization', `Bearer ${token}`)
      .set('X-User-Id', 'usuario-atacante')
      .set('X-User-Role', 'admin')
      .set('X-Internal-Secret', 'secreto-interno');

    expect(response.status).toBe(200);

    const forwarded = targetRequests[0].headers;
    expect(forwarded.authorization).toBe(`Bearer ${token}`);
    expect(forwarded['x-user-id']).toBeUndefined();
    expect(forwarded['x-user-role']).toBeUndefined();
    expect(forwarded['x-internal-secret']).toBeUndefined();
  });

  it('no altera el cuerpo de una solicitud POST al proxy', async () => {
    targetRequests = [];
    const token = await signToken();
    const payload = { emotion: 'happy', score: 0.9 };

    const response = await request(app)
      .post('/api/users/echo')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(200);
    expect(JSON.parse(targetRequests[0].body)).toEqual(payload);
  });
});
