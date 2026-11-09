// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmotion } from '../services/emotions'
import type { EmotionRecord } from '../services/emotions'
import { requestRecommendations } from '../services/recommendations'
import type {
  Recommendation,
  RecommendationPagination,
} from '../services/recommendations'
import { useEmotionFlow } from './useEmotionFlow'

vi.mock('../services/emotions', () => ({
  createEmotion: vi.fn(),
}))

vi.mock('../services/recommendations', () => ({
  requestRecommendations: vi.fn(),
}))

const mockedCreateEmotion = vi.mocked(createEmotion)
const mockedRequestRecommendations = vi.mocked(requestRecommendations)

const record: EmotionRecord = {
  id: 'emotion-1',
  userId: 'user-1',
  emotion: 'HAPPY',
  source: 'MANUAL',
  confidence: null,
  createdAt: '2026-11-08T20:00:00.000Z',
}

const recommendation: Recommendation = {
  id: 'recommendation-1',
  tmdbId: 550,
  mediaType: 'MOVIE',
  title: 'Fight Club',
  overview: 'Texto',
  posterPath: '/poster.jpg',
  backdropPath: null,
  releaseDate: '1999-10-15',
  voteAverage: 8.4,
  position: 1,
  createdAt: '2026-11-08T20:00:00.000Z',
}

const recommendation2: Recommendation = {
  ...recommendation,
  id: 'recommendation-2',
  tmdbId: 603,
  title: 'The Matrix',
}

const pagination: RecommendationPagination = {
  limit: 20,
  returned: 1,
  movieCount: 1,
  tvCount: 0,
  hasMore: false,
  nextCursor: null,
}

const paginationWithMore: RecommendationPagination = {
  ...pagination,
  hasMore: true,
  nextCursor: 'cursor-1',
}

beforeEach(() => {
  mockedCreateEmotion.mockReset()
  mockedRequestRecommendations.mockReset()
})

describe('useEmotionFlow', () => {
  it('guarda la emoción y carga las recomendaciones con su ID', async () => {
    mockedCreateEmotion.mockResolvedValue(record)
    mockedRequestRecommendations.mockResolvedValue({
      data: [recommendation],
      pagination,
    })

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({
        emotion: 'happy',
        source: 'MANUAL',
      })
    })

    expect(mockedCreateEmotion).toHaveBeenCalledWith({
      emotion: 'HAPPY',
      source: 'MANUAL',
    })
    expect(mockedRequestRecommendations).toHaveBeenCalledWith({
      emotionRecordId: 'emotion-1',
    })
    expect(result.current.status).toBe('ready')
    expect(result.current.emotionRecord).toEqual(record)
    expect(result.current.recommendations).toEqual([recommendation])
    expect(result.current.pagination).toEqual(pagination)
  })

  it('no solicita recomendaciones si falla el guardado', async () => {
    mockedCreateEmotion.mockRejectedValue(
      new Error('No se pudo guardar la emoción'),
    )

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({
        emotion: 'sad',
        source: 'MANUAL',
      })
    })

    expect(result.current.status).toBe('error-saving-emotion')
    expect(result.current.emotionRecord).toBeNull()
    expect(result.current.error?.message).toBe(
      'No se pudo guardar la emoción',
    )
    expect(mockedRequestRecommendations).not.toHaveBeenCalled()
  })

  it('permite reintentar recomendaciones sin volver a guardar la emoción', async () => {
    mockedCreateEmotion.mockResolvedValue(record)
    mockedRequestRecommendations
      .mockRejectedValueOnce(new Error('Movie Service no disponible'))
      .mockResolvedValueOnce({ data: [recommendation], pagination })

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({
        emotion: 'happy',
        source: 'MANUAL',
      })
    })

    expect(result.current.status).toBe('error-loading-recommendations')
    expect(result.current.emotionRecord).toEqual(record)

    await act(async () => {
      await result.current.retryRecommendations()
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.recommendations).toEqual([recommendation])
    expect(mockedCreateEmotion).toHaveBeenCalledTimes(1)
    expect(mockedRequestRecommendations).toHaveBeenCalledTimes(2)
  })

  it('marca el estado vacío cuando no hay recomendaciones', async () => {
    mockedCreateEmotion.mockResolvedValue(record)
    mockedRequestRecommendations.mockResolvedValue({
      data: [],
      pagination: { ...pagination, returned: 0, movieCount: 0 },
    })

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({
        emotion: 'neutral',
        source: 'MANUAL',
      })
    })

    expect(result.current.status).toBe('empty')
    expect(result.current.recommendations).toEqual([])
  })

  it('evita una segunda confirmación mientras se guarda', async () => {
    let resolveCreate!: (value: EmotionRecord) => void
    mockedCreateEmotion.mockReturnValue(
      new Promise<EmotionRecord>((resolve) => {
        resolveCreate = resolve
      }),
    )
    mockedRequestRecommendations.mockResolvedValue({
      data: [recommendation],
      pagination,
    })

    const { result } = renderHook(() => useEmotionFlow())

    let firstConfirmation!: Promise<void>

    act(() => {
      firstConfirmation = result.current.confirmEmotion({
        emotion: 'happy',
        source: 'MANUAL',
      })
    })

    act(() => {
      void result.current.confirmEmotion({
        emotion: 'sad',
        source: 'MANUAL',
      })
    })

    expect(mockedCreateEmotion).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveCreate(record)
      await firstConfirmation
    })
  })

  it('ignora respuestas de solicitudes anteriores', async () => {
    let resolveCreate!: (value: EmotionRecord) => void
    mockedCreateEmotion.mockReturnValue(
      new Promise<EmotionRecord>((resolve) => {
        resolveCreate = resolve
      }),
    )

    const { result } = renderHook(() => useEmotionFlow())

    let confirmation!: Promise<void>

    act(() => {
      confirmation = result.current.confirmEmotion({
        emotion: 'angry',
        source: 'MANUAL',
      })
    })

    act(() => {
      result.current.reset()
    })

    await act(async () => {
      resolveCreate(record)
      await confirmation
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.emotionRecord).toBeNull()
    expect(mockedRequestRecommendations).not.toHaveBeenCalled()
  })

  it('carga más recomendaciones y las agrega a las existentes sin remplazarlas', async () => {
    mockedCreateEmotion.mockResolvedValue(record)
    mockedRequestRecommendations
      .mockResolvedValueOnce({ data: [recommendation], pagination: paginationWithMore })
      .mockResolvedValueOnce({ data: [recommendation2], pagination })

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({ emotion: 'happy', source: 'MANUAL' })
    })

    expect(result.current.recommendations).toEqual([recommendation])
    expect(result.current.pagination?.hasMore).toBe(true)

    await act(async () => {
      await result.current.loadMoreRecommendations()
    })

    expect(mockedRequestRecommendations).toHaveBeenNthCalledWith(2, {
      emotionRecordId: 'emotion-1',
      cursor: 'cursor-1',
    })
    expect(result.current.recommendations).toEqual([
      recommendation,
      recommendation2,
    ])
    expect(result.current.pagination).toEqual(pagination)
    expect(result.current.loadMoreStatus).toBe('idle')
    expect(mockedCreateEmotion).toHaveBeenCalledTimes(1)
  })

  it('no duplica una recomendación ya visible aunque el backend la repita', async () => {
    mockedCreateEmotion.mockResolvedValue(record)
    mockedRequestRecommendations
      .mockResolvedValueOnce({ data: [recommendation], pagination: paginationWithMore })
      .mockResolvedValueOnce({
        data: [recommendation, recommendation2],
        pagination,
      })

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({ emotion: 'happy', source: 'MANUAL' })
    })

    await act(async () => {
      await result.current.loadMoreRecommendations()
    })

    expect(result.current.recommendations).toEqual([
      recommendation,
      recommendation2,
    ])
  })

  it('no vuelve a solicitar más si no hay más páginas', async () => {
    mockedCreateEmotion.mockResolvedValue(record)
    mockedRequestRecommendations.mockResolvedValueOnce({
      data: [recommendation],
      pagination,
    })

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({ emotion: 'happy', source: 'MANUAL' })
    })

    await act(async () => {
      await result.current.loadMoreRecommendations()
    })

    expect(mockedRequestRecommendations).toHaveBeenCalledTimes(1)
  })

  it('evita una segunda solicitud de "ver más" mientras la primera está en curso', async () => {
    mockedCreateEmotion.mockResolvedValue(record)
    mockedRequestRecommendations.mockResolvedValueOnce({
      data: [recommendation],
      pagination: paginationWithMore,
    })

    let resolveMore!: (value: {
      data: Recommendation[]
      pagination: RecommendationPagination
    }) => void
    mockedRequestRecommendations.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMore = resolve
      }),
    )

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({ emotion: 'happy', source: 'MANUAL' })
    })

    let firstLoadMore!: Promise<void>

    act(() => {
      firstLoadMore = result.current.loadMoreRecommendations()
    })

    act(() => {
      void result.current.loadMoreRecommendations()
    })

    expect(mockedRequestRecommendations).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveMore({ data: [recommendation2], pagination })
      await firstLoadMore
    })

    expect(result.current.recommendations).toEqual([
      recommendation,
      recommendation2,
    ])
  })

  it('conserva las recomendaciones cargadas si "ver más" falla, y permite reintentar', async () => {
    mockedCreateEmotion.mockResolvedValue(record)
    mockedRequestRecommendations
      .mockResolvedValueOnce({ data: [recommendation], pagination: paginationWithMore })
      .mockRejectedValueOnce(new Error('Movie Service no disponible'))
      .mockResolvedValueOnce({ data: [recommendation2], pagination })

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({ emotion: 'happy', source: 'MANUAL' })
    })

    await act(async () => {
      await result.current.loadMoreRecommendations()
    })

    expect(result.current.loadMoreStatus).toBe('error')
    expect(result.current.loadMoreError?.message).toBe(
      'Movie Service no disponible',
    )
    expect(result.current.recommendations).toEqual([recommendation])
    expect(result.current.status).toBe('ready')

    await act(async () => {
      await result.current.loadMoreRecommendations()
    })

    expect(result.current.recommendations).toEqual([
      recommendation,
      recommendation2,
    ])
    expect(result.current.loadMoreStatus).toBe('idle')
  })

  it('no registra una nueva emoción al cargar más resultados', async () => {
    mockedCreateEmotion.mockResolvedValue(record)
    mockedRequestRecommendations
      .mockResolvedValueOnce({ data: [recommendation], pagination: paginationWithMore })
      .mockResolvedValueOnce({ data: [recommendation2], pagination })

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({ emotion: 'happy', source: 'MANUAL' })
    })

    await act(async () => {
      await result.current.loadMoreRecommendations()
    })

    expect(mockedCreateEmotion).toHaveBeenCalledTimes(1)
  })

  it('descarta una respuesta tardía de "ver más" si mientras tanto se confirmó otra emoción', async () => {
    const record2: EmotionRecord = { ...record, id: 'emotion-2', emotion: 'SAD' }

    mockedCreateEmotion
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce(record2)

    mockedRequestRecommendations.mockResolvedValueOnce({
      data: [recommendation],
      pagination: paginationWithMore,
    })

    let resolveStaleMore!: (value: {
      data: Recommendation[]
      pagination: RecommendationPagination
    }) => void
    mockedRequestRecommendations.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStaleMore = resolve
      }),
    )
    mockedRequestRecommendations.mockResolvedValueOnce({
      data: [recommendation2],
      pagination,
    })

    const { result } = renderHook(() => useEmotionFlow())

    await act(async () => {
      await result.current.confirmEmotion({ emotion: 'happy', source: 'MANUAL' })
    })

    let staleLoadMore!: Promise<void>

    act(() => {
      staleLoadMore = result.current.loadMoreRecommendations()
    })

    await act(async () => {
      await result.current.confirmEmotion({ emotion: 'sad', source: 'MANUAL' })
    })

    expect(result.current.emotionRecord?.id).toBe('emotion-2')
    expect(result.current.recommendations).toEqual([recommendation2])

    await act(async () => {
      resolveStaleMore({
        data: [{ ...recommendation, id: 'stale-recommendation' }],
        pagination,
      })
      await staleLoadMore
    })

    expect(result.current.emotionRecord?.id).toBe('emotion-2')
    expect(result.current.recommendations).toEqual([recommendation2])
    expect(mockedCreateEmotion).toHaveBeenCalledTimes(2)
  })
})
