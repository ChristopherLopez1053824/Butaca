import { useState } from 'react'
import type { Recommendation } from '../services/recommendations'
import type { Accent } from './accent'
import { FilmIcon, HeartIcon, SparklesIcon } from './icons'

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

interface MovieCardProps {
  recommendation: Recommendation
  emotionLabel: string
  accent: Accent
  isFavorite: boolean
  isFavoritePending: boolean
  onToggleFavorite: () => void
}

export function MovieCard({
  recommendation,
  emotionLabel,
  accent,
  isFavorite,
  isFavoritePending,
  onToggleFavorite,
}: MovieCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const mediaLabel =
    recommendation.mediaType === 'MOVIE' ? 'Película' : 'Serie'
  const year = recommendation.releaseDate?.slice(0, 4) ?? null
  const rating =
    recommendation.voteAverage !== null
      ? `${recommendation.voteAverage.toFixed(1)}/10`
      : null
  const metadata = [mediaLabel, year, rating].filter(Boolean).join(' · ')
  const posterUrl = recommendation.posterPath
    ? `${TMDB_IMAGE_BASE_URL}${recommendation.posterPath}`
    : null
  const showPoster = posterUrl !== null && !imageFailed

  return (
    <article
      className={`movie-card accent-${accent}`}
      role="listitem"
      aria-label={`${recommendation.title}. ${metadata}.`}
    >
      <div className={`movie-poster${showPoster ? ' has-image' : ''}`}>
        {showPoster ? (
          <img
            className="movie-poster-image"
            src={posterUrl}
            alt={`Póster de ${recommendation.title}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <FilmIcon className="movie-poster-icon" />
        )}

        <span className="movie-placeholder-badge">{mediaLabel}</span>
        <button
          type="button"
          className={`movie-favorite${isFavorite ? ' is-favorite' : ''}`}
          aria-pressed={isFavorite}
          aria-busy={isFavoritePending}
          aria-label={
            isFavorite
              ? `Quitar ${recommendation.title} de favoritos`
              : `Agregar ${recommendation.title} a favoritos`
          }
          disabled={isFavoritePending}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite()
          }}
        >
          <HeartIcon fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="movie-info">
        <h3 title={recommendation.title}>{recommendation.title}</h3>
        <p>{metadata}</p>
        <span className="emotion-chip">
          <SparklesIcon />
          {emotionLabel}
        </span>
      </div>
    </article>
  )
}
