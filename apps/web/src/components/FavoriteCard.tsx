import { useState } from 'react'
import type { Favorite } from '../services/favorites'
import type { Accent } from './accent'
import { FilmIcon, HeartIcon } from './icons'

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

interface FavoriteCardProps {
  favorite: Favorite
  accent: Accent
  isRemoving: boolean
  onRemove: () => void
}

export function FavoriteCard({
  favorite,
  accent,
  isRemoving,
  onRemove,
}: FavoriteCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const mediaLabel = favorite.mediaType === 'MOVIE' ? 'Película' : 'Serie'
  const year = favorite.releaseDate?.slice(0, 4) ?? null
  const posterUrl = favorite.posterPath
    ? `${TMDB_IMAGE_BASE_URL}${favorite.posterPath}`
    : null
  const showPoster = posterUrl !== null && !imageFailed

  return (
    <article
      className={`favorite-card accent-${accent}`}
      aria-label={`${favorite.title}${year ? `, ${year}` : ''}`}
    >
      <div className={`favorite-poster${showPoster ? ' has-image' : ''}`}>
        {showPoster ? (
          <img
            className="favorite-poster-image"
            src={posterUrl}
            alt={`Póster de ${favorite.title}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <FilmIcon />
        )}

        <button
          type="button"
          className="favorite-remove"
          aria-label={`Quitar ${favorite.title} de favoritos`}
          disabled={isRemoving}
          onClick={onRemove}
        >
          <HeartIcon fill="currentColor" />
        </button>
      </div>
      <div className="favorite-info">
        <span className="favorite-badge">{mediaLabel}</span>
        <h3 title={favorite.title}>{favorite.title}</h3>
        <p>{year ?? 'Sin fecha'}</p>
      </div>
    </article>
  )
}
