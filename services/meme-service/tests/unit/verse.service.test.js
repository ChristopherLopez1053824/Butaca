import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
  env: {
    BIBLE_API_PROVIDER: 'api.bible',
    BIBLE_API_TRANSLATION: '592420522e16049f-01'
  }
}));

const { getPassage, getBibleInfo } = vi.hoisted(() => ({
  getPassage: vi.fn(),
  getBibleInfo: vi.fn()
}));

vi.mock('../../src/clients/bible.client.js', () => ({ getPassage, getBibleInfo }));

const { getVerseForEmotion } = await import('../../src/services/verse.service.js');
const { EMOTION_VERSE_CATALOG } = await import('../../src/domain/emotion-verse-catalog.js');

const bibleInfo = {
  id: '592420522e16049f-01',
  abbreviation: 'RVR09',
  name: 'Reina Valera 1909',
  copyright: 'Reina-Valera 1909 - Dominio público.'
};

beforeEach(() => {
  getPassage.mockReset();
  getBibleInfo.mockReset();
  getBibleInfo.mockResolvedValue(bibleInfo);
});

describe('verse.service', () => {
  it('pide al proveedor una de las referencias configuradas para la emoción', async () => {
    getPassage.mockResolvedValue({
      content: 'Texto del versículo',
      reference: 'Filipenses 4:4',
      copyright: 'Reina-Valera 1909 - Dominio público.'
    });

    const verse = await getVerseForEmotion('HAPPY');

    const validIds = EMOTION_VERSE_CATALOG.HAPPY.map((entry) => entry.id);
    expect(validIds).toContain(verse.externalId);
    expect(getPassage).toHaveBeenCalledWith(verse.externalId);
    expect(verse).toEqual({
      provider: 'api.bible',
      translation: 'RVR09',
      translationName: 'Reina Valera 1909',
      externalId: verse.externalId,
      reference: 'Filipenses 4:4',
      theme: expect.any(String),
      text: 'Texto del versículo',
      copyright: 'Reina-Valera 1909 - Dominio público.'
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

  it('acepta la solicitud cuando la traducción pedida coincide con la real (sin importar mayúsculas)', async () => {
    getPassage.mockResolvedValue({
      content: 'Texto',
      reference: 'Ref',
      copyright: '© copyright'
    });

    await getVerseForEmotion('HAPPY', { requestedTranslation: 'rvr09' });

    expect(getPassage).toHaveBeenCalledTimes(1);
  });

  it('rechaza con VALIDATION_ERROR si la traducción pedida no coincide con la real', async () => {
    await expect(
      getVerseForEmotion('HAPPY', { requestedTranslation: 'NVI' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });

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

  it('propaga el error si no se puede confirmar la traducción configurada', async () => {
    getBibleInfo.mockRejectedValue(
      Object.assign(new Error('no disponible'), {
        statusCode: 503,
        code: 'SERVICE_NOT_CONFIGURED'
      })
    );

    await expect(getVerseForEmotion('HAPPY')).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_NOT_CONFIGURED'
    });
    expect(getPassage).not.toHaveBeenCalled();
  });
});
