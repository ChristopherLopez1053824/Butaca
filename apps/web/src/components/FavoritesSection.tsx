import type { Accent } from './accent'
import { FavoriteCard } from './FavoriteCard'
import { SectionHeader } from './SectionHeader'

const favoriteAccents: Accent[] = ['sky', 'pink', 'yellow']

export function FavoritesSection() {
  return (
    <section className="content-section" aria-labelledby="favorites-title">
      <SectionHeader
        title="Favoritos"
        titleId="favorites-title"
        description="Tus títulos guardados aparecerán aquí cuando el servicio de favoritos esté conectado."
        badge="Solo visual"
        badgeTone="accent"
      />

      <div className="favorite-row">
        {favoriteAccents.map((accent) => (
          <FavoriteCard key={accent} accent={accent} />
        ))}
      </div>
    </section>
  )
}
