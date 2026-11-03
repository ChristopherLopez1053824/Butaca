import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/errors.js';
import {
  decodeCursor,
  encodeCursor
} from '../../src/services/recommendation-cursor.service.js';
import {
  createRecommendationService
} from '../../src/services/recommendation.service.js';

const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';
const OTHER_USER_ID = '0b7c8d9e-1f20-4a3b-9c4d-567890abcdef';
const EMOTION_RECORD_ID = '11111111-2222-4333-8444-555555555555';

function makeCandidate(mediaType, tmdbId, overrides = {}) {
  return {
    tmdbId,
    mediaType,
    title: `${mediaType} ${tmdbId}`,
    overview: 'friendship humor',
    posterPath: `/poster-${tmdbId}.jpg`,
    backdropPath: `/backdrop-${tmdbId}.jpg`,
    releaseDate: '2020-01-01',
    voteAverage: 8,
    voteCount: 1000,
    genreIds: mediaType === 'MOVIE' ? [35] : [16],
    ...overrides
  };
}

function createDiscover(mediaType, {
  count = 10,
  pages = Object.freeze({}),
  totalPages = 5
} = {}) {
  return vi.fn(async ({ page }) => {
    const pageResults = pages[page] ?? Array.from({ length: count }, (_, index) => (
      makeCandidate(mediaType, page * 1000 + index + 1)
    ));

    return {
      page,
      totalPages,
      totalResults: totalPages * count,
      results: pageResults
    };
  });
}

function createDatabase({ existing = [], emotionExists = true } = {}) {
  const state = {
    existing: [...existing],
    created: []
  };
  const tx = {
    emotionRecord: {
      findFirst: vi.fn(async () => (emotionExists ? { id: EMOTION_RECORD_ID } : null))
    },
    recommendation: {
      findMany: vi.fn(async () => state.existing),
      createMany: vi.fn(async ({ data }) => {
        state.created.push(...data);
        state.existing.push(...data);
      })
    },
    $queryRaw: vi.fn(async () => [])
  };
  const withUserContext = vi.fn(async (userId, callback) => callback(tx));

  return {
    state,
    tx,
    withUserContext
  };
}

function createService({ database, discoverMovies, discoverTv, resolveKeywordIds } = {}) {
  return createRecommendationService({
    withUserContext: database.withUserContext,
    getEmotionRecord: vi.fn(async () => ({
      id: EMOTION_RECORD_ID,
      emotion: 'HAPPY'
    })),
    discoverMovies: discoverMovies ?? createDiscover('MOVIE'),
    discoverTv: discoverTv ?? createDiscover('TV'),
    resolveKeywordIds: resolveKeywordIds ?? vi.fn(async () => [1, 2]),
    encodeCursor,
    decodeCursor
  });
}

describe('recommendation service', () => {
  let database;
  let discoverMovies;
  let discoverTv;

  beforeEach(() => {
    database = createDatabase();
    discoverMovies = createDiscover('MOVIE');
    discoverTv = createDiscover('TV');
  });

  it('genera 10 películas y 10 series con cursor y persistencia', async () => {
    const service = createService({ database, discoverMovies, discoverTv });

    const result = await service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      authorization: 'Bearer token'
    });

    expect(result.pagination).toMatchObject({
      limit: 20,
      returned: 20,
      movieCount: 10,
      tvCount: 10,
      hasMore: true
    });
    expect(result.pagination.nextCursor).toBeTruthy();
    expect(database.state.created).toHaveLength(20);
    expect(discoverMovies).toHaveBeenCalledWith({
      genreIds: [35, 16, 12, 10751],
      withoutGenreIds: [18, 27],
      keywordIds: [1, 2],
      page: 1
    });
    expect(discoverTv).toHaveBeenCalledWith({
      genreIds: [35, 16, 10759, 10751],
      withoutGenreIds: [18],
      keywordIds: [1, 2],
      page: 1
    });
    expect(result.data[0]).toMatchObject({
      tmdbId: expect.any(Number),
      mediaType: expect.stringMatching(/^(MOVIE|TV)$/),
      releaseDate: '2020-01-01'
    });
  });

  it('continúa desde el cursor sin repetir recomendaciones guardadas', async () => {
    const service = createService({ database, discoverMovies, discoverTv });
    const first = await service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID
    });

    const second = await service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      cursor: first.pagination.nextCursor
    });

    const firstKeys = new Set(first.data.map((item) => `${item.mediaType}:${item.tmdbId}`));
    const secondKeys = second.data.map((item) => `${item.mediaType}:${item.tmdbId}`);

    expect(secondKeys.every((key) => !firstKeys.has(key))).toBe(true);
    expect(second.pagination.returned).toBe(20);
    expect(discoverMovies).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(discoverTv).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('rechaza un cursor de otro usuario antes de consultar dependencias', async () => {
    const service = createService({ database, discoverMovies, discoverTv });
    const cursor = encodeCursor({
      userId: OTHER_USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      moviePage: 2,
      tvPage: 2,
      movieExhausted: false,
      tvExhausted: false,
      delivered: []
    });

    await expect(service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      cursor
    })).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN'
    });
    expect(discoverMovies).not.toHaveBeenCalled();
    expect(database.withUserContext).not.toHaveBeenCalled();
  });

  it('finaliza cuando TMDB no tiene más resultados', async () => {
    const movies = createDiscover('MOVIE', {
      pages: { 1: [makeCandidate('MOVIE', 1), makeCandidate('MOVIE', 2), makeCandidate('MOVIE', 3)] },
      totalPages: 1
    });
    const tv = createDiscover('TV', {
      pages: { 1: [makeCandidate('TV', 10), makeCandidate('TV', 11)] },
      totalPages: 1
    });
    const service = createService({
      database,
      discoverMovies: movies,
      discoverTv: tv
    });

    const result = await service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID
    });

    expect(result.pagination).toEqual({
      limit: 20,
      returned: 5,
      movieCount: 3,
      tvCount: 2,
      hasMore: false,
      nextCursor: null
    });
  });

  it('excluye candidatos con géneros prohibidos y predominio negativo', async () => {
    const movies = createDiscover('MOVIE', {
      pages: {
        1: [
          makeCandidate('MOVIE', 1, { genreIds: [18] }),
          makeCandidate('MOVIE', 2, { genreIds: [27] }),
          makeCandidate('MOVIE', 3, { overview: 'murder death violence friendship' }),
          makeCandidate('MOVIE', 4)
        ]
      },
      totalPages: 1
    });
    const tv = createDiscover('TV', {
      pages: { 1: [] },
      totalPages: 1
    });
    const service = createService({
      database,
      discoverMovies: movies,
      discoverTv: tv
    });

    const result = await service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID
    });

    expect(result.data.map((item) => item.tmdbId)).toEqual([4]);
  });

  it('falla si no puede resolver ninguna temática real', async () => {
    const service = createService({
      database,
      discoverMovies,
      discoverTv,
      resolveKeywordIds: vi.fn(async () => [])
    });

    await expect(service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID
    })).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'No se pudieron resolver las temáticas en TMDB'
    });
    expect(discoverMovies).not.toHaveBeenCalled();
  });

  it('responde NOT_FOUND si el registro local no existe o no es visible', async () => {
    database = createDatabase({ emotionExists: false });
    const service = createService({ database, discoverMovies, discoverTv });

    await expect(service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID
    })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    });
    expect(discoverMovies).not.toHaveBeenCalled();
  });

  it('lista las recomendaciones persistidas del registro emocional', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    database = createDatabase({
      existing: [{
        id: 'aaaaaaaa-1111-4222-8333-444444444444',
        tmdbId: 550,
        mediaType: 'MOVIE',
        title: 'Fight Club',
        overview: null,
        posterPath: '/poster.jpg',
        backdropPath: null,
        releaseDate: new Date('1999-10-15T00:00:00.000Z'),
        voteAverage: 8.4,
        position: 1,
        createdAt
      }]
    });
    const service = createService({ database, discoverMovies, discoverTv });

    const rows = await service.list({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID
    });

    expect(rows).toEqual([{
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
    }]);
    expect(discoverMovies).not.toHaveBeenCalled();
  });

  it('distingue un registro de otro usuario al listar recomendaciones', async () => {
    database = createDatabase({ emotionExists: false });
    const forbidden = new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'El registro emocional pertenece a otro usuario'
    });
    const service = createRecommendationService({
      withUserContext: database.withUserContext,
      getEmotionRecord: vi.fn(async () => {
        throw forbidden;
      }),
      discoverMovies,
      discoverTv,
      resolveKeywordIds: vi.fn(async () => [1]),
      encodeCursor,
      decodeCursor
    });

    await expect(service.list({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      authorization: 'Bearer token'
    })).rejects.toBe(forbidden);
  });

  it('propaga errores del Emotion Service', async () => {
    const error = new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'El registro emocional pertenece a otro usuario'
    });
    const service = createRecommendationService({
      withUserContext: database.withUserContext,
      getEmotionRecord: vi.fn(async () => {
        throw error;
      }),
      discoverMovies,
      discoverTv,
      resolveKeywordIds: vi.fn(async () => [1]),
      encodeCursor,
      decodeCursor
    });

    await expect(service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID
    })).rejects.toBe(error);
    expect(database.withUserContext).not.toHaveBeenCalled();
  });
});
