import { apiRequest } from './api';

export async function getDashboardSummary({ from, to } = {}) {
  const params = new URLSearchParams();

  if (from !== undefined) {
    params.set('from', from);
  }

  if (to !== undefined) {
    params.set('to', to);
  }

  const query = params.toString();
  const response = await apiRequest(`/api/dashboard/summary${query ? `?${query}` : ''}`);

  return response.data;
}
