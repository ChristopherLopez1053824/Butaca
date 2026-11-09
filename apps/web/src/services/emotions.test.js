import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';
import { createEmotion } from './emotions';

vi.mock('./api', () => ({
  apiRequest: vi.fn()
}));

const mockedApiRequest = vi.mocked(apiRequest);

const record = {
  id: 'emotion-1',
  userId: 'user-1',
  emotion: 'HAPPY',
  source: 'CAMERA',
  confidence: 0.92,
  createdAt: '2026-11-08T20:00:00.000Z'
};

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe('createEmotion', () => {
  it('envía la emoción al Gateway y devuelve el registro creado', async () => {
    mockedApiRequest.mockResolvedValue({ status: 'ok', data: record });

    const result = await createEmotion({
      emotion: 'HAPPY',
      source: 'CAMERA',
      confidence: 0.92
    });

    expect(result).toEqual(record);
    expect(mockedApiRequest).toHaveBeenCalledWith('/api/emotions', {
      method: 'POST',
      body: JSON.stringify({
        emotion: 'HAPPY',
        source: 'CAMERA',
        confidence: 0.92
      })
    });
  });
});
