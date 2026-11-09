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

const favoriteProps = {
  isFavorite: () => false,
  isFavoritePending: () => false,
  onToggleFavorite: noop,
}

const loadMoreProps = {
  pagination: null,
  loadMoreStatus: 'idle' as const,
  loadMoreError: null,
  onLoadMore: noop,
}

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
        {...favoriteProps}
        {...loadMoreProps}
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
        {...favoriteProps}
        {...loadMoreProps}
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
        {...favoriteProps}
        {...loadMoreProps}
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
        {...favoriteProps}
        {...loadMoreProps}
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
        {...favoriteProps}
        {...loadMoreProps}
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
        {...favoriteProps}
        {...loadMoreProps}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain(
      'Movie Service no disponible',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar búsqueda' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('permite marcar y desmarcar una recomendación como favorita', () => {
    const onToggleFavorite = vi.fn()

    const { rerender } = render(
      <RecommendationsSection
        status="ready"
        recommendations={[recommendation]}
        emotionLabel="Felicidad"
        error={null}
        onRetry={noop}
        isFavorite={() => false}
        isFavoritePending={() => false}
        onToggleFavorite={onToggleFavorite}
        {...loadMoreProps}
      />,
    )

    const favoriteButton = screen.getByRole('button', {
      name: 'Agregar Fight Club a favoritos',
    })

    fireEvent.click(favoriteButton)

    expect(onToggleFavorite).toHaveBeenCalledWith(recommendation)

    rerender(
      <RecommendationsSection
        status="ready"
        recommendations={[recommendation]}
        emotionLabel="Felicidad"
        error={null}
        onRetry={noop}
        isFavorite={() => true}
        isFavoritePending={() => false}
        onToggleFavorite={onToggleFavorite}
        {...loadMoreProps}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Quitar Fight Club de favoritos' }),
    ).toBeTruthy()
  })

  it('muestra "Ver más" cuando hay más resultados y llama a onLoadMore', () => {
    const onLoadMore = vi.fn()

    render(
      <RecommendationsSection
        status="ready"
        recommendations={[recommendation]}
        emotionLabel="Felicidad"
        error={null}
        onRetry={noop}
        {...favoriteProps}
        pagination={{
          limit: 20,
          returned: 1,
          movieCount: 1,
          tvCount: 0,
          hasMore: true,
          nextCursor: 'cursor-1',
        }}
        loadMoreStatus="idle"
        loadMoreError={null}
        onLoadMore={onLoadMore}
      />,
    )

    const button = screen.getByRole('button', { name: 'Ver más' })
    fireEvent.click(button)

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('oculta "Ver más" cuando no quedan más resultados', () => {
    render(
      <RecommendationsSection
        status="ready"
        recommendations={[recommendation]}
        emotionLabel="Felicidad"
        error={null}
        onRetry={noop}
        {...favoriteProps}
        pagination={{
          limit: 20,
          returned: 1,
          movieCount: 1,
          tvCount: 0,
          hasMore: false,
          nextCursor: null,
        }}
        loadMoreStatus="idle"
        loadMoreError={null}
        onLoadMore={noop}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull()
  })

  it('deshabilita el botón y muestra "Cargando…" mientras se cargan más resultados', () => {
    render(
      <RecommendationsSection
        status="ready"
        recommendations={[recommendation]}
        emotionLabel="Felicidad"
        error={null}
        onRetry={noop}
        {...favoriteProps}
        pagination={{
          limit: 20,
          returned: 1,
          movieCount: 1,
          tvCount: 0,
          hasMore: true,
          nextCursor: 'cursor-1',
        }}
        loadMoreStatus="loading"
        loadMoreError={null}
        onLoadMore={noop}
      />,
    )

    const button = screen.getByRole('button', {
      name: 'Cargando…',
    }) as HTMLButtonElement

    expect(button.disabled).toBe(true)
  })

  it('muestra un mensaje de error comprensible si falla "Ver más"', () => {
    render(
      <RecommendationsSection
        status="ready"
        recommendations={[recommendation]}
        emotionLabel="Felicidad"
        error={null}
        onRetry={noop}
        {...favoriteProps}
        pagination={{
          limit: 20,
          returned: 1,
          movieCount: 1,
          tvCount: 0,
          hasMore: true,
          nextCursor: 'cursor-1',
        }}
        loadMoreStatus="error"
        loadMoreError="Movie Service no disponible"
        onLoadMore={noop}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain(
      'Movie Service no disponible',
    )
    expect(screen.getByText('Fight Club')).toBeTruthy()
  })
})
