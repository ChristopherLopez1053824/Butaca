import { apiRequest } from './api';

export async function getVerseForEmotion({ emotion, translation }) {
  const params = new URLSearchParams({ emotion });

  if (translation !== undefined) {
    params.set('translation', translation);
  }

  const response = await apiRequest(`/api/memes?${params.toString()}`);

  return response.data;
}

export async function recordVerseHistory({ provider, externalId, title, emotionRecordId }) {
  const payload = { provider, externalId };

  if (title !== undefined) {
    payload.title = title;
  }

  if (emotionRecordId !== undefined) {
    payload.emotionRecordId = emotionRecordId;
  }

  const response = await apiRequest('/api/memes/history', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return response.data;
}
