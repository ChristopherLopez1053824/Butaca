import { useCallback, useEffect, useRef, useState } from 'react'
import { getWakeStatus, triggerWake } from '../services/api'

export type WakeServiceStatus = 'offline' | 'waking' | 'online' | 'timeout' | 'error'

export interface WakeServiceState {
  status: WakeServiceStatus
  lastCheckedAt: string | null
}

export interface WakeSnapshot {
  waking: boolean
  startedAt: string | null
  onlineCount: number
  total: number
  services: Record<string, WakeServiceState>
}

export interface AutoWake {
  snapshot: WakeSnapshot | null
  error: string | null
  retry: () => void
}

const POLL_INTERVAL_MS = 3000

// Margen sobre el límite del ciclo del Gateway (80s, ver
// services/api-gateway/src/wake.js) para no dejar de sondear justo antes
// de que el propio Gateway termine de intentarlo.
const FRONTEND_TIMEOUT_MS = 90000

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useAutoWake(): AutoWake {
  const [snapshot, setSnapshot] = useState<WakeSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = useCallback((requestId: number, deadline: number) => {
    timerRef.current = setTimeout(async () => {
      if (requestId !== requestIdRef.current) {
        return
      }

      try {
        const result = await getWakeStatus()

        if (requestId !== requestIdRef.current) {
          return
        }

        setSnapshot(result.data)
        setError(null)

        if (result.data.onlineCount < result.data.total && Date.now() < deadline) {
          poll(requestId, deadline)
        }
      } catch (pollError) {
        if (requestId === requestIdRef.current) {
          setError(toMessage(pollError, 'No pudimos comprobar el estado de los servicios.'))
        }
      }
    }, POLL_INTERVAL_MS)
  }, [])

  const start = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setError(null)

    try {
      const result = await triggerWake()

      if (requestId !== requestIdRef.current) {
        return
      }

      setSnapshot(result.data)

      if (result.data.onlineCount < result.data.total) {
        poll(requestId, Date.now() + FRONTEND_TIMEOUT_MS)
      }
    } catch (startError) {
      if (requestId === requestIdRef.current) {
        setError(toMessage(startError, 'No pudimos iniciar la activación de los servicios.'))
      }
    }
  }, [poll])

  useEffect(() => {
    // Un solo disparo por montaje: si React vuelve a ejecutar este efecto
    // (StrictMode) antes de que termine, el `requestId` incrementado por esa
    // segunda llamada invalida las continuaciones de la primera.
    void start()

    return () => {
      requestIdRef.current += 1

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [start])

  return {
    snapshot,
    error,
    retry: () => {
      void start()
    },
  }
}
