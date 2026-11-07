export interface ApiRequestOptions extends RequestInit {
  auth?: boolean
}

// Error que lanza apiRequest cuando la API responde con un código de error.
export interface ApiError extends Error {
  status?: number
  code?: string
  requestId?: string | null
}

export interface HealthResponse {
  status: string
  service?: string
  timestamp?: string
  message?: string
}

export function apiRequest<T = unknown>(
  path: string,
  options?: ApiRequestOptions,
): Promise<T>

export function checkGateway(): Promise<HealthResponse>

export function checkService(service: string): Promise<HealthResponse>
