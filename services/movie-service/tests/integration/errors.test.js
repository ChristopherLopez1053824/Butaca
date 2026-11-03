import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { errorHandler } from '../../src/middlewares/error-handler.js';

const failureApp = express();

failureApp.get('/boom', () => {
  throw new Error('fallo interno');
});

failureApp.use(errorHandler);

describe('movie-service error handling', () => {
  it('responde 404 en JSON para una ruta inexistente', async () => {
    const response = await request(app).get('/ruta-inexistente');

    expect(response.status).toBe(404);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'La ruta GET /ruta-inexistente no existe',
      details: []
    });
  });

  it('responde 400 en JSON para un cuerpo JSON inválido', async () => {
    const response = await request(app)
      .post('/recommendations')
      .set('Authorization', 'Bearer token-invalido')
      .set('Content-Type', 'application/json')
      .send('{"json":');

    expect(response.status).toBe(400);
    expect(response.type).toMatch(/json/);
    expect(response.body.status).toBe('error');
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual([]);
  });

  it('no devuelve HTML ante un error interno', async () => {
    const response = await request(failureApp).get('/boom');

    expect(response.status).toBe(500);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      details: []
    });
  });
});
