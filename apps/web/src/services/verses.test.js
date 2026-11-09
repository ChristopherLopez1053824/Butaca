import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';
import { getVerseForEmotion, recordVerseHistory } from './verses';

vi.mock('./api', () => ({
  apiRequest: vi.fn()
}));

const mockedApiRequest = vi.mocked(apiRequest);

const verse = {
  provider: 'api.bible',
  translation: 'RVR1960',
  externalId: 'JHN.3.16',
  reference: 'Juan 3:16',
  theme: 'esperanza',
  text: 'Porque de tal manera amó Dios al mundo...',
  copyright: '© Sociedades Bíblicas Unidas'
};

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe('getVerseForEmotion', () => {
  it('consulta la emoción sin traducción cuando no se especifica', async () => {
    mockedApiRequest.mockResolvedValue({ status: 'ok', data: verse });

    const result = await getVerseForEmotion({ emotion: 'HAPPY' });

    expect(result).toEqual(verse);
    expect(mockedApiRequest).toHaveBeenCalledWith('/api/memes?emotion=HAPPY');
  });

  it('incluye la traducción cuando se especifica', async () => {
    mockedApiRequest.mockResolvedValue({ status: 'ok', data: verse });

    await getVerseForEmotion({ emotion: 'HAPPY', translation: 'RVR1960' });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/api/memes?emotion=HAPPY&translation=RVR1960'
    );
  });
});

describe('recordVerseHistory', () => {
  it('envía el payload mínimo', async () => {
    mockedApiRequest.mockResolvedValue({ status: 'ok', data: {} });

    await recordVerseHistory({ provider: 'RVR1960', externalId: 'JHN.3.16' });

    expect(mockedApiRequest).toHaveBeenCalledWith('/api/memes/history', {
      method: 'POST',
      body: JSON.stringify({ provider: 'RVR1960', externalId: 'JHN.3.16' })
    });
  });

  it('incluye title y emotionRecordId cuando se envían', async () => {
    mockedApiRequest.mockResolvedValue({ status: 'ok', data: {} });

    await recordVerseHistory({
      provider: 'RVR1960',
      externalId: 'JHN.3.16',
      title: 'Juan 3:16 (RVR1960)',
      emotionRecordId: 'emotion-1'
    });

    expect(JSON.parse(mockedApiRequest.mock.calls[0][1].body)).toEqual({
      provider: 'RVR1960',
      externalId: 'JHN.3.16',
      title: 'Juan 3:16 (RVR1960)',
      emotionRecordId: 'emotion-1'
    });
  });
});
