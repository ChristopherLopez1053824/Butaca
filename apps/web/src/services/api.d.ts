export interface ApiRequestOptions extends RequestInit {
  auth?: boolean
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
