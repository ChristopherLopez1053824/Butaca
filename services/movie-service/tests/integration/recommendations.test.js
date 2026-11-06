import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app.js';
import { AppError } from '../../src/errors.js';
import { recommendationService } from '../../src/services/recommendation.service.js';
import { USER_ID, signToken } from '../helpers/auth.js';

vi.mock('../../src/services/recommendation.service.js', () => ({
  recommendationService: {
    generate: vi.fn(),
    list: vi.fn()
  }
}));

const EMOTION_RECORD_ID = '11111111-2222-4333-8444-555555555555';
const RECOMMENDATION = {
  id: 'aaaaaaaa-1111-4222-8333-444444444444',
  tmdbId: 550,
  mediaType: 'MOVIE',
  title: 'Fight Club',
  overview: null,
  posterPath: '/poster.jpg',
  backdropPath: null,
  releaseDate: '1999-10-15',
  voteAverage: 8.4,
  position: 1,
  createdAt: '2026-01-01T00:00:00.000Z'
};

function authorized(requestBuilder) {
  return requestBuilder.set('Authorization', `Bearer ${signToken()}`);
}

describe('recommendations routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exige autenticación en POST y GET', async () => {
    const postResponse = await request(app)
      .post('/recommendations')
      .send({ emotionRecordId: EMOTION_RECORD_ID });
    const getResponse = await request(app)
      .get('/recommendations')
      .query({ emotionRecordId: EMOTION_RECORD_ID });

    expect(postResponse.status).toBe(401);
    expect(getResponse.status).toBe(401);
    expect(recommendationService.generate).not.toHaveBeenCalled();
    expect(recommendationService.list).not.toHaveBeenCalled();
  });

  it('valida emotionRecordId en POST', async () => {
    const response = await authorized(
      request(app).post('/recommendations').send({ emotionRecordId: 'invalido' })
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(recommendationService.generate).not.toHaveBeenCalled();
  });

  it('genera recomendaciones usando el usuario del JWT', async () => {
    recommendationService.generate.mockResolvedValue({
      data: [RECOMMENDATION],
      pagination: {
        limit: 20,
        returned: 1,
        movieCount: 1,
        tvCount: 0,
        hasMore: true,
        nextCursor: 'cursor-firmado'
      }
    });

    const response = await authorized(
      request(app)
        .post('/recommendations')
        .send({
          emotionRecordId: EMOTION_RECORD_ID,
          cursor: 'cursor-anterior',
          userId: 'otro-usuario'
        })
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      data: [RECOMMENDATION],
      pagination: {
        limit: 20,
        returned: 1,
        movieCount: 1,
        tvCount: 0,
        hasMore: true,
        nextCursor: 'cursor-firmado'
      }
    });
    expect(recommendationService.generate).toHaveBeenCalledWith({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      cursor: 'cursor-anterior',
      authorization: expect.stringMatching(/^Bearer /)
    });
  });

  it('lista recomendaciones almacenadas sin generar nuevas', async () => {
    recommendationService.list.mockResolvedValue({
      data: [RECOMMENDATION],
      pagination: {
        page: 1,
        limit: 10,
        total: 1
      }
    });

    const response = await authorized(
      request(app)
        .get('/recommendations')
        .query({ emotionRecordId: EMOTION_RECORD_ID })
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      data: [RECOMMENDATION],
      pagination: {
        page: 1,
        limit: 10,
        total: 1
      }
    });
    expect(recommendationService.list).toHaveBeenCalledWith({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      from: undefined,
      to: undefined,
      page: 1,
      limit: 10
    });
    expect(recommendationService.generate).not.toHaveBeenCalled();
  });

  it('acepta GET sin filtros con paginación predeterminada', async () => {
    recommendationService.list.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0
      }
    });

    const response = await authorized(request(app).get('/recommendations'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0
      }
    });
    expect(recommendationService.list).toHaveBeenCalledWith({
      userId: USER_ID,
      emotionRecordId: undefined,
      from: undefined,
      to: undefined,
      page: 1,
      limit: 10
    });
  });

  it('reenvía filtros y paginación a la consulta de historial', async () => {
    recommendationService.list.mockResolvedValue({
      data: [RECOMMENDATION],
      pagination: {
        page: 2,
        limit: 25,
        total: 51
      }
    });

    const response = await authorized(
      request(app)
        .get('/recommendations')
        .query({
          emotionRecordId: EMOTION_RECORD_ID,
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-01-31T23:59:59.999Z',
          page: 2,
          limit: 25
        })
    );

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 25,
      total: 51
    });
    expect(recommendationService.list).toHaveBeenCalledWith({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
      page: 2,
      limit: 25
    });
  });

  it('rechaza un rango de fechas inválido', async () => {
    const response = await authorized(
      request(app)
        .get('/recommendations')
        .query({
          from: '2026-02-01T00:00:00.000Z',
          to: '2026-01-01T00:00:00.000Z'
        })
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(recommendationService.list).not.toHaveBeenCalled();
  });

  it('rechaza limit mayor que 100 y page inválido', async () => {
    const limitResponse = await authorized(
      request(app).get('/recommendations').query({ limit: 101 })
    );
    const pageResponse = await authorized(
      request(app).get('/recommendations').query({ page: 0 })
    );

    expect(limitResponse.status).toBe(400);
    expect(limitResponse.body.code).toBe('VALIDATION_ERROR');
    expect(pageResponse.status).toBe(400);
    expect(pageResponse.body.code).toBe('VALIDATION_ERROR');
    expect(recommendationService.list).not.toHaveBeenCalled();
  });

  it('rechaza fechas con formato inválido', async () => {
    const response = await authorized(
      request(app).get('/recommendations').query({ from: '2026-01-01' })
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(recommendationService.list).not.toHaveBeenCalled();
  });

  it('propaga errores de negocio del servicio', async () => {
    recommendationService.list.mockRejectedValue(new AppError({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Emotion Service no está disponible'
    }));

    const response = await authorized(
      request(app)
        .get('/recommendations')
        .query({ emotionRecordId: EMOTION_RECORD_ID })
    );

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'error',
      code: 'SERVICE_UNAVAILABLE',
      message: 'Emotion Service no está disponible',
      details: []
    });
  });

  it('devuelve 400 si el cursor es inválido', async () => {
    recommendationService.generate.mockRejectedValue(new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'El cursor de recomendaciones es inválido'
    }));

    const response = await authorized(
      request(app)
        .post('/recommendations')
        .send({
          emotionRecordId: EMOTION_RECORD_ID,
          cursor: 'manipulado'
        })
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
