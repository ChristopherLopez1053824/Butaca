import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app.js';
import {
  getMovieDetails,
  getTvDetails
} from '../../src/clients/tmdb.client.js';
import { AppError } from '../../src/errors.js';
import { signToken } from '../helpers/auth.js';

vi.mock('../../src/clients/tmdb.client.js', () => ({
  getMovieDetails: vi.fn(),
  getTvDetails: vi.fn(),
  searchMovies: vi.fn(),
  searchTv: vi.fn(),
  discoverMovies: vi.fn(),
  discoverTv: vi.fn(),
  searchKeywords: vi.fn()
}));

const MOVIE_DETAILS = {
  tmdbId: 550,
  mediaType: 'MOVIE',
  title: 'Fight Club',
  overview: 'Un empleado de oficina insomne...',
  posterPath: '/poster.jpg',
  backdropPath: '/backdrop.jpg',
  releaseDate: '1999-10-15',
  voteAverage: 8.4,
  genres: [{ id: 18, name: 'Drama' }]
};

const TV_DETAILS = {
  tmdbId: 1399,
  mediaType: 'TV',
  title: 'Game of Thrones',
  overview: 'Nobles familias luchan por el control...',
  posterPath: '/tv-poster.jpg',
  backdropPath: '/tv-backdrop.jpg',
  releaseDate: '2011-04-17',
  voteAverage: 8.5,
  genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }]
};

function authorized(requestBuilder) {
  return requestBuilder.set('Authorization', `Bearer ${signToken()}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /details/:tmdbId', () => {
  it('responde los detalles de una película', async () => {
    getMovieDetails.mockResolvedValue(MOVIE_DETAILS);

    const response = await authorized(
      request(app).get('/details/550?mediaType=MOVIE')
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      data: MOVIE_DETAILS
    });
    expect(getMovieDetails).toHaveBeenCalledWith(550);
    expect(getTvDetails).not.toHaveBeenCalled();
  });

  it('responde los detalles de una serie', async () => {
    getTvDetails.mockResolvedValue(TV_DETAILS);

    const response = await authorized(
      request(app).get('/details/1399?mediaType=TV')
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      data: TV_DETAILS
    });
    expect(getTvDetails).toHaveBeenCalledWith(1399);
    expect(getMovieDetails).not.toHaveBeenCalled();
  });

  it.each([
    '/details/abc?mediaType=MOVIE',
    '/details/0?mediaType=MOVIE',
    '/details/-1?mediaType=MOVIE',
    '/details/550',
    '/details/550?mediaType=ANIME'
  ])('responde 400 VALIDATION_ERROR para %s', async (path) => {
    const response = await authorized(request(app).get(path));

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details.length).toBeGreaterThan(0);
    expect(getMovieDetails).not.toHaveBeenCalled();
    expect(getTvDetails).not.toHaveBeenCalled();
  });

  it('responde 502 cuando TMDB no está disponible', async () => {
    getMovieDetails.mockRejectedValue(new AppError({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'TMDB no está disponible'
    }));

    const response = await authorized(
      request(app).get('/details/550?mediaType=MOVIE')
    );

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      status: 'error',
      code: 'UPSTREAM_ERROR',
      message: 'TMDB no está disponible',
      details: []
    });
  });

  it('exige autenticación antes de consultar TMDB', async () => {
    const response = await request(app).get('/details/550?mediaType=MOVIE');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(getMovieDetails).not.toHaveBeenCalled();
  });
});
