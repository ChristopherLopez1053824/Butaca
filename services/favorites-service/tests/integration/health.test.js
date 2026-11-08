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
const FAVORITE_ID = '123e4567-e89b-12d3-a456-426614174000';
const AUTHORIZATION = 'Bearer test-token';
const favoriteInput = {
  tmdbId: 550,
  mediaType: 'MOVIE',
  title: 'Fight Club',
  posterPath: '/poster.jpg',
  releaseDate: '1999-10-15',
  voteAverage: 8.4
};

describe('favorites-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe responder correctamente al endpoint de salud', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('favorites-service');
    expect(response.body.timestamp).toBeDefined();
  });

  it('requiere autenticación para las rutas de favoritos', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(withUserContext).not.toHaveBeenCalled();
  });

  it('crea un favorito del usuario autenticado y normaliza la fecha', async () => {
    const created = {
      id: FAVORITE_ID,
      userId: USER_ID,
      ...favoriteInput,
      releaseDate: new Date('1999-10-15T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    };
    const tx = {
      favorite: {
        create: vi.fn().mockResolvedValue(created)
      }
    };
    withUserContext.mockImplementation((userId, callback) => callback(tx));

    const response = await request(app)
      .post('/')
      .set('Authorization', AUTHORIZATION)
      .send(favoriteInput);

    expect(response.status).toBe(201);
    expect(response.body.data.releaseDate).toBe('1999-10-15');
    expect(response.body.data.userId).toBeUndefined();
    expect(withUserContext).toHaveBeenCalledWith(USER_ID, expect.any(Function));
    expect(tx.favorite.create).toHaveBeenCalledWith({
      data: {
        ...favoriteInput,
        releaseDate: new Date('1999-10-15T00:00:00.000Z'),
        userId: USER_ID
      }
    });
  });

  it('rechaza payloads incompletos o con campos ajenos', async () => {
    const response = await request(app)
      .post('/')
      .set('Authorization', AUTHORIZATION)
      .send({ ...favoriteInput, userId: 'otro-usuario' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(withUserContext).not.toHaveBeenCalled();
  });

  it('responde 409 cuando la base de datos rechaza un favorito duplicado', async () => {
    withUserContext.mockRejectedValue({ code: 'P2002' });

    const response = await request(app)
      .post('/')
      .set('Authorization', AUTHORIZATION)
      .send(favoriteInput);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CONFLICT');
  });

  it('lista favoritos paginados y limita la consulta al usuario autenticado', async () => {
    const favorites = [{
      id: FAVORITE_ID,
      userId: USER_ID,
      ...favoriteInput,
      releaseDate: new Date('1999-10-15T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    }];
    const tx = {
      favorite: {
        findMany: vi.fn().mockResolvedValue(favorites),
        count: vi.fn().mockResolvedValue(1)
      }
    };
    withUserContext.mockImplementation((userId, callback) => callback(tx));

    const response = await request(app)
      .get('/?page=2&limit=5')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 2, limit: 5, total: 1 });
    expect(response.body.data[0].releaseDate).toBe('1999-10-15');
    expect(tx.favorite.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 5,
      take: 5
    });
    expect(tx.favorite.count).toHaveBeenCalledWith({
      where: { userId: USER_ID }
    });
  });

  it('usa la paginación predeterminada cuando no se envían parámetros', async () => {
    const tx = {
      favorite: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0)
      }
    };
    withUserContext.mockImplementation((userId, callback) => callback(tx));

    const response = await request(app)
      .get('/')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 0 });
    expect(tx.favorite.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 0,
      take: 20
    }));
  });

  it('rechaza límites de paginación superiores al máximo', async () => {
    const response = await request(app)
      .get('/?limit=101')
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(withUserContext).not.toHaveBeenCalled();
  });

  it('elimina únicamente un favorito perteneciente al usuario autenticado', async () => {
    const tx = {
      favorite: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };
    withUserContext.mockImplementation((userId, callback) => callback(tx));

    const response = await request(app)
      .delete(`/${FAVORITE_ID}`)
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(204);
    expect(tx.favorite.deleteMany).toHaveBeenCalledWith({
      where: { id: FAVORITE_ID, userId: USER_ID }
    });
  });

  it('devuelve NOT_FOUND si no existe un favorito propio con ese id', async () => {
    const tx = {
      favorite: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    };
    withUserContext.mockImplementation((userId, callback) => callback(tx));

    const response = await request(app)
      .delete(`/${FAVORITE_ID}`)
      .set('Authorization', AUTHORIZATION);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('valida el UUID antes de consultar la base de datos', async () => {
    const response = await request(app)
      .delete('/not-a-uuid')
      .set('Authorization', AUTHORIZATION);

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
