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

export interface WakeServiceState {
  status: 'offline' | 'waking' | 'online' | 'timeout' | 'error'
  lastCheckedAt: string | null
}

export interface WakeStatusResponse {
  status: string
  data: {
    waking: boolean
    startedAt: string | null
    onlineCount: number
    total: number
    services: Record<string, WakeServiceState>
  }
}

export function triggerWake(): Promise<WakeStatusResponse>

export function getWakeStatus(): Promise<WakeStatusResponse>
