import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearKeywordCache,
  resolveKeywordIds
} from '../../src/services/recommendation-keywords.service.js';

describe('recommendation keywords', () => {
  beforeEach(() => {
    clearKeywordCache();
  });

  it('resuelve coincidencias exactas ignorando mayúsculas y acentos', async () => {
    const search = vi.fn()
      .mockResolvedValueOnce({
        results: [
          { id: 1, name: 'Friendship' },
          { id: 2, name: 'Friendship breakup' }
        ]
      })
      .mockResolvedValueOnce({
        results: [{ id: 3, name: 'Humor' }]
      });

    await expect(resolveKeywordIds(['friendship', 'humor'], { search }))
      .resolves.toEqual([1, 3]);
  });

  it('deduplica términos y usa la caché', async () => {
    const search = vi.fn().mockResolvedValue({
      results: [{ id: 7, name: 'Adventure' }]
    });
    const now = 1000;

    await expect(resolveKeywordIds(['adventure', 'Adventure'], { search, now }))
      .resolves.toEqual([7]);
    await expect(resolveKeywordIds(['adventure'], { search, now: now + 1000 }))
      .resolves.toEqual([7]);

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('ignora términos sin coincidencia exacta', async () => {
    const search = vi.fn().mockResolvedValue({
      results: [{ id: 7, name: 'Adventureland' }]
    });

    await expect(resolveKeywordIds(['adventure'], { search })).resolves.toEqual([]);
  });
});
