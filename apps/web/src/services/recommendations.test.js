import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';
import { requestRecommendations } from './recommendations';

vi.mock('./api', () => ({
  apiRequest: vi.fn()
}));

const mockedApiRequest = vi.mocked(apiRequest);

const recommendation = {
  id: 'recommendation-1',
  tmdbId: 550,
  mediaType: 'MOVIE',
  title: 'Fight Club',
  overview: 'Texto',
  posterPath: '/poster.jpg',
  backdropPath: null,
  releaseDate: '1999-10-15',
  voteAverage: 8.4,
  position: 1,
  createdAt: '2026-11-08T20:00:00.000Z'
};

const pagination = {
  limit: 20,
  returned: 1,
  movieCount: 1,
  tvCount: 0,
  hasMore: false,
  nextCursor: null
};

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe('requestRecommendations', () => {
  it('solicita recomendaciones para un registro emocional', async () => {
    mockedApiRequest.mockResolvedValue({
      status: 'ok',
      data: [recommendation],
      pagination
    });

    const result = await requestRecommendations({
      emotionRecordId: 'emotion-1'
    });

    expect(result).toEqual({ data: [recommendation], pagination });
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/api/movies/recommendations',
      {
        method: 'POST',
        body: JSON.stringify({ emotionRecordId: 'emotion-1' })
      }
    );
  });

  it('incluye el cursor cuando se solicita la siguiente página', async () => {
    mockedApiRequest.mockResolvedValue({
      status: 'ok',
      data: [],
      pagination: { ...pagination, returned: 0 }
    });

    await requestRecommendations({
      emotionRecordId: 'emotion-1',
      cursor: 'cursor-1'
    });

    expect(
      JSON.parse(mockedApiRequest.mock.calls[0][1].body)
    ).toEqual({
      emotionRecordId: 'emotion-1',
      cursor: 'cursor-1'
    });
  });
});
