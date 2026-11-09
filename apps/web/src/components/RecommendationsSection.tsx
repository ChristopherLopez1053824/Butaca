import type { LoadMoreStatus } from '../hooks/useEmotionFlow'
import type {
  Recommendation,
  RecommendationPagination,
} from '../services/recommendations'
import type { Accent } from './accent'
import { FilmIcon } from './icons'
import { MovieCard } from './MovieCard'
import { SectionHeader } from './SectionHeader'

export type RecommendationsStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'

interface RecommendationsSectionProps {
  status: RecommendationsStatus
  recommendations: Recommendation[]
  pagination: RecommendationPagination | null
  emotionLabel: string | null
  error: string | null
  onRetry: () => void
  loadMoreStatus: LoadMoreStatus
  loadMoreError: string | null
  onLoadMore: () => void
  isFavorite: (
    tmdbId: number,
    mediaType: Recommendation['mediaType'],
  ) => boolean
  isFavoritePending: (
    tmdbId: number,
    mediaType: Recommendation['mediaType'],
  ) => boolean
  onToggleFavorite: (recommendation: Recommendation) => void
}

const recommendationAccents: Accent[] = [
  'lavender',
  'sky',
  'pink',
  'yellow',
  'green',
]

export function RecommendationsSection({
  status,
  recommendations,
  pagination,
  emotionLabel,
  error,
  onRetry,
  loadMoreStatus,
  loadMoreError,
  onLoadMore,
  isFavorite,
  isFavoritePending,
  onToggleFavorite,
}: RecommendationsSectionProps) {
  const hasRecommendations = status === 'ready' && recommendations.length > 0
  const viewStatus = status === 'ready' && !hasRecommendations ? 'empty' : status

  let description = 'Confirma tu emoción para ver recomendaciones reales.'
  let badge = 'Esperando emoción'
  let badgeTone: 'default' | 'accent' | 'real' = 'accent'

  if (viewStatus === 'loading') {
    description = 'Buscando películas y series según tu emoción.'
    badge = 'Cargando'
  } else if (hasRecommendations) {
    description = `Recomendaciones para ${emotionLabel ?? 'tu emoción'}.`
    badge = `${recommendations.length} títulos`
    badgeTone = 'real'
  } else if (viewStatus === 'empty') {
    description = 'No encontramos títulos para esta emoción.'
    badge = 'Sin resultados'
    badgeTone = 'default'
  } else if (viewStatus === 'error') {
    description = 'No pudimos cargar tus recomendaciones.'
    badge = 'Error'
    badgeTone = 'default'
  }

  return (
    <section
      className="content-section"
      aria-labelledby="recommendations-title"
    >
      <SectionHeader
        title="Para ti"
        titleId="recommendations-title"
        description={description}
        badge={badge}
        badgeTone={badgeTone}
      />

      {viewStatus === 'idle' && (
        <div className="recommendation-state">
          <FilmIcon />
          <strong>Tu siguiente película empieza con una emoción</strong>
          <small>
            Detecta tu emoción con la cámara o selecciónala manualmente y
            confírmala para solicitar recomendaciones.
          </small>
        </div>
      )}

      {viewStatus === 'loading' && (
        <div
          className="recommendation-state"
          role="status"
          aria-live="polite"
        >
          <span className="recommendation-spinner" aria-hidden="true" />
          <strong>Buscando títulos para ti…</strong>
          <small>Estamos consultando al servicio de recomendaciones.</small>
        </div>
      )}

      {viewStatus === 'empty' && (
        <div className="recommendation-state">
          <FilmIcon />
          <strong>No hay recomendaciones disponibles</strong>
          <small>
            Prueba a reintentar la búsqueda o confirma otra emoción.
          </small>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => onRetry()}
          >
            Reintentar búsqueda
          </button>
        </div>
      )}

      {viewStatus === 'error' && (
        <div className="recommendation-state">
          <FilmIcon />
          <strong>No pudimos cargar tus recomendaciones</strong>
          <p className="form-error recommendation-error" role="alert">
            {error ?? 'Ocurrió un error al consultar las recomendaciones.'}
          </p>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => onRetry()}
          >
            Reintentar búsqueda
          </button>
        </div>
      )}

      {hasRecommendations && (
        <div className="media-row" role="list">
          {recommendations.map((recommendation, index) => (
            <MovieCard
              key={recommendation.id}
              recommendation={recommendation}
              emotionLabel={emotionLabel ?? 'Tu emoción'}
              accent={
                recommendationAccents[index % recommendationAccents.length]
              }
              isFavorite={isFavorite(
                recommendation.tmdbId,
                recommendation.mediaType,
              )}
              isFavoritePending={isFavoritePending(
                recommendation.tmdbId,
                recommendation.mediaType,
              )}
              onToggleFavorite={() => onToggleFavorite(recommendation)}
            />
          ))}
        </div>
      )}

      {hasRecommendations && pagination?.hasMore && (
        <div className="recommendations-load-more">
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={onLoadMore}
            disabled={loadMoreStatus === 'loading'}
          >
            {loadMoreStatus === 'loading' ? 'Cargando…' : 'Ver más'}
          </button>

          {loadMoreStatus === 'error' && (
            <p className="form-error recommendation-error" role="alert">
              {loadMoreError
                ?? 'No pudimos cargar más recomendaciones. Inténtalo de nuevo.'}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
