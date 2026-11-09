import type { EmotionVerseStatus } from '../hooks/useEmotionVerse'
import type { BibleVerse } from '../services/verses'
import { SectionHeader } from './SectionHeader'
import { SparklesIcon } from './icons'

interface BibleVerseSectionProps {
  status: EmotionVerseStatus
  verse: BibleVerse | null
  error: string | null
  onRetry: () => void
}

export function BibleVerseSection({
  status,
  verse,
  error,
  onRetry,
}: BibleVerseSectionProps) {
  let description = 'Confirma tu emoción para ver un versículo relacionado.'
  let badge = 'Esperando emoción'
  let badgeTone: 'default' | 'accent' | 'real' = 'accent'

  if (status === 'loading') {
    description = 'Buscando un versículo para tu emoción.'
    badge = 'Cargando'
  } else if (status === 'ready' && verse) {
    description = `Versículo para hoy, en ${verse.translation}.`
    badge = verse.translation
    badgeTone = 'real'
  } else if (status === 'not-configured') {
    description = 'Esta función todavía no está disponible.'
    badge = 'No configurado'
    badgeTone = 'default'
  } else if (status === 'error') {
    description = 'No pudimos cargar el versículo.'
    badge = 'Error'
    badgeTone = 'default'
  }

  return (
    <section className="content-section" aria-labelledby="verse-title">
      <SectionHeader
        title="Versículo para tu emoción"
        titleId="verse-title"
        description={description}
        badge={badge}
        badgeTone={badgeTone}
      />

      {status === 'idle' && (
        <div className="recommendation-state">
          <SparklesIcon />
          <strong>Todavía no hay un versículo para mostrar</strong>
          <small>Detecta o elige tu emoción para ver uno relacionado.</small>
        </div>
      )}

      {status === 'loading' && (
        <div className="recommendation-state" role="status" aria-live="polite">
          <span className="recommendation-spinner" aria-hidden="true" />
          <strong>Buscando tu versículo…</strong>
        </div>
      )}

      {status === 'not-configured' && (
        <div className="recommendation-state">
          <SparklesIcon />
          <strong>Esta función todavía no está disponible</strong>
          <small>El contenido bíblico se habilitará próximamente.</small>
        </div>
      )}

      {status === 'error' && (
        <div className="recommendation-state">
          <SparklesIcon />
          <strong>No pudimos cargar tu versículo</strong>
          <p className="form-error recommendation-error" role="alert">
            {error ?? 'Ocurrió un error al consultar el contenido bíblico.'}
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

      {status === 'ready' && verse && (
        <figure className="bible-verse-card">
          <blockquote className="bible-verse-text">“{verse.text}”</blockquote>
          <figcaption className="bible-verse-meta">
            <span className="bible-verse-reference">
              {verse.reference} ({verse.translation})
            </span>
            <span className="bible-verse-copyright">{verse.copyright}</span>
          </figcaption>
        </figure>
      )}
    </section>
  )
}
