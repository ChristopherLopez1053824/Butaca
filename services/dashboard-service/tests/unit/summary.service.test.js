import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listEmotionRecords,
  listRecommendationsForEmotion,
  getFavoritesCount
} = vi.hoisted(() => ({
  listEmotionRecords: vi.fn(),
  listRecommendationsForEmotion: vi.fn(),
  getFavoritesCount: vi.fn()
}));

vi.mock('../../src/clients/services.client.js', () => ({
  listEmotionRecords,
  listRecommendationsForEmotion,
  getFavoritesCount
}));

const { getSummary } = await import('../../src/services/summary.service.js');

const AUTHORIZATION = 'Bearer test-token';

function emotionRecord(overrides = {}) {
  return {
    id: 'emotion-1',
    userId: 'user-1',
    emotion: 'HAPPY',
    source: 'MANUAL',
    confidence: null,
    createdAt: '2026-11-01T20:00:00.000Z',
    ...overrides
  };
}

beforeEach(() => {
  listEmotionRecords.mockReset();
  listRecommendationsForEmotion.mockReset();
  getFavoritesCount.mockReset();
});

describe('getSummary', () => {
  it('agrupa el historial de emociones por fecha y agrega recomendaciones por emoción', async () => {
    listEmotionRecords.mockResolvedValue({
      data: [
        emotionRecord({ id: 'emotion-1', emotion: 'HAPPY', createdAt: '2026-11-01T20:00:00.000Z' }),
        emotionRecord({ id: 'emotion-2', emotion: 'HAPPY', createdAt: '2026-11-01T21:00:00.000Z' }),
        emotionRecord({ id: 'emotion-3', emotion: 'SAD', createdAt: '2026-11-02T10:00:00.000Z' })
      ],
      pagination: { page: 1, limit: 100, total: 3, hasNextPage: false }
    });
    listRecommendationsForEmotion.mockImplementation(async (emotionRecordId) => {
      if (emotionRecordId === 'emotion-1') {
        return [{ mediaType: 'MOVIE' }, { mediaType: 'MOVIE' }];
      }

      if (emotionRecordId === 'emotion-2') {
        return [{ mediaType: 'TV' }];
      }

      return [];
    });
    getFavoritesCount.mockResolvedValue(4);

    const summary = await getSummary({ authorization: AUTHORIZATION });

    expect(summary.emotionTimeline).toEqual([
      { date: '2026-11-01', emotion: 'HAPPY', count: 2 },
      { date: '2026-11-02', emotion: 'SAD', count: 1 }
    ]);
    expect(summary.recommendationsByEmotion).toEqual([
      { emotion: 'HAPPY', mediaType: 'MOVIE', count: 2 },
      { emotion: 'HAPPY', mediaType: 'TV', count: 1 }
    ]);
    expect(summary.favoritesCount).toBe(4);
    expect(summary.unavailable).toEqual([]);
    expect(listEmotionRecords).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100, authorization: AUTHORIZATION })
    );
  });

  it('pagina el historial de emociones hasta agotar hasNextPage', async () => {
    listEmotionRecords
      .mockResolvedValueOnce({
        data: [emotionRecord({ id: 'emotion-1' })],
        pagination: { page: 1, limit: 100, total: 2, hasNextPage: true }
      })
      .mockResolvedValueOnce({
        data: [emotionRecord({ id: 'emotion-2' })],
        pagination: { page: 2, limit: 100, total: 2, hasNextPage: false }
      });
    listRecommendationsForEmotion.mockResolvedValue([]);
    getFavoritesCount.mockResolvedValue(0);

    await getSummary({ authorization: AUTHORIZATION });

    expect(listEmotionRecords).toHaveBeenCalledTimes(2);
    expect(listEmotionRecords).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 1 })
    );
    expect(listEmotionRecords).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2 })
    );
  });

  it('marca emotions como no disponible y conserva favoritos si Emotion Service falla', async () => {
    listEmotionRecords.mockRejectedValue(new Error('Emotion Service no está disponible'));
    getFavoritesCount.mockResolvedValue(7);

    const summary = await getSummary({ authorization: AUTHORIZATION });

    expect(summary.emotionTimeline).toEqual([]);
    expect(summary.recommendationsByEmotion).toEqual([]);
    expect(summary.favoritesCount).toBe(7);
    expect(summary.unavailable).toEqual(['emotions']);
    expect(listRecommendationsForEmotion).not.toHaveBeenCalled();
  });

  it('marca movies como no disponible si falla la consulta de recomendaciones', async () => {
    listEmotionRecords.mockResolvedValue({
      data: [emotionRecord()],
      pagination: { page: 1, limit: 100, total: 1, hasNextPage: false }
    });
    listRecommendationsForEmotion.mockRejectedValue(new Error('Movie Service no está disponible'));
    getFavoritesCount.mockResolvedValue(0);

    const summary = await getSummary({ authorization: AUTHORIZATION });

    expect(summary.recommendationsByEmotion).toEqual([]);
    expect(summary.unavailable).toEqual(['movies']);
  });

  it('marca favorites como no disponible y conserva el resto si falla', async () => {
    listEmotionRecords.mockResolvedValue({
      data: [emotionRecord()],
      pagination: { page: 1, limit: 100, total: 1, hasNextPage: false }
    });
    listRecommendationsForEmotion.mockResolvedValue([{ mediaType: 'MOVIE' }]);
    getFavoritesCount.mockRejectedValue(new Error('Favorites Service no está disponible'));

    const summary = await getSummary({ authorization: AUTHORIZATION });

    expect(summary.favoritesCount).toBe(0);
    expect(summary.unavailable).toEqual(['favorites']);
    expect(summary.recommendationsByEmotion).toEqual([
      { emotion: 'HAPPY', mediaType: 'MOVIE', count: 1 }
    ]);
  });

  it('no consulta recomendaciones cuando no hay registros de emociones', async () => {
    listEmotionRecords.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, total: 0, hasNextPage: false }
    });
    getFavoritesCount.mockResolvedValue(0);

    const summary = await getSummary({ authorization: AUTHORIZATION });

    expect(listRecommendationsForEmotion).not.toHaveBeenCalled();
    expect(summary.recommendationsByEmotion).toEqual([]);
    expect(summary.unavailable).toEqual([]);
  });
});
