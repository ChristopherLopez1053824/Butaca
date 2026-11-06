import type { Accent } from './accent'
import { FilmIcon, HeartIcon, SparklesIcon } from './icons'

interface MovieCardProps {
  title: string
  genre: string
  emotion: string
  accent: Accent
}

export function MovieCard({
  title,
  genre,
  emotion,
  accent,
}: MovieCardProps) {
  return (
    <article
      className={`movie-card accent-${accent}`}
      role="listitem"
      aria-label={`${title}. Contenido provisional.`}
    >
      <div className="movie-poster" aria-hidden="true">
        <span className="movie-placeholder-badge">Próximamente</span>
        <span className="movie-favorite">
          <HeartIcon />
        </span>
        <FilmIcon className="movie-poster-icon" />
      </div>

      <div className="movie-info">
        <h3>{title}</h3>
        <p>{genre}</p>
        <span className="emotion-chip">
          <SparklesIcon />
          {emotion}
        </span>
      </div>
    </article>
  )
}
