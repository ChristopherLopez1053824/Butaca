const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Error al comunicarse con Butaca');
  }

  return data;
}

export function checkGateway() {
  return apiRequest('/health');
}

export function checkService(service) {
  return apiRequest(`/api/${service}/health`);
}
