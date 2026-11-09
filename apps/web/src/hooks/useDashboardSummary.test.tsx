// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDashboardSummary } from '../services/dashboard'
import type { DashboardSummary } from '../services/dashboard'
import { useDashboardSummary } from './useDashboardSummary'

vi.mock('../services/dashboard', () => ({
  getDashboardSummary: vi.fn(),
}))

const mockedGetDashboardSummary = vi.mocked(getDashboardSummary)

const summary: DashboardSummary = {
  emotionTimeline: [{ date: '2026-11-01', emotion: 'HAPPY', count: 2 }],
  recommendationsByEmotion: [{ emotion: 'HAPPY', mediaType: 'MOVIE', count: 10 }],
  favoritesCount: 4,
  unavailable: [],
}

const emptySummary: DashboardSummary = {
  emotionTimeline: [],
  recommendationsByEmotion: [],
  favoritesCount: 0,
  unavailable: [],
}

beforeEach(() => {
  mockedGetDashboardSummary.mockReset()
})

describe('useDashboardSummary', () => {
  it('carga el resumen real al montar', async () => {
    mockedGetDashboardSummary.mockResolvedValue(summary)

    const { result } = renderHook(() => useDashboardSummary())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.summary).toEqual(summary)
  })

  it('marca empty cuando no hay ningún dato real', async () => {
    mockedGetDashboardSummary.mockResolvedValue(emptySummary)

    const { result } = renderHook(() => useDashboardSummary())

    await waitFor(() => expect(result.current.status).toBe('empty'))
  })

  it('marca error si falla la carga', async () => {
    mockedGetDashboardSummary.mockRejectedValue(new Error('Dashboard Service no disponible'))

    const { result } = renderHook(() => useDashboardSummary())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Dashboard Service no disponible')
  })
})
