// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Recommendation } from '../services/recommendations'
import { RecommendationsSection } from './RecommendationsSection'

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

const noop = () => undefined

afterEach(cleanup)

describe('RecommendationsSection', () => {
  it('muestra una invitación cuando todavía no hay emoción confirmada', () => {
    render(
      <RecommendationsSection
        status="idle"
        recommendations={[]}
        emotionLabel={null}
        error={null}
        onRetry={noop}
      />,
    )

    expect(
      screen.getByText('Tu siguiente película empieza con una emoción'),
    ).toBeTruthy()
  })

  it('renderiza películas reales con póster de TMDB y metadatos disponibles', () => {
    render(
      <RecommendationsSection
        status="ready"
        recommendations={[recommendation]}
        emotionLabel="Felicidad"
        error={null}
        onRetry={noop}
      />,
    )

    expect(screen.getByText('Fight Club')).toBeTruthy()
    expect(screen.getByText('Película · 1999 · 8.4/10')).toBeTruthy()
    expect(screen.getByText('Felicidad')).toBeTruthy()

    const image = screen.getByAltText('Póster de Fight Club')
    expect(image.getAttribute('src')).toBe(
      'https://image.tmdb.org/t/p/w500/poster.jpg',
    )
  })

  it('usa el fallback visual si el póster no existe', () => {
    render(
      <RecommendationsSection
        status="ready"
        recommendations={[{ ...recommendation, posterPath: null }]}
        emotionLabel="Felicidad"
        error={null}
        onRetry={noop}
      />,
    )

    expect(screen.queryByAltText('Póster de Fight Club')).toBeNull()
    expect(screen.getByText('Fight Club')).toBeTruthy()
  })

  it('usa el fallback visual si el póster falla al cargar', () => {
    render(
      <RecommendationsSection
        status="ready"
        recommendations={[recommendation]}
        emotionLabel="Felicidad"
        error={null}
        onRetry={noop}
      />,
    )

    fireEvent.error(screen.getByAltText('Póster de Fight Club'))

    expect(screen.queryByAltText('Póster de Fight Club')).toBeNull()
  })

  it('permite reintentar cuando no hay resultados', () => {
    const onRetry = vi.fn()

    render(
      <RecommendationsSection
        status="empty"
        recommendations={[]}
        emotionLabel="Tristeza"
        error={null}
        onRetry={onRetry}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar búsqueda' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sin resultados')).toBeTruthy()
  })

  it('muestra el error comprensible y permite reintentar', () => {
    const onRetry = vi.fn()

    render(
      <RecommendationsSection
        status="error"
        recommendations={[]}
        emotionLabel="Tristeza"
        error="Movie Service no disponible"
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain(
      'Movie Service no disponible',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar búsqueda' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
