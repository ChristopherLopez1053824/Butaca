import { beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

const { getSummary } = vi.hoisted(() => ({
  getSummary: vi.fn()
}));

vi.mock('@butaca/auth', () => ({
  requireAuth: (req, res, next) => {
    if (req.headers.authorization !== 'Bearer test-token') {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Token de autenticación requerido'
      });
    }

    req.auth = { userId: '7f1d6a2e-3b4c-4d5e-8f90-123456789abc' };
    return next();
  }
}));

vi.mock('../../src/services/summary.service.js', () => ({ getSummary }));

import app from '../../src/app.js';

const AUTHORIZATION = 'Bearer test-token';

const summary = {
  emotionTimeline: [{ date: '2026-11-01', emotion: 'HAPPY', count: 2 }],
  recommendationsByEmotion: [{ emotion: 'HAPPY', mediaType: 'MOVIE', count: 10 }],
  favoritesCount: 4,
  unavailable: []
};

describe('dashboard-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe responder correctamente al endpoint de salud', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('dashboard-service');
  });

  it('requiere autenticación para consultar el resumen', async () => {
    const response = await request(app).get('/summary');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(getSummary).not.toHaveBeenCalled();
  });

  it('devuelve el resumen real del usuario autenticado y reenvía el token', async () => {
    getSummary.mockResolvedValue(summary);

    const response = await request(app)
      .get('/summary')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', data: summary });
    expect(getSummary).toHaveBeenCalledWith({
      from: undefined,
      to: undefined,
      authorization: AUTHORIZATION
    });
  });

  it('acepta from y to en formato ISO 8601', async () => {
    getSummary.mockResolvedValue(summary);

    const response = await request(app)
      .get('/summary?from=2026-11-01T00:00:00.000Z&to=2026-11-08T00:00:00.000Z')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(200);
    expect(getSummary).toHaveBeenCalledWith({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-08T00:00:00.000Z',
      authorization: AUTHORIZATION
    });
  });

  it('rechaza from posterior a to', async () => {
    const response = await request(app)
      .get('/summary?from=2026-11-08T00:00:00.000Z&to=2026-11-01T00:00:00.000Z')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(getSummary).not.toHaveBeenCalled();
  });

  it('rechaza parámetros que no sean fechas ISO 8601', async () => {
    const response = await request(app)
      .get('/summary?from=no-es-una-fecha')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(getSummary).not.toHaveBeenCalled();
  });

  it('rechaza parámetros desconocidos', async () => {
    const response = await request(app)
      .get('/summary?page=2')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve errores JSON para rutas inexistentes', async () => {
    const response = await request(app)
      .get('/unknown')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
