import { useCallback, useEffect, useRef, useState } from 'react'
import { getDashboardSummary } from '../services/dashboard'
import type { DashboardSummary } from '../services/dashboard'

export type DashboardSummaryStatus = 'loading' | 'ready' | 'empty' | 'error'

export interface DashboardSummaryState {
  status: DashboardSummaryStatus
  summary: DashboardSummary | null
  error: string | null
}

export interface DashboardSummaryResult extends DashboardSummaryState {
  reload: () => Promise<void>
}

function isEmpty(summary: DashboardSummary): boolean {
  return (
    summary.emotionTimeline.length === 0
    && summary.recommendationsByEmotion.length === 0
    && summary.favoritesCount === 0
  )
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useDashboardSummary(): DashboardSummaryResult {
  const [state, setState] = useState<DashboardSummaryState>({
    status: 'loading',
    summary: null,
    error: null,
  })
  const requestIdRef = useRef(0)

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setState((previous) => ({ ...previous, status: 'loading', error: null }))

    try {
      const summary = await getDashboardSummary()

      if (requestId !== requestIdRef.current) {
        return
      }

      setState({
        status: isEmpty(summary) ? 'empty' : 'ready',
        summary,
        error: null,
      })
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return
      }

      setState({
        status: 'error',
        summary: null,
        error: toMessage(error, 'No pudimos cargar tu dashboard.'),
      })
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    ...state,
    reload,
  }
}
