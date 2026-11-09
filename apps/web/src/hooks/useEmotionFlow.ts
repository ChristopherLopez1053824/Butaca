import { useCallback, useRef, useState } from 'react'
import { buildEmotionPayload } from '../lib/emotionContract'
import type { EmotionResult } from '../lib/emotions'
import { createEmotion } from '../services/emotions'
import type { EmotionRecord } from '../services/emotions'
import { requestRecommendations } from '../services/recommendations'
import type {
  Recommendation,
  RecommendationPagination,
} from '../services/recommendations'

export type EmotionFlowStatus =
  | 'idle'
  | 'saving-emotion'
  | 'loading-recommendations'
  | 'ready'
  | 'empty'
  | 'error-saving-emotion'
  | 'error-loading-recommendations'

export type LoadMoreStatus = 'idle' | 'loading' | 'error'

export interface EmotionFlowState {
  status: EmotionFlowStatus
  emotionRecord: EmotionRecord | null
  recommendations: Recommendation[]
  pagination: RecommendationPagination | null
  error: Error | null
  loadMoreStatus: LoadMoreStatus
  loadMoreError: Error | null
}

export interface EmotionFlow extends EmotionFlowState {
  confirmEmotion: (result: EmotionResult) => Promise<void>
  retryRecommendations: () => Promise<void>
  loadMoreRecommendations: () => Promise<void>
  reset: () => void
}

const INITIAL_STATE: EmotionFlowState = {
  status: 'idle',
  emotionRecord: null,
  recommendations: [],
  pagination: null,
  error: null,
  loadMoreStatus: 'idle',
  loadMoreError: null,
}

function recommendationKey(item: Recommendation): string {
  return `${item.mediaType}:${item.tmdbId}`
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error
  }

  return new Error(fallback)
}

export function useEmotionFlow(): EmotionFlow {
  const [state, setState] = useState<EmotionFlowState>(INITIAL_STATE)
  const requestIdRef = useRef(0)
  const savingRef = useRef(false)
  const loadingMoreRef = useRef(false)

  const loadRecommendations = useCallback(
    async (record: EmotionRecord, requestId: number) => {
      setState({
        status: 'loading-recommendations',
        emotionRecord: record,
        recommendations: [],
        pagination: null,
        error: null,
        loadMoreStatus: 'idle',
        loadMoreError: null,
      })

      try {
        const result = await requestRecommendations({
          emotionRecordId: record.id,
        })

        if (requestId !== requestIdRef.current) {
          return
        }

        setState({
          status: result.data.length > 0 ? 'ready' : 'empty',
          emotionRecord: record,
          recommendations: result.data,
          pagination: result.pagination,
          error: null,
          loadMoreStatus: 'idle',
          loadMoreError: null,
        })
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return
        }

        setState({
          status: 'error-loading-recommendations',
          emotionRecord: record,
          recommendations: [],
          pagination: null,
          error: toError(
            error,
            'No pudimos cargar las recomendaciones. Inténtalo de nuevo.',
          ),
          loadMoreStatus: 'idle',
          loadMoreError: null,
        })
      }
    },
    [],
  )

  const confirmEmotion = useCallback(
    async (result: EmotionResult) => {
      if (savingRef.current) {
        return
      }

      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      savingRef.current = true

      setState({
        status: 'saving-emotion',
        emotionRecord: null,
        recommendations: [],
        pagination: null,
        error: null,
        loadMoreStatus: 'idle',
        loadMoreError: null,
      })

      let record: EmotionRecord

      try {
        record = await createEmotion(buildEmotionPayload(result))
      } catch (error) {
        if (requestId === requestIdRef.current) {
          savingRef.current = false
          setState({
            status: 'error-saving-emotion',
            emotionRecord: null,
            recommendations: [],
            pagination: null,
            error: toError(
              error,
              'No pudimos guardar tu emoción. Inténtalo de nuevo.',
            ),
            loadMoreStatus: 'idle',
            loadMoreError: null,
          })
        }

        return
      }

      if (requestId !== requestIdRef.current) {
        return
      }

      savingRef.current = false
      await loadRecommendations(record, requestId)
    },
    [loadRecommendations],
  )

  const retryRecommendations = useCallback(async () => {
    const record = state.emotionRecord

    if (!record || savingRef.current) {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    await loadRecommendations(record, requestId)
  }, [loadRecommendations, state.emotionRecord])

  const loadMoreRecommendations = useCallback(async () => {
    if (loadingMoreRef.current || savingRef.current) {
      return
    }

    const record = state.emotionRecord
    const pagination = state.pagination

    if (
      state.status !== 'ready'
      || !record
      || !pagination?.hasMore
      || !pagination.nextCursor
    ) {
      return
    }

    const requestId = requestIdRef.current
    const cursor = pagination.nextCursor
    loadingMoreRef.current = true

    setState((previous) => ({
      ...previous,
      loadMoreStatus: 'loading',
      loadMoreError: null,
    }))

    try {
      const result = await requestRecommendations({
        emotionRecordId: record.id,
        cursor,
      })

      if (requestId !== requestIdRef.current) {
        return
      }

      setState((previous) => {
        const existingKeys = new Set(
          previous.recommendations.map(recommendationKey),
        )
        const newItems = result.data.filter(
          (item) => !existingKeys.has(recommendationKey(item)),
        )

        return {
          ...previous,
          recommendations: [...previous.recommendations, ...newItems],
          pagination: result.pagination,
          loadMoreStatus: 'idle',
          loadMoreError: null,
        }
      })
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return
      }

      setState((previous) => ({
        ...previous,
        loadMoreStatus: 'error',
        loadMoreError: toError(
          error,
          'No pudimos cargar más recomendaciones. Inténtalo de nuevo.',
        ),
      }))
    } finally {
      loadingMoreRef.current = false
    }
  }, [state.status, state.emotionRecord, state.pagination])

  const reset = useCallback(() => {
    requestIdRef.current += 1
    savingRef.current = false
    loadingMoreRef.current = false
    setState(INITIAL_STATE)
  }, [])

  return {
    ...state,
    confirmEmotion,
    retryRecommendations,
    loadMoreRecommendations,
    reset,
  }
}
