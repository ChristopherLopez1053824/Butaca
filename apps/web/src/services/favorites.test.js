import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';
import { createFavorite, deleteFavorite, listFavorites } from './favorites';

vi.mock('./api', () => ({
  apiRequest: vi.fn()
}));

const mockedApiRequest = vi.mocked(apiRequest);

const favorite = {
  id: 'favorite-1',
  tmdbId: 550,
  mediaType: 'MOVIE',
  title: 'Fight Club',
  posterPath: '/poster.jpg',
  releaseDate: '1999-10-15',
  voteAverage: 8.4,
  createdAt: '2026-11-08T20:00:00.000Z',
  updatedAt: '2026-11-08T20:00:00.000Z'
};

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe('listFavorites', () => {
  it('consulta sin parámetros cuando no se envían', async () => {
    mockedApiRequest.mockResolvedValue({
      status: 'ok',
      data: [favorite],
      pagination: { page: 1, limit: 20, total: 1 }
    });

    const result = await listFavorites();

    expect(result).toEqual({
      data: [favorite],
      pagination: { page: 1, limit: 20, total: 1 }
    });
    expect(mockedApiRequest).toHaveBeenCalledWith('/api/favorites');
  });

  it('incluye page y limit en la query string', async () => {
    mockedApiRequest.mockResolvedValue({
      status: 'ok',
      data: [],
      pagination: { page: 2, limit: 5, total: 0 }
    });

    await listFavorites({ page: 2, limit: 5 });

    expect(mockedApiRequest).toHaveBeenCalledWith('/api/favorites?page=2&limit=5');
  });
});

describe('createFavorite', () => {
  it('envía el payload y devuelve el favorito creado', async () => {
    mockedApiRequest.mockResolvedValue({ status: 'ok', data: favorite });

    const input = {
      tmdbId: 550,
      mediaType: 'MOVIE',
      title: 'Fight Club',
      posterPath: '/poster.jpg',
      releaseDate: '1999-10-15',
      voteAverage: 8.4
    };

    const result = await createFavorite(input);

    expect(result).toEqual(favorite);
    expect(mockedApiRequest).toHaveBeenCalledWith('/api/favorites', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  });
});

describe('deleteFavorite', () => {
  it('elimina el favorito por id', async () => {
    mockedApiRequest.mockResolvedValue(null);

    await deleteFavorite('favorite-1');

    expect(mockedApiRequest).toHaveBeenCalledWith('/api/favorites/favorite-1', {
      method: 'DELETE'
    });
  });

  it('codifica el id en la URL', async () => {
    mockedApiRequest.mockResolvedValue(null);

    await deleteFavorite('id con espacio');

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/api/favorites/id%20con%20espacio',
      { method: 'DELETE' }
    );
  });
});
