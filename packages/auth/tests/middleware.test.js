import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  SignJWT,
  exportJWK,
  generateKeyPair
} from 'jose';
import { createAuthMiddleware } from '../src/index.js';

const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';
const OTHER_USER_ID = '0b7c8d9e-1f20-4a3b-9c4d-567890abcdef';

let server;
let issuer;
let jwksUrl;
let privateKey;
let wrongPrivateKey;

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function createRequest(token) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {}
  };
}

async function signToken({
  key = privateKey,
  kid = 'test-key',
  alg = 'RS256',
  sub = USER_ID,
  tokenIssuer = issuer,
  audience = 'authenticated',
  expirationTime = '5m'
} = {}) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg, kid })
    .setIssuer(tokenIssuer)
    .setAudience(audience)
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
  publicJwk.kid = 'test-key';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  server = http.createServer((req, res) => {
    if (req.url === '/auth/v1/.well-known/jwks.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  issuer = `http://127.0.0.1:${port}/auth/v1`;
  jwksUrl = `${issuer}/.well-known/jwks.json`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('requireAuth', () => {
  it('responde 401 cuando no hay token', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 cuando el token está malformado', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const req = createRequest('esto-no-es-un-jwt');
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 cuando la firma es inválida', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const token = await signToken({ key: wrongPrivateKey });
    const req = createRequest(token);
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 cuando el token está expirado', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const token = await signToken({ expirationTime: Math.floor(Date.now() / 1000) - 60 });
    const req = createRequest(token);
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Token de autenticación expirado');
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 cuando el issuer no coincide', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const token = await signToken({ tokenIssuer: `${issuer}/otro` });
    const req = createRequest(token);
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 cuando la audiencia no coincide', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const token = await signToken({ audience: 'otra-audiencia' });
    const req = createRequest(token);
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 cuando sub no es un UUID', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const token = await signToken({ sub: 'usuario-invalido' });
    const req = createRequest(token);
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza HS256 cuando no hay secreto legacy configurado', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const secret = new TextEncoder().encode('secreto-de-prueba');
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setSubject(USER_ID)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret);
    const req = createRequest(token);
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('acepta HS256 solo cuando el secreto legacy está configurado', async () => {
    const secretValue = 'secreto-de-prueba';
    const middleware = createAuthMiddleware({
      issuer,
      audience: 'authenticated',
      jwtSecret: secretValue
    });
    const secret = new TextEncoder().encode(secretValue);
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setSubject(USER_ID)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret);
    const req = createRequest(token);
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth.userId).toBe(USER_ID);
  });

  it('permite el paso y expone req.auth con un token válido', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const token = await signToken();
    const req = createRequest(token);
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(req.auth.userId).toBe(USER_ID);
    expect(req.auth.role).toBe('authenticated');
    expect(req.auth.claims.sub).toBe(USER_ID);
    expect(req.auth.claims.aud).toBe('authenticated');
  });

  it('acepta cualquier UUID válido como sub', async () => {
    const middleware = createAuthMiddleware({ issuer, audience: 'authenticated', jwksUrl });
    const token = await signToken({ sub: OTHER_USER_ID });
    const req = createRequest(token);
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth.userId).toBe(OTHER_USER_ID);
  });
});
