// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDashboardSummary } from '../services/dashboard'
import type { DashboardSummary } from '../services/dashboard'
import { EmotionDashboard } from './EmotionDashboard'

vi.mock('../services/dashboard', () => ({
  getDashboardSummary: vi.fn(),
}))

const mockedGetDashboardSummary = vi.mocked(getDashboardSummary)

const summary: DashboardSummary = {
  emotionTimeline: [
    { date: '2026-11-01', emotion: 'HAPPY', count: 2 },
    { date: '2026-11-02', emotion: 'SAD', count: 1 },
  ],
  recommendationsByEmotion: [
    { emotion: 'HAPPY', mediaType: 'MOVIE', count: 10 },
  ],
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

  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

afterEach(cleanup)

describe('EmotionDashboard', () => {
  it('muestra datos reales cuando la carga tiene éxito', async () => {
    mockedGetDashboardSummary.mockResolvedValue(summary)

    render(<EmotionDashboard />)

    await waitFor(() => expect(screen.getByText('Datos reales')).toBeTruthy())
    expect(screen.queryByText('Sin datos disponibles')).toBeNull()
  })

  it('muestra el estado vacío cuando no hay actividad', async () => {
    mockedGetDashboardSummary.mockResolvedValue(emptySummary)

    render(<EmotionDashboard />)

    await waitFor(() => expect(screen.getByText('Sin datos')).toBeTruthy())
    expect(screen.getAllByText('Sin datos disponibles').length).toBe(2)
  })

  it('muestra el error real y permite reintentar', async () => {
    mockedGetDashboardSummary.mockRejectedValue(
      new Error('Dashboard Service no disponible'),
    )

    render(<EmotionDashboard />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toContain(
      'Dashboard Service no disponible',
    )
  })

  it('avisa cuando el resumen quedó parcial por un servicio no disponible', async () => {
    mockedGetDashboardSummary.mockResolvedValue({
      ...summary,
      unavailable: ['favorites'],
    })

    render(<EmotionDashboard />)

    await waitFor(() =>
      expect(screen.getByRole('status')).toBeTruthy(),
    )
    expect(screen.getByRole('status').textContent).toContain('favorites')
  })
})
