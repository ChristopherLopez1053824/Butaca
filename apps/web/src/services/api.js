import { getSupabaseClient } from '../lib/supabase';
import { getRuntimeEnv } from '../lib/runtimeEnv';

// En desarrollo, si se accede desde otro dispositivo (por ejemplo un teléfono
// en la misma red) "localhost" apuntaría al propio teléfono. Usamos el host
// actual para que el API Gateway sea accesible desde ese dispositivo.
function defaultApiUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const { protocol, hostname } = window.location;

  return `${protocol}//${hostname}:3000`;
}

const API_URL = getRuntimeEnv('VITE_API_URL') || defaultApiUrl();

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

// Auto-Wake: le pide al Gateway que active los seis microservicios si
// estaban suspendidos (plan free de Render) y que luego informe su progreso.
export function triggerWake() {
  return apiRequest('/api/wake', { method: 'POST' });
}

export function getWakeStatus() {
  return apiRequest('/api/wake');
}
