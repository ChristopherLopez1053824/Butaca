import type { FavoritesStatus } from '../hooks/useFavorites'
import type { Favorite } from '../services/favorites'
import type { Accent } from './accent'
import { FavoriteCard } from './FavoriteCard'
import { HeartIcon } from './icons'
import { SectionHeader } from './SectionHeader'

interface FavoritesSectionProps {
  status: FavoritesStatus
  favorites: Favorite[]
  error: string | null
  isRemoving: (tmdbId: number, mediaType: Favorite['mediaType']) => boolean
  onRemove: (favorite: Favorite) => void
  onRetry: () => void
}

const favoriteAccents: Accent[] = ['sky', 'pink', 'yellow', 'green', 'lavender']

export function FavoritesSection({
  status,
  favorites,
  error,
  isRemoving,
  onRemove,
  onRetry,
}: FavoritesSectionProps) {
  let description = 'Tus títulos guardados aparecerán aquí.'
  let badge = 'Cargando'
  let badgeTone: 'default' | 'accent' | 'real' = 'accent'

  if (status === 'ready') {
    description = 'Tus películas y series guardadas.'
    badge = `${favorites.length} guardados`
    badgeTone = 'real'
  } else if (status === 'empty') {
    description = 'Todavía no has guardado ninguna película o serie.'
    badge = 'Sin favoritos'
    badgeTone = 'default'
  } else if (status === 'error') {
    description = 'No pudimos cargar tus favoritos.'
    badge = 'Error'
    badgeTone = 'default'
  }

  return (
    <section className="content-section" aria-labelledby="favorites-title">
      <SectionHeader
        title="Favoritos"
        titleId="favorites-title"
        description={description}
        badge={badge}
        badgeTone={badgeTone}
      />

      {(status === 'idle' || status === 'loading') && (
        <div className="recommendation-state" role="status" aria-live="polite">
          <span className="recommendation-spinner" aria-hidden="true" />
          <strong>Cargando tus favoritos…</strong>
        </div>
      )}

      {status === 'empty' && (
        <div className="recommendation-state">
          <HeartIcon />
          <strong>Sin favoritos todavía</strong>
          <small>
            Marca una película o serie recomendada para guardarla aquí.
          </small>
        </div>
      )}

      {status === 'error' && (
        <div className="recommendation-state">
          <HeartIcon />
          <strong>No pudimos cargar tus favoritos</strong>
          <p className="form-error recommendation-error" role="alert">
            {error ?? 'Ocurrió un error al consultar tus favoritos.'}
          </p>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={onRetry}
          >
            Reintentar
          </button>
        </div>
      )}

      {status === 'ready' && favorites.length > 0 && (
        <div className="favorite-row">
          {favorites.map((favorite, index) => (
            <FavoriteCard
              key={favorite.id}
              favorite={favorite}
              accent={favoriteAccents[index % favoriteAccents.length]}
              isRemoving={isRemoving(favorite.tmdbId, favorite.mediaType)}
              onRemove={() => onRemove(favorite)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
