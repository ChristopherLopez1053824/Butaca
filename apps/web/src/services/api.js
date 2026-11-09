import { getSupabaseClient } from '../lib/supabase';
import { getRuntimeEnv } from '../lib/runtimeEnv';

const API_URL = getRuntimeEnv('VITE_API_URL') || 'http://localhost:3000';

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

// Algunas respuestas no traen JSON, como el 204 al eliminar un favorito
// o una página de error del hosting. En esos casos devuelve null.
async function readBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

  const data = await readBody(response);

  if (!response.ok) {
    const error = new Error(data?.message || 'Error al comunicarse con Butaca');
    error.status = response.status;
    error.code = data?.code;
    error.requestId = response.headers.get('x-request-id');
    throw error;
  }

  return data;
}

export function checkGateway() {
  return apiRequest('/health', { auth: false });
}

export function checkService(service) {
  return apiRequest(`/api/${service}/health`);
}
