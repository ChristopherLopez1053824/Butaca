import { apiRequest } from './api';

export async function requestRecommendations({ emotionRecordId, cursor }) {
  const payload = { emotionRecordId };

  if (cursor !== undefined) {
    payload.cursor = cursor;
  }

  const response = await apiRequest('/api/movies/recommendations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return {
    data: response.data,
    pagination: response.pagination
  };
}
