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
const OTHER_EMOTION_RECORD_ID = '99999999-2222-4333-8444-555555555555';
const EMOTION_CREATED_AT = '2026-11-03T15:30:00.000Z';

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

function makeRecommendation(tmdbId, overrides = {}) {
  return {
    id: `aaaaaaaa-1111-4222-8333-${String(tmdbId).padStart(12, '0')}`,
    userId: USER_ID,
    emotionRecordId: EMOTION_RECORD_ID,
    tmdbId,
    mediaType: 'MOVIE',
    title: `MOVIE ${tmdbId}`,
    overview: null,
    posterPath: `/poster-${tmdbId}.jpg`,
    backdropPath: null,
    releaseDate: new Date('1999-10-15T00:00:00.000Z'),
    voteAverage: 8.4,
    position: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
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

function rowMatches(row, where = {}) {
  if (row.userId !== where.userId) {
    return false;
  }

  if (where.emotionRecordId !== undefined && row.emotionRecordId !== where.emotionRecordId) {
    return false;
  }

  if (where.createdAt?.gte !== undefined && row.createdAt < where.createdAt.gte) {
    return false;
  }

  if (where.createdAt?.lte !== undefined && row.createdAt > where.createdAt.lte) {
    return false;
  }

  return true;
}

function sortRows(rows, orderBy = []) {
  return [...rows].sort((left, right) => {
    for (const order of orderBy) {
      const [field, direction] = Object.entries(order)[0];

      if (left[field] < right[field]) {
        return direction === 'desc' ? 1 : -1;
      }

      if (left[field] > right[field]) {
        return direction === 'desc' ? -1 : 1;
      }
    }

    return 0;
  });
}

function createDatabase({ existing = [] } = {}) {
  const state = {
    existing: [...existing],
    created: []
  };
  const tx = {
    recommendation: {
      findMany: vi.fn(async (args = {}) => {
        let rows = state.existing.filter((row) => rowMatches(row, args.where));
        rows = sortRows(rows, args.orderBy);
        const start = args.skip ?? 0;
        const end = args.take === undefined ? undefined : start + args.take;
        return rows.slice(start, end);
      }),
      count: vi.fn(async (args = {}) => (
        state.existing.filter((row) => rowMatches(row, args.where)).length
      )),
      createMany: vi.fn(async ({ data }) => {
        state.created.push(...data);
        state.existing.push(...data);
      })
    },
    $executeRaw: vi.fn(async () => 1)
  };
  const withUserContext = vi.fn(async (userId, callback) => callback(tx));

  return {
    state,
    tx,
    withUserContext
  };
}

function createService({
  database,
  discoverMovies,
  discoverTv,
  resolveKeywordIds,
  getEmotionRecord,
  encodeCursor: encode = encodeCursor
} = {}) {
  return createRecommendationService({
    withUserContext: database.withUserContext,
    getEmotionRecord: getEmotionRecord ?? vi.fn(async () => ({
      id: EMOTION_RECORD_ID,
      userId: USER_ID,
      emotion: 'HAPPY',
      createdAt: EMOTION_CREATED_AT
    })),
    discoverMovies: discoverMovies ?? createDiscover('MOVIE'),
    discoverTv: discoverTv ?? createDiscover('TV'),
    resolveKeywordIds: resolveKeywordIds ?? vi.fn(async () => [1, 2]),
    encodeCursor: encode,
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
    expect(result.data.map((item) => item.position)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1)
    );
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
    expect(second.data.map((item) => item.position)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 21)
    );
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

  it('completa el lote usando páginas siguientes de TMDB', async () => {
    const movies = createDiscover('MOVIE', {
      pages: {
        1: [makeCandidate('MOVIE', 1), makeCandidate('MOVIE', 2), makeCandidate('MOVIE', 3)],
        2: Array.from({ length: 10 }, (_, index) => makeCandidate('MOVIE', 100 + index))
      },
      totalPages: 5
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

    expect(result.pagination.movieCount).toBe(10);
    expect(result.pagination.tvCount).toBe(0);
    expect(movies).toHaveBeenCalledTimes(2);
    expect(movies).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('evita duplicados dentro de una página y entre páginas', async () => {
    const movies = createDiscover('MOVIE', {
      pages: {
        1: [
          makeCandidate('MOVIE', 1),
          makeCandidate('MOVIE', 1),
          makeCandidate('MOVIE', 2)
        ],
        2: [
          makeCandidate('MOVIE', 2),
          makeCandidate('MOVIE', 3)
        ]
      },
      totalPages: 2
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

    expect(result.data.map((item) => item.tmdbId)).toEqual([1, 2, 3]);
    expect(database.state.created).toHaveLength(3);
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

  it('propaga NOT_FOUND del Emotion Service sin consultar la base local', async () => {
    const getEmotionRecord = vi.fn(async () => {
      throw new AppError({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'El registro emocional no existe'
      });
    });
    const service = createService({
      database,
      discoverMovies,
      discoverTv,
      getEmotionRecord
    });

    await expect(service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      authorization: 'Bearer token'
    })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    });
    expect(getEmotionRecord).toHaveBeenCalledWith(EMOTION_RECORD_ID, {
      authorization: 'Bearer token'
    });
    expect(database.withUserContext).not.toHaveBeenCalled();
    expect(discoverMovies).not.toHaveBeenCalled();
  });

  it('genera el cursor antes de persistir y no guarda si falla su codificación', async () => {
    const failingEncode = vi.fn(() => {
      throw new AppError({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'No se pudo firmar el cursor'
      });
    });
    const service = createService({
      database,
      discoverMovies,
      discoverTv,
      encodeCursor: failingEncode
    });

    await expect(service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID
    })).rejects.toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR'
    });
    expect(failingEncode).toHaveBeenCalled();
    expect(database.tx.recommendation.createMany).not.toHaveBeenCalled();
    expect(database.state.created).toHaveLength(0);
  });

  it('lista recomendaciones persistidas con filtros y paginación en base de datos', async () => {
    database = createDatabase({
      existing: [
        makeRecommendation(550, {
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
          position: 3
        }),
        makeRecommendation(551, {
          emotionRecordId: OTHER_EMOTION_RECORD_ID,
          createdAt: new Date('2026-01-03T00:00:00.000Z')
        }),
        makeRecommendation(552, {
          userId: OTHER_USER_ID,
          createdAt: new Date('2026-01-03T00:00:00.000Z')
        }),
        makeRecommendation(553, {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          position: 1
        })
      ]
    });
    const getEmotionRecord = vi.fn();
    const service = createService({
      database,
      discoverMovies,
      discoverTv,
      getEmotionRecord
    });

    const result = await service.list({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID,
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-03T23:59:59.999Z',
      page: 1,
      limit: 1
    });

    expect(result.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'aaaaaaaa-1111-4222-8333-000000000550',
      tmdbId: 550,
      position: 3
    });
    expect(database.tx.recommendation.count).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        emotionRecordId: EMOTION_RECORD_ID,
        createdAt: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-01-03T23:59:59.999Z')
        }
      }
    });
    expect(database.tx.recommendation.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        emotionRecordId: EMOTION_RECORD_ID,
        createdAt: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-01-03T23:59:59.999Z')
        }
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
      skip: 0,
      take: 1
    });
    expect(getEmotionRecord).not.toHaveBeenCalled();
    expect(discoverMovies).not.toHaveBeenCalled();
  });

  it('devuelve historial vacío sin consultar Emotion Service', async () => {
    const getEmotionRecord = vi.fn();
    const service = createService({
      database,
      discoverMovies,
      discoverTv,
      getEmotionRecord
    });

    const result = await service.list({
      userId: USER_ID,
      page: 1,
      limit: 10
    });

    expect(result).toEqual({
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0
      }
    });
    expect(getEmotionRecord).not.toHaveBeenCalled();
  });

  it('propaga errores del Emotion Service', async () => {
    const error = new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'No tiene permisos sobre el registro emocional'
    });
    const service = createService({
      database,
      discoverMovies,
      discoverTv,
      getEmotionRecord: vi.fn(async () => {
        throw error;
      })
    });

    await expect(service.generate({
      userId: USER_ID,
      emotionRecordId: EMOTION_RECORD_ID
    })).rejects.toBe(error);
    expect(database.withUserContext).not.toHaveBeenCalled();
  });
});
