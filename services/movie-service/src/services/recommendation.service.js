import { randomUUID } from 'node:crypto';
import { withUserContext } from '@butaca/database';
import { getEmotionRecord as defaultGetEmotionRecord } from '../clients/emotion.client.js';
import { discoverMovies, discoverTv } from '../clients/tmdb.client.js';
import {
  MEDIA_TYPES,
  getExcludedGenreIds,
  getGoalForEmotion,
  getGoalGenres
} from '../domain/emotion-catalog.js';
import { AppError, ERROR_CODES } from '../errors.js';
import {
  decodeCursor as defaultDecodeCursor,
  encodeCursor as defaultEncodeCursor
} from './recommendation-cursor.service.js';
import { resolveKeywordIds as defaultResolveKeywordIds } from './recommendation-keywords.service.js';
import {
  isCandidateExcluded,
  scoreCandidate
} from './recommendation-scoring.service.js';

const BATCH_SIZE_PER_MEDIA = 10;
const RESPONSE_LIMIT = 20;
const MAX_PAGES_PER_MEDIA = 5;
const MAX_TMDB_PAGE = 500;

function candidateKey(candidate) {
  return `${candidate.mediaType}:${candidate.tmdbId}`;
}

function releaseDateToDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return date;
}

function dateToReleaseDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function serializeRecommendation(row) {
  return {
    id: row.id,
    tmdbId: row.tmdbId,
    mediaType: row.mediaType,
    title: row.title,
    overview: row.overview ?? null,
    posterPath: row.posterPath ?? null,
    backdropPath: row.backdropPath ?? null,
    releaseDate: dateToReleaseDate(row.releaseDate),
    voteAverage: row.voteAverage ?? null,
    position: row.position ?? null,
    createdAt: row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : row.createdAt
  };
}

function forbiddenCursorError() {
  return new AppError({
    statusCode: 403,
    code: ERROR_CODES.FORBIDDEN,
    message: 'El cursor no pertenece a esta consulta'
  });
}

function unsupportedEmotionError() {
  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message: 'Emotion Service devolvió una emoción no soportada'
  });
}

function unavailableKeywordsError() {
  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message: 'No se pudieron resolver las temáticas en TMDB'
  });
}

function persistenceReadError() {
  return new AppError({
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'No se pudieron consultar las recomendaciones'
  });
}

function persistenceWriteError() {
  return new AppError({
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'No se pudieron guardar las recomendaciones'
  });
}

function createInitialState(userId, emotionRecordId) {
  return {
    userId,
    emotionRecordId,
    moviePage: 1,
    tvPage: 1,
    movieExhausted: false,
    tvExhausted: false,
    delivered: []
  };
}

function dedupeCandidates(candidates) {
  const keys = new Set();
  const unique = [];

  for (const candidate of candidates) {
    const key = candidateKey(candidate);

    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    unique.push(candidate);
  }

  return unique;
}

export function createRecommendationService(overrides = {}) {
  const dependencies = {
    withUserContext,
    getEmotionRecord: defaultGetEmotionRecord,
    discoverMovies,
    discoverTv,
    resolveKeywordIds: defaultResolveKeywordIds,
    encodeCursor: defaultEncodeCursor,
    decodeCursor: defaultDecodeCursor,
    ...overrides
  };

  async function loadExistingKeys(userId, emotionRecordId) {
    try {
      return await dependencies.withUserContext(userId, async (tx) => {
        const rows = await tx.recommendation.findMany({
          where: { userId, emotionRecordId },
          select: { tmdbId: true, mediaType: true }
        });

        return rows.map(candidateKey);
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw persistenceReadError();
    }
  }

  async function persistSelection(userId, emotionRecordId, selected) {
    const uniqueSelected = dedupeCandidates(selected);

    if (uniqueSelected.length === 0) {
      return [];
    }

    const now = new Date();

    try {
      return await dependencies.withUserContext(userId, async (tx) => {
        // pg_advisory_xact_lock devuelve void, y Prisma no puede leer ese tipo
        // con $queryRaw. $executeRaw ejecuta la consulta sin leer el resultado.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${userId}),
            hashtext(${emotionRecordId})
          )
        `;

        const existingRows = await tx.recommendation.findMany({
          where: { userId, emotionRecordId },
          select: { tmdbId: true, mediaType: true, position: true }
        });
        const existingKeys = new Set(existingRows.map(candidateKey));
        const maxPosition = existingRows.reduce((max, row) => (
          Number.isInteger(row.position) ? Math.max(max, row.position) : max
        ), 0);
        const toCreate = uniqueSelected
          .filter((candidate) => !existingKeys.has(candidateKey(candidate)))
          .map((candidate, index) => ({
            id: randomUUID(),
            userId,
            emotionRecordId,
            tmdbId: candidate.tmdbId,
            mediaType: candidate.mediaType,
            title: candidate.title.slice(0, 300),
            overview: candidate.overview ?? null,
            posterPath: candidate.posterPath ?? null,
            backdropPath: candidate.backdropPath ?? null,
            releaseDate: releaseDateToDate(candidate.releaseDate),
            voteAverage: candidate.voteAverage ?? null,
            position: maxPosition + index + 1,
            createdAt: now
          }));

        if (toCreate.length > 0) {
          await tx.recommendation.createMany({ data: toCreate });
        }

        return toCreate;
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw persistenceWriteError();
    }
  }

  async function collectCandidates({ goal, keywordIds, seen, state }) {
    let moviePage = state.moviePage;
    let tvPage = state.tvPage;
    let movieExhausted = state.movieExhausted;
    let tvExhausted = state.tvExhausted;
    let moviePagesFetched = 0;
    let tvPagesFetched = 0;
    const selectedMovies = [];
    const selectedTv = [];

    async function fetchAndSelect(mediaType) {
      const isMovie = mediaType === MEDIA_TYPES.MOVIE;
      const page = isMovie ? moviePage : tvPage;
      const discover = isMovie
        ? dependencies.discoverMovies
        : dependencies.discoverTv;
      const selected = isMovie ? selectedMovies : selectedTv;
      const response = await discover({
        genreIds: getGoalGenres(goal, mediaType),
        withoutGenreIds: getExcludedGenreIds(mediaType),
        keywordIds,
        page
      });
      const candidates = response.results
        .filter((candidate) => !isCandidateExcluded(candidate, mediaType, goal))
        .filter((candidate) => !seen.has(candidateKey(candidate)))
        .map((candidate) => ({
          ...candidate,
          ...scoreCandidate(candidate, goal, {
            mediaType,
            keywordMatch: keywordIds.length > 0
          })
        }))
        .sort((left, right) => right.totalScore - left.totalScore);

      for (const candidate of candidates) {
        if (selected.length >= BATCH_SIZE_PER_MEDIA) {
          break;
        }

        const key = candidateKey(candidate);

        if (seen.has(key)) {
          continue;
        }

        selected.push(candidate);
        seen.add(key);
      }

      const exhausted = response.results.length === 0
        || page >= response.totalPages
        || page >= MAX_TMDB_PAGE;
      const nextPage = exhausted ? page : page + 1;

      if (isMovie) {
        movieExhausted = exhausted;
        moviePage = nextPage;
        moviePagesFetched += 1;
      } else {
        tvExhausted = exhausted;
        tvPage = nextPage;
        tvPagesFetched += 1;
      }
    }

    while (
      (!movieExhausted && selectedMovies.length < BATCH_SIZE_PER_MEDIA && moviePagesFetched < MAX_PAGES_PER_MEDIA)
      || (!tvExhausted && selectedTv.length < BATCH_SIZE_PER_MEDIA && tvPagesFetched < MAX_PAGES_PER_MEDIA)
    ) {
      const requests = [];

      if (!movieExhausted && selectedMovies.length < BATCH_SIZE_PER_MEDIA && moviePagesFetched < MAX_PAGES_PER_MEDIA) {
        requests.push(fetchAndSelect(MEDIA_TYPES.MOVIE));
      }

      if (!tvExhausted && selectedTv.length < BATCH_SIZE_PER_MEDIA && tvPagesFetched < MAX_PAGES_PER_MEDIA) {
        requests.push(fetchAndSelect(MEDIA_TYPES.TV));
      }

      if (requests.length === 0) {
        break;
      }

      await Promise.all(requests);
    }

    const byScore = (left, right) => right.totalScore - left.totalScore;

    return {
      selected: [
        ...selectedMovies.sort(byScore),
        ...selectedTv.sort(byScore)
      ],
      moviePage,
      tvPage,
      movieExhausted,
      tvExhausted
    };
  }

  async function generate({ userId, emotionRecordId, cursor, authorization }) {
    const state = cursor
      ? dependencies.decodeCursor(cursor)
      : createInitialState(userId, emotionRecordId);

    if (state.userId !== userId || state.emotionRecordId !== emotionRecordId) {
      throw forbiddenCursorError();
    }

    const emotionRecord = await dependencies.getEmotionRecord(emotionRecordId, {
      authorization
    });
    const goal = getGoalForEmotion(emotionRecord.emotion);

    if (!goal) {
      throw unsupportedEmotionError();
    }

    const keywordIds = await dependencies.resolveKeywordIds(goal.themes);

    if (keywordIds.length === 0) {
      throw unavailableKeywordsError();
    }

    const existingKeys = await loadExistingKeys(userId, emotionRecordId);
    const seen = new Set([...existingKeys, ...state.delivered]);
    const selection = await collectCandidates({
      goal,
      keywordIds,
      seen,
      state
    });
    const hasMore = !(selection.movieExhausted && selection.tvExhausted);
    const delivered = [
      ...new Set([...state.delivered, ...selection.selected.map(candidateKey)])
    ];
    const nextCursor = hasMore
      ? dependencies.encodeCursor({
        userId,
        emotionRecordId,
        moviePage: selection.moviePage,
        tvPage: selection.tvPage,
        movieExhausted: selection.movieExhausted,
        tvExhausted: selection.tvExhausted,
        delivered
      })
      : null;
    const persisted = await persistSelection(
      userId,
      emotionRecordId,
      selection.selected
    );

    return {
      data: persisted.map(serializeRecommendation),
      pagination: {
        limit: RESPONSE_LIMIT,
        returned: persisted.length,
        movieCount: persisted.filter((row) => row.mediaType === MEDIA_TYPES.MOVIE).length,
        tvCount: persisted.filter((row) => row.mediaType === MEDIA_TYPES.TV).length,
        hasMore,
        nextCursor
      }
    };
  }

  async function list({
    userId,
    emotionRecordId,
    from,
    to,
    page = 1,
    limit = 10
  }) {
    const where = { userId };

    if (emotionRecordId !== undefined) {
      where.emotionRecordId = emotionRecordId;
    }

    if (from !== undefined || to !== undefined) {
      where.createdAt = {
        ...(from === undefined ? {} : { gte: new Date(from) }),
        ...(to === undefined ? {} : { lte: new Date(to) })
      };
    }

    try {
      return await dependencies.withUserContext(userId, async (tx) => {
        const total = await tx.recommendation.count({ where });
        const rows = await tx.recommendation.findMany({
          where,
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' }
          ],
          skip: (page - 1) * limit,
          take: limit
        });

        return {
          data: rows.map(serializeRecommendation),
          pagination: {
            page,
            limit,
            total
          }
        };
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw persistenceReadError();
    }
  }

  return {
    generate,
    list
  };
}

export const recommendationService = createRecommendationService();
