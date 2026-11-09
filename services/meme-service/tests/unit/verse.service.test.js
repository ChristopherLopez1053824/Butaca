import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
  env: {
    BIBLE_API_PROVIDER: 'api.bible',
    BIBLE_API_TRANSLATION: 'RVR1960'
  }
}));

const { getPassage } = vi.hoisted(() => ({ getPassage: vi.fn() }));

vi.mock('../../src/clients/bible.client.js', () => ({ getPassage }));

const { getVerseForEmotion } = await import('../../src/services/verse.service.js');
const { EMOTION_VERSE_CATALOG } = await import('../../src/domain/emotion-verse-catalog.js');

beforeEach(() => {
  getPassage.mockReset();
});

describe('verse.service', () => {
  it('pide al proveedor una de las referencias configuradas para la emoción', async () => {
    getPassage.mockResolvedValue({
      content: 'Texto del versículo',
      reference: 'Filipenses 4:4',
      copyright: '© Sociedades Bíblicas Unidas'
    });

    const verse = await getVerseForEmotion('HAPPY');

    const validIds = EMOTION_VERSE_CATALOG.HAPPY.map((entry) => entry.id);
    expect(validIds).toContain(verse.externalId);
    expect(getPassage).toHaveBeenCalledWith(verse.externalId);
    expect(verse).toEqual({
      provider: 'api.bible',
      translation: 'RVR1960',
      externalId: verse.externalId,
      reference: 'Filipenses 4:4',
      theme: expect.any(String),
      text: 'Texto del versículo',
      copyright: '© Sociedades Bíblicas Unidas'
    });
  });

  it('es insensible a mayúsculas/minúsculas en la emoción', async () => {
    getPassage.mockResolvedValue({
      content: 'Texto',
      reference: 'Ref',
      copyright: '© copyright'
    });

    await getVerseForEmotion('sad');

    expect(getPassage).toHaveBeenCalledTimes(1);
  });

  it('rechaza con VALIDATION_ERROR si la emoción no tiene catálogo', async () => {
    await expect(getVerseForEmotion('CONTEMPT')).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
    expect(getPassage).not.toHaveBeenCalled();
  });

  it('propaga el error del cliente si el proveedor falla', async () => {
    getPassage.mockRejectedValue(
      Object.assign(new Error('no disponible'), {
        statusCode: 503,
        code: 'SERVICE_NOT_CONFIGURED'
      })
    );

    await expect(getVerseForEmotion('HAPPY')).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_NOT_CONFIGURED'
    });
  });
});
