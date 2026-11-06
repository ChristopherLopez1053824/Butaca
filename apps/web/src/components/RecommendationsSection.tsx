import type { Accent } from './accent'
import { MovieCard } from './MovieCard'
import { SectionHeader } from './SectionHeader'

const placeholderMovies: Accent[] = [
  'lavender',
  'sky',
  'pink',
  'yellow',
  'green',
]

export function RecommendationsSection() {
  return (
    <section
      className="content-section"
      aria-labelledby="recommendations-title"
    >
      <SectionHeader
        title="Para ti"
        titleId="recommendations-title"
        description="Películas recomendadas según la emoción detectada. La integración de datos se realizará más adelante."
        badge="Solo visual"
        badgeTone="accent"
      />

      <div className="media-row" role="list">
        {placeholderMovies.map((accent) => (
          <MovieCard
            key={accent}
            accent={accent}
            title="Título pendiente"
            genre="Género pendiente"
            emotion="Emoción pendiente"
          />
        ))}
      </div>
    </section>
  )
}
