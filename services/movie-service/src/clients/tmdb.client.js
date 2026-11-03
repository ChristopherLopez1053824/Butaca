import { env } from '../config/env.js';
import { AppError, ERROR_CODES } from '../errors.js';

const TMDB_TIMEOUT_MS = 5000;

function invalidResponseError() {
  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message: 'TMDB devolvió una respuesta inválida'
  });
}

function upstreamError() {
  return new AppError({
    statusCode: 502,
    code: ERROR_CODES.UPSTREAM_ERROR,
    message: 'TMDB no está disponible'
  });
}

function isTimeoutError(error) {
  return error?.name === 'TimeoutError';
}

function buildUrl(pathname, params = {}) {
  const baseUrl = env.TMDB_BASE_URL.replace(/\/+$/, '');
  const url = new URL(`${baseUrl}${pathname}`);

  url.searchParams.set('api_key', env.TMDB_API_KEY);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function requestJson(pathname, { params, notFoundMessage } = {}) {
  const url = buildUrl(pathname, params);
  let response;

  try {
    response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS)
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new AppError({
        statusCode: 504,
        code: ERROR_CODES.GATEWAY_TIMEOUT,
        message: 'TMDB no respondió a tiempo'
      });
    }

    throw upstreamError();
  }

  if (response.status === 404) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: notFoundMessage ?? 'El recurso solicitado no existe en TMDB'
    });
  }

  if (!response.ok) {
    throw upstreamError();
  }

  try {
    return await response.json();
  } catch {
    throw invalidResponseError();
  }
}

function normalizeGenres(genres) {
  if (genres === undefined || genres === null) {
    return [];
  }

  if (!Array.isArray(genres)) {
    throw invalidResponseError();
  }

  return genres
    .filter((genre) => (
      genre
      && typeof genre.id === 'number'
      && typeof genre.name === 'string'
    ))
    .map((genre) => ({
      id: genre.id,
      name: genre.name
    }));
}

function normalizeMedia(data, mediaType) {
  const isMovie = mediaType === 'MOVIE';
  const title = isMovie ? data?.title : data?.name;
  const releaseDate = isMovie ? data?.release_date : data?.first_air_date;

  if (
    !data
    || typeof data !== 'object'
    || !Number.isInteger(data.id)
    || data.id <= 0
    || typeof title !== 'string'
    || title.length === 0
  ) {
    throw invalidResponseError();
  }

  return {
    tmdbId: data.id,
    mediaType,
    title,
    overview: typeof data.overview === 'string' ? data.overview : '',
    posterPath: typeof data.poster_path === 'string' ? data.poster_path : null,
    backdropPath: typeof data.backdrop_path === 'string' ? data.backdrop_path : null,
    releaseDate: typeof releaseDate === 'string' && releaseDate.length > 0
      ? releaseDate
      : null,
    voteAverage: typeof data.vote_average === 'number' ? data.vote_average : 0,
    genres: normalizeGenres(data.genres)
  };
}

function normalizeSearch(data, mediaType) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.results)) {
    throw invalidResponseError();
  }

  return {
    page: Number.isInteger(data.page) ? data.page : 1,
    totalPages: Number.isInteger(data.total_pages) ? data.total_pages : 0,
    totalResults: Number.isInteger(data.total_results) ? data.total_results : 0,
    results: data.results.map((item) => normalizeMedia(item, mediaType))
  };
}

function normalizeDiscoverItem(data, mediaType) {
  const normalized = normalizeMedia(data, mediaType);

  return {
    ...normalized,
    genreIds: Array.isArray(data.genre_ids)
      ? data.genre_ids.filter((genreId) => Number.isInteger(genreId))
      : [],
    voteCount: typeof data.vote_count === 'number' ? data.vote_count : 0
  };
}

function normalizeDiscover(data, mediaType) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.results)) {
    throw invalidResponseError();
  }

  return {
    page: Number.isInteger(data.page) ? data.page : 1,
    totalPages: Number.isInteger(data.total_pages) ? data.total_pages : 0,
    totalResults: Number.isInteger(data.total_results) ? data.total_results : 0,
    results: data.results.map((item) => normalizeDiscoverItem(item, mediaType))
  };
}

function normalizeKeywords(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.results)) {
    throw invalidResponseError();
  }

  return {
    page: Number.isInteger(data.page) ? data.page : 1,
    totalPages: Number.isInteger(data.total_pages) ? data.total_pages : 0,
    totalResults: Number.isInteger(data.total_results) ? data.total_results : 0,
    results: data.results
      .filter((keyword) => (
        keyword
        && Number.isInteger(keyword.id)
        && typeof keyword.name === 'string'
      ))
      .map((keyword) => ({
        id: keyword.id,
        name: keyword.name
      }))
  };
}

function buildDiscoverParams({
  genreIds = [],
  withoutGenreIds = [],
  keywordIds = [],
  page
} = {}) {
  return {
    with_genres: genreIds.join('|'),
    without_genres: withoutGenreIds.join('|'),
    with_keywords: keywordIds.join('|'),
    include_adult: false,
    page
  };
}

export async function getMovieDetails(tmdbId) {
  const data = await requestJson(`/movie/${tmdbId}`, {
    notFoundMessage: 'La película solicitada no existe'
  });

  return normalizeMedia(data, 'MOVIE');
}

export async function getTvDetails(tmdbId) {
  const data = await requestJson(`/tv/${tmdbId}`, {
    notFoundMessage: 'La serie solicitada no existe'
  });

  return normalizeMedia(data, 'TV');
}

export async function searchMovies(query, { page } = {}) {
  const data = await requestJson('/search/movie', {
    params: { query, page }
  });

  return normalizeSearch(data, 'MOVIE');
}

export async function searchTv(query, { page } = {}) {
  const data = await requestJson('/search/tv', {
    params: { query, page }
  });

  return normalizeSearch(data, 'TV');
}

export async function discoverMovies(options = {}) {
  const data = await requestJson('/discover/movie', {
    params: buildDiscoverParams(options)
  });

  return normalizeDiscover(data, 'MOVIE');
}

export async function discoverTv(options = {}) {
  const data = await requestJson('/discover/tv', {
    params: buildDiscoverParams(options)
  });

  return normalizeDiscover(data, 'TV');
}

export async function searchKeywords(query, { page } = {}) {
  const data = await requestJson('/search/keyword', {
    params: { query, page }
  });

  return normalizeKeywords(data);
}

export const tmdbClient = Object.freeze({
  getMovieDetails,
  getTvDetails,
  searchMovies,
  searchTv,
  discoverMovies,
  discoverTv,
  searchKeywords
});

export default tmdbClient;
