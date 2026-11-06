import { getSupabaseClient } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function getAccessToken() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message || 'No se pudo obtener la sesión de Supabase');
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error('Debes iniciar sesión para realizar esta solicitud');
  }

  return accessToken;
}

export async function apiRequest(path, options = {}) {
  const { auth = true, headers, ...requestOptions } = options;
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };

  if (auth) {
    const accessToken = await getAccessToken();
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: requestHeaders
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Error al comunicarse con Butaca');
  }

  return data;
}

export function checkGateway() {
  return apiRequest('/health', { auth: false });
}

export function checkService(service) {
  return apiRequest(`/api/${service}/health`);
}
