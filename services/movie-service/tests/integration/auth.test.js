import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { requireAuth } from '../../src/middlewares/auth.js';
import { OTHER_USER_ID, USER_ID, signToken } from '../helpers/auth.js';

const protectedApp = express();

function protectedHandler(req, res) {
  res.status(200).json({ userId: req.auth.userId });
}

protectedApp.get('/protected', requireAuth, protectedHandler);
protectedApp.post('/protected', requireAuth, protectedHandler);

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

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
