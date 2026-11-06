import { ChartIcon } from './icons'
import { SectionHeader } from './SectionHeader'

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const moodCategories = [
  { label: 'Felicidad', accent: 'green' },
  { label: 'Calma', accent: 'sky' },
  { label: 'Tristeza', accent: 'lavender' },
  { label: 'Enojo', accent: 'pink' },
  { label: 'Sorpresa', accent: 'yellow' },
] as const

export function EmotionDashboard() {
  return (
    <section
      className="content-section emotion-dashboard"
      aria-labelledby="emotion-title"
    >
      <SectionHeader
        title="Mi dashboard de ánimos"
        titleId="emotion-title"
        description="Visualización preparada para tus estadísticas reales de emociones."
        badge="Sin datos"
      />

      <div className="mood-panels">
        <article className="mood-panel">
          <div className="mood-panel-header">
            <div>
              <span className="eyebrow">Últimos 7 días</span>
              <h3>Ánimo semanal</h3>
            </div>
            <ChartIcon />
          </div>

          <div
            className="chart-shell line-chart"
            role="img"
            aria-label="Gráfico de líneas del ánimo semanal sin datos disponibles"
          >
            <div className="chart-y-axis" aria-hidden="true">
              <span>Alto</span>
              <span>Medio</span>
              <span>Bajo</span>
            </div>

            <div className="chart-plot">
              <div className="chart-grid-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>

              <div className="chart-empty">
                <ChartIcon />
                <strong>Sin datos disponibles</strong>
                <small>Se completará cuando existan sesiones analizadas.</small>
              </div>

              <div className="chart-x-axis" aria-hidden="true">
                {weekDays.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="mood-panel">
          <div className="mood-panel-header">
            <div>
              <span className="eyebrow">Contenido recomendado</span>
              <h3>Contenido por ánimo</h3>
            </div>
            <ChartIcon />
          </div>

          <div
            className="chart-shell bar-chart"
            role="img"
            aria-label="Gráfico de barras de contenido por ánimo sin datos disponibles"
          >
            <div className="bar-chart-plot">
              <div className="chart-empty">
                <ChartIcon />
                <strong>Sin datos disponibles</strong>
                <small>Las categorías aparecerán al analizar tus emociones.</small>
              </div>

              <div className="bar-columns" aria-hidden="true">
                {moodCategories.map((category) => (
                  <div
                    className={`bar-column accent-${category.accent}`}
                    key={category.label}
                  >
                    <span className="bar-track" />
                    <span className="bar-label">
                      <span className="legend-dot" />
                      {category.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
