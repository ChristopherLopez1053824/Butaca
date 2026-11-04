import { beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

const { withUserContext } = vi.hoisted(() => ({
  withUserContext: vi.fn()
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

vi.mock('@butaca/database', () => ({ withUserContext }));

import app from '../../src/app.js';

const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';
const AUTHORIZATION = 'Bearer test-token';

describe('user-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe responder correctamente al endpoint de salud', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('user-service');
    expect(response.body.timestamp).toBeDefined();
  });

  it('requiere autenticación para las rutas de perfil', async () => {
    const response = await request(app).get('/me');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(withUserContext).not.toHaveBeenCalled();
  });

  it('devuelve el perfil del usuario autenticado dentro del contexto RLS', async () => {
    const profile = {
      id: USER_ID,
      displayName: 'Ana',
      avatarUrl: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    };
    const tx = {
      profile: {
        findUnique: vi.fn().mockResolvedValue(profile)
      }
    };
    withUserContext.mockImplementation((userId, callback) => callback(tx));

    const response = await request(app)
      .get('/me')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', data: JSON.parse(JSON.stringify(profile)) });
    expect(withUserContext).toHaveBeenCalledWith(USER_ID, expect.any(Function));
    expect(tx.profile.findUnique).toHaveBeenCalledWith({ where: { id: USER_ID } });
  });

  it('devuelve NOT_FOUND cuando el perfil aún no existe', async () => {
    const tx = {
      profile: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    };
    withUserContext.mockImplementation((userId, callback) => callback(tx));

    const response = await request(app)
      .get('/me')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('actualiza solo los campos de perfil enviados', async () => {
    const profile = { id: USER_ID, displayName: 'Ana nueva', avatarUrl: null };
    const tx = {
      profile: {
        update: vi.fn().mockResolvedValue(profile)
      }
    };
    withUserContext.mockImplementation((userId, callback) => callback(tx));

    const response = await request(app)
      .patch('/me')
      .set('Authorization', AUTHORIZATION)
      .send({ displayName: ' Ana nueva ' });

    expect(response.status).toBe(200);
    expect(response.body.data.displayName).toBe('Ana nueva');
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { displayName: 'Ana nueva' }
    });
  });

  it('rechaza campos inesperados y evita cambiar la identidad del perfil', async () => {
    const response = await request(app)
      .patch('/me')
      .set('Authorization', AUTHORIZATION)
      .send({ userId: 'otro-usuario', displayName: 'Ana' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(withUserContext).not.toHaveBeenCalled();
  });

  it('devuelve errores JSON para rutas inexistentes', async () => {
    const response = await request(app)
      .get('/unknown')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
