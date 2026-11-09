import { apiRequest } from './api';

export async function listFavorites({ page, limit } = {}) {
  const params = new URLSearchParams();

  if (page !== undefined) {
    params.set('page', String(page));
  }

  if (limit !== undefined) {
    params.set('limit', String(limit));
  }

  const query = params.toString();
  const response = await apiRequest(`/api/favorites${query ? `?${query}` : ''}`);

  return {
    data: response.data,
    pagination: response.pagination
  };
}

export async function createFavorite(input) {
  const response = await apiRequest('/api/favorites', {
    method: 'POST',
    body: JSON.stringify(input)
  });

  return response.data;
}

export async function deleteFavorite(id) {
  await apiRequest(`/api/favorites/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}
