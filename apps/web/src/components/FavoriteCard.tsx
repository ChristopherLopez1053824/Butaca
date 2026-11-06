import type { Accent } from './accent'
import { HeartIcon } from './icons'

interface FavoriteCardProps {
  accent: Accent
}

export function FavoriteCard({ accent }: FavoriteCardProps) {
  return (
    <article
      className={`favorite-card accent-${accent}`}
      aria-label="Favorito provisional"
    >
      <div className="favorite-poster" aria-hidden="true">
        <HeartIcon />
      </div>
      <div className="favorite-info">
        <span className="favorite-badge">Placeholder</span>
        <h3>Favorito pendiente</h3>
        <p>Sin datos todavía</p>
      </div>
    </article>
  )
}
