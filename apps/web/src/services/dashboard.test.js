import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';
import { getDashboardSummary } from './dashboard';

vi.mock('./api', () => ({
  apiRequest: vi.fn()
}));

const mockedApiRequest = vi.mocked(apiRequest);

const summary = {
  emotionTimeline: [{ date: '2026-11-01', emotion: 'HAPPY', count: 2 }],
  recommendationsByEmotion: [{ emotion: 'HAPPY', mediaType: 'MOVIE', count: 10 }],
  favoritesCount: 4,
  unavailable: []
};

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe('getDashboardSummary', () => {
  it('consulta sin parámetros cuando no se envía un rango', async () => {
    mockedApiRequest.mockResolvedValue({ status: 'ok', data: summary });

    const result = await getDashboardSummary();

    expect(result).toEqual(summary);
    expect(mockedApiRequest).toHaveBeenCalledWith('/api/dashboard/summary');
  });

  it('incluye from y to en la query string', async () => {
    mockedApiRequest.mockResolvedValue({ status: 'ok', data: summary });

    await getDashboardSummary({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-08T00:00:00.000Z'
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/api/dashboard/summary?from=2026-11-01T00%3A00%3A00.000Z&to=2026-11-08T00%3A00%3A00.000Z'
    );
  });
});
