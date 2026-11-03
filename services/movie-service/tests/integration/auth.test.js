import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { requireAuth } from '../../src/middlewares/auth.js';

const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';
const OTHER_USER_ID = '0b7c8d9e-1f20-4a3b-9c4d-567890abcdef';
const ISSUER = process.env.SUPABASE_JWT_ISSUER;
const SECRET = process.env.SUPABASE_JWT_SECRET;

const protectedApp = express();

function protectedHandler(req, res) {
  res.status(200).json({ userId: req.auth.userId });
}

protectedApp.get('/protected', requireAuth, protectedHandler);
protectedApp.post('/protected', requireAuth, protectedHandler);

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signToken({
  sub = USER_ID,
  issuer = ISSUER,
  audience = 'authenticated',
  expiresIn = 300
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub,
    role: 'authenticated',
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + expiresIn
  });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', SECRET)
    .update(unsigned)
    .digest('base64url');

  return `${unsigned}.${signature}`;
}

describe('movie-service authentication', () => {
  it('responde 401 en una ruta protegida sin JWT', async () => {
    const response = await request(app).get('/recommendations');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Token de autenticación requerido',
      details: []
    });
  });

  it('no confía en cabeceras x-user-id', async () => {
    const response = await request(app)
      .get('/recommendations')
      .set('X-User-Id', OTHER_USER_ID);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rechaza un JWT inválido', async () => {
    const response = await request(app)
      .get('/recommendations')
      .set('Authorization', 'Bearer token-invalido');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('permite el paso con un JWT válido y expone req.auth.userId', async () => {
    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe(USER_ID);
  });

  it('ignora userId enviado en query y body', async () => {
    const response = await request(protectedApp)
      .post('/protected')
      .query({ userId: OTHER_USER_ID })
      .send({ userId: OTHER_USER_ID })
      .set('Authorization', `Bearer ${signToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe(USER_ID);
  });

  it('deja pasar el JWT válido hasta la ruta protegida', async () => {
    const response = await request(app)
      .get('/recommendations')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
