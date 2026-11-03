import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  discoverMovies,
  discoverTv,
  getMovieDetails,
  getTvDetails,
  searchKeywords,
  searchMovies,
  searchTv
} from '../../src/clients/tmdb.client.js';

const MOVIE_RESPONSE = {
  id: 550,
  title: 'Fight Club',
  overview: 'Un empleado de oficina insomne...',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  release_date: '1999-10-15',
  vote_average: 8.4,
  genres: [
    { id: 18, name: 'Drama' },
    { id: 53, name: 'Thriller' }
  ]
};

const TV_RESPONSE = {
  id: 1399,
  name: 'Game of Thrones',
  overview: 'Nobles familias luchan por el control...',
  poster_path: '/tv-poster.jpg',
  backdrop_path: '/tv-backdrop.jpg',
  first_air_date: '2011-04-17',
  vote_average: 8.5,
  genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }]
};

let fetchMock;

function mockResponse({ status = 200, body, jsonError } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jsonError
      ? vi.fn().mockRejectedValue(jsonError)
      : vi.fn().mockResolvedValue(body)
  };
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('tmdb client', () => {
  it('construye la petición de detalles con la API Key y el timeout', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: MOVIE_RESPONSE }));

    await getMovieDetails(550);

    const [requestUrl, options] = fetchMock.mock.calls[0];
    const url = new URL(requestUrl);

    expect(url.origin).toBe('https://api.themoviedb.org');
    expect(url.pathname).toBe('/3/movie/550');
    expect(url.searchParams.get('api_key')).toBe(process.env.TMDB_API_KEY);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('construye la búsqueda de películas con query y página', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: {
        page: 2,
        total_pages: 10,
        total_results: 200,
        results: [MOVIE_RESPONSE]
      }
    }));

    await searchMovies('fight club', { page: 2 });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/3/search/movie');
    expect(url.searchParams.get('query')).toBe('fight club');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('api_key')).toBe(process.env.TMDB_API_KEY);
  });

  it('construye la búsqueda de series con query', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: {
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [TV_RESPONSE]
      }
    }));

    await searchTv('game of thrones');

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/3/search/tv');
    expect(url.searchParams.get('query')).toBe('game of thrones');
    expect(url.searchParams.get('api_key')).toBe(process.env.TMDB_API_KEY);
  });

  it('normaliza correctamente los detalles de una película', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: MOVIE_RESPONSE }));

    await expect(getMovieDetails(550)).resolves.toEqual({
      tmdbId: 550,
      mediaType: 'MOVIE',
      title: 'Fight Club',
      overview: 'Un empleado de oficina insomne...',
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      releaseDate: '1999-10-15',
      voteAverage: 8.4,
      genres: [
        { id: 18, name: 'Drama' },
        { id: 53, name: 'Thriller' }
      ]
    });
  });

  it('normaliza correctamente los detalles de una serie', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: TV_RESPONSE }));

    await expect(getTvDetails(1399)).resolves.toEqual({
      tmdbId: 1399,
      mediaType: 'TV',
      title: 'Game of Thrones',
      overview: 'Nobles familias luchan por el control...',
      posterPath: '/tv-poster.jpg',
      backdropPath: '/tv-backdrop.jpg',
      releaseDate: '2011-04-17',
      voteAverage: 8.5,
      genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }]
    });
  });

  it('responde NOT_FOUND cuando la película no existe', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 404 }));

    await expect(getMovieDetails(999999)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'La película solicitada no existe'
    });
  });

  it('responde NOT_FOUND cuando la serie no existe', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 404 }));

    await expect(getTvDetails(999999)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'La serie solicitada no existe'
    });
  });

  it('normaliza un error HTTP de TMDB como UPSTREAM_ERROR', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 500 }));

    const error = await getMovieDetails(550).catch((caught) => caught);

    expect(error).toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'TMDB no está disponible'
    });
    expect(error.message).not.toContain(process.env.TMDB_API_KEY);
  });

  it('normaliza un timeout como GATEWAY_TIMEOUT', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeoutError);

    await expect(getMovieDetails(550)).rejects.toMatchObject({
      statusCode: 504,
      code: 'GATEWAY_TIMEOUT',
      message: 'TMDB no respondió a tiempo'
    });
  });

  it('normaliza una respuesta JSON inválida como UPSTREAM_ERROR', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      jsonError: new SyntaxError('JSON inválido')
    }));

    await expect(getMovieDetails(550)).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'TMDB devolvió una respuesta inválida'
    });
  });

  it('normaliza una respuesta con estructura inválida como UPSTREAM_ERROR', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: { id: '550', title: 'Inválida' }
    }));

    await expect(getMovieDetails(550)).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'TMDB devolvió una respuesta inválida'
    });
  });

  it('construye Discover de películas con géneros, exclusiones y keywords', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: {
        page: 2,
        total_pages: 5,
        total_results: 100,
        results: [{
          ...MOVIE_RESPONSE,
          genre_ids: [35, 16],
          vote_count: 1234
        }]
      }
    }));

    const result = await discoverMovies({
      genreIds: [35, 16],
      withoutGenreIds: [18, 27],
      keywordIds: [1, 2],
      page: 2
    });
    const url = new URL(fetchMock.mock.calls[0][0]);

    expect(url.pathname).toBe('/3/discover/movie');
    expect(url.searchParams.get('with_genres')).toBe('35|16');
    expect(url.searchParams.get('without_genres')).toBe('18|27');
    expect(url.searchParams.get('with_keywords')).toBe('1|2');
    expect(url.searchParams.get('include_adult')).toBe('false');
    expect(url.searchParams.get('page')).toBe('2');
    expect(result.results[0]).toMatchObject({
      tmdbId: 550,
      genreIds: [35, 16],
      voteCount: 1234
    });
  });

  it('construye Discover de series', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: {
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{
          ...TV_RESPONSE,
          genre_ids: [16, 10751],
          vote_count: 500
        }]
      }
    }));

    await discoverTv({
      genreIds: [16, 10751],
      withoutGenreIds: [18],
      keywordIds: [3],
      page: 1
    });
    const url = new URL(fetchMock.mock.calls[0][0]);

    expect(url.pathname).toBe('/3/discover/tv');
    expect(url.searchParams.get('with_genres')).toBe('16|10751');
    expect(url.searchParams.get('without_genres')).toBe('18');
    expect(url.searchParams.get('with_keywords')).toBe('3');
  });

  it('busca keywords reales en TMDB', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      body: {
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{ id: 9715, name: 'superhero' }]
      }
    }));

    const result = await searchKeywords('superhero');
    const url = new URL(fetchMock.mock.calls[0][0]);

    expect(url.pathname).toBe('/3/search/keyword');
    expect(url.searchParams.get('query')).toBe('superhero');
    expect(result.results).toEqual([{ id: 9715, name: 'superhero' }]);
  });
});
