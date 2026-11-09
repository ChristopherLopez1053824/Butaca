import { apiRequest } from './api';

export async function createEmotion(payload) {
  const response = await apiRequest('/api/emotions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return response.data;
}
