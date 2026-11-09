import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { API_EMOTION_LABELS, API_EMOTIONS } from '../lib/emotionContract'
import type {
  EmotionTimelinePoint,
  RecommendationByEmotion,
} from '../services/dashboard'
import { ChartIcon } from './icons'
import { SectionHeader } from './SectionHeader'

// Paleta categórica validada para fondo oscuro (ver skill dataviz:
// node scripts/validate_palette.js sobre este set contra #0b131a).
const EMOTION_COLORS: Record<string, string> = {
  HAPPY: '#3987e5',
  SAD: '#d95926',
  ANGRY: '#199e70',
  TIRED: '#c98500',
  NEUTRAL: '#d55181',
  FEARFUL: '#008300',
  SURPRISED: '#9085e9',
  DISGUSTED: '#e66767',
}
const FALLBACK_EMOTION_COLOR = '#94a3b8'

const MEDIA_TYPE_COLORS: Record<string, string> = {
  MOVIE: '#3987e5',
  TV: '#d95926',
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  MOVIE: 'Películas',
  TV: 'Series',
}

const GRID_STROKE = 'rgba(148, 163, 184, 0.16)'
const AXIS_STROKE = 'rgba(148, 163, 184, 0.4)'
const TICK_STYLE = { fill: 'var(--muted)', fontSize: 11 }

type TimelineRow = { date: string } & Record<string, number | string>
type RecommendationRow = { emotion: string } & Record<string, number | string>

function emotionLabel(emotion: string): string {
  return (API_EMOTION_LABELS as Record<string, string>)[emotion] ?? emotion
}

function emotionColor(emotion: string): string {
  return EMOTION_COLORS[emotion] ?? FALLBACK_EMOTION_COLOR
}

function orderEmotions(emotions: string[]): string[] {
  const known = API_EMOTIONS.filter((emotion) => emotions.includes(emotion))
  const unknown = emotions.filter(
    (emotion) => !(API_EMOTIONS as readonly string[]).includes(emotion),
  )
  return [...known, ...unknown]
}

function pivotTimeline(points: EmotionTimelinePoint[]) {
  const byDate = new Map<string, TimelineRow>()
  const emotions = new Set<string>()

  for (const point of points) {
    emotions.add(point.emotion)
    const row = byDate.get(point.date) ?? ({ date: point.date } as TimelineRow)
    row[point.emotion] = point.count
    byDate.set(point.date, row)
  }

  const rows = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  return { rows, emotions: orderEmotions(Array.from(emotions)) }
}

function pivotRecommendations(items: RecommendationByEmotion[]) {
  const byEmotion = new Map<string, RecommendationRow>()
  const mediaTypes = new Set<string>()

  for (const item of items) {
    mediaTypes.add(item.mediaType)
    const row =
      byEmotion.get(item.emotion) ?? ({ emotion: item.emotion } as RecommendationRow)
    row[item.mediaType] = item.count
    byEmotion.set(item.emotion, row)
  }

  const rows = orderEmotions(Array.from(byEmotion.keys())).map(
    (emotion) => byEmotion.get(emotion) as RecommendationRow,
  )

  return { rows, mediaTypes: Array.from(mediaTypes).sort() }
}

function tooltipStyle() {
  return {
    background: 'rgba(11, 19, 26, 0.92)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    color: 'var(--text)',
    fontSize: 12,
  }
}

interface EmptyChartProps {
  message: string
  hint: string
}

function EmptyChart({ message, hint }: EmptyChartProps) {
  return (
    <div className="chart-empty">
      <ChartIcon />
      <strong>{message}</strong>
      <small>{hint}</small>
    </div>
  )
}

function WeeklyMoodChart({ points }: { points: EmotionTimelinePoint[] }) {
  const [showTable, setShowTable] = useState(false)
  const { rows, emotions } = pivotTimeline(points)

  if (rows.length === 0) {
    return (
      <EmptyChart
        message="Sin datos disponibles"
        hint="Se completará cuando registres emociones."
      />
    )
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} barGap={2} barCategoryGap="20%">
          <CartesianGrid
            vertical={false}
            stroke={GRID_STROKE}
            strokeDasharray="0"
          />
          <XAxis
            dataKey="date"
            stroke={AXIS_STROKE}
            tick={TICK_STYLE}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            stroke={AXIS_STROKE}
            tick={TICK_STYLE}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={(value, name) => [value, emotionLabel(String(name))]}
          />
          <Legend
            formatter={(value) => emotionLabel(String(value))}
            wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }}
          />
          {emotions.map((emotion, index) => (
            <Bar
              key={emotion}
              dataKey={emotion}
              name={emotion}
              stackId="emotions"
              fill={emotionColor(emotion)}
              maxBarSize={22}
              radius={index === emotions.length - 1 ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <button
        type="button"
        className="button button-secondary button-small chart-table-toggle"
        onClick={() => setShowTable((previous) => !previous)}
      >
        {showTable ? 'Ocultar tabla' : 'Ver como tabla'}
      </button>

      {showTable && (
        <table className="chart-table">
          <thead>
            <tr>
              <th>Fecha</th>
              {emotions.map((emotion) => (
                <th key={emotion}>{emotionLabel(emotion)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                {emotions.map((emotion) => (
                  <td key={emotion}>{row[emotion] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function RecommendationsByMoodChart({
  items,
}: {
  items: RecommendationByEmotion[]
}) {
  const [showTable, setShowTable] = useState(false)
  const { rows, mediaTypes } = pivotRecommendations(items)

  if (rows.length === 0) {
    return (
      <EmptyChart
        message="Sin datos disponibles"
        hint="Las categorías aparecerán al analizar tus emociones."
      />
    )
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} barGap={2} barCategoryGap="24%">
          <CartesianGrid
            vertical={false}
            stroke={GRID_STROKE}
            strokeDasharray="0"
          />
          <XAxis
            dataKey="emotion"
            stroke={AXIS_STROKE}
            tick={TICK_STYLE}
            tickLine={false}
            tickFormatter={emotionLabel}
          />
          <YAxis
            allowDecimals={false}
            stroke={AXIS_STROKE}
            tick={TICK_STYLE}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            labelFormatter={(label) => emotionLabel(String(label))}
            formatter={(value, name) => {
              const key = String(name)
              return [value, MEDIA_TYPE_LABELS[key] ?? key]
            }}
          />
          <Legend
            formatter={(value) => {
              const key = String(value)
              return MEDIA_TYPE_LABELS[key] ?? key
            }}
            wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }}
          />
          {mediaTypes.map((mediaType, index) => (
            <Bar
              key={mediaType}
              dataKey={mediaType}
              name={mediaType}
              stackId="media"
              fill={MEDIA_TYPE_COLORS[mediaType] ?? FALLBACK_EMOTION_COLOR}
              maxBarSize={22}
              radius={
                index === mediaTypes.length - 1 ? [4, 4, 0, 0] : undefined
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <button
        type="button"
        className="button button-secondary button-small chart-table-toggle"
        onClick={() => setShowTable((previous) => !previous)}
      >
        {showTable ? 'Ocultar tabla' : 'Ver como tabla'}
      </button>

      {showTable && (
        <table className="chart-table">
          <thead>
            <tr>
              <th>Emoción</th>
              {mediaTypes.map((mediaType) => (
                <th key={mediaType}>
                  {MEDIA_TYPE_LABELS[mediaType] ?? mediaType}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.emotion}>
                <td>{emotionLabel(row.emotion)}</td>
                {mediaTypes.map((mediaType) => (
                  <td key={mediaType}>{row[mediaType] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

export function EmotionDashboard() {
  const { status, summary, error, reload } = useDashboardSummary()

  let description = 'Visualización preparada para tus estadísticas reales de emociones.'
  let badge = 'Cargando'

  if (status === 'ready') {
    description = 'Tus estadísticas reales de emociones y recomendaciones.'
    badge = 'Datos reales'
  } else if (status === 'empty') {
    description = 'Todavía no hay suficiente actividad para mostrar estadísticas.'
    badge = 'Sin datos'
  } else if (status === 'error') {
    description = 'No pudimos cargar tus estadísticas.'
    badge = 'Error'
  }

  return (
    <section
      className="content-section emotion-dashboard"
      aria-labelledby="emotion-title"
    >
      <SectionHeader
        title="Mi dashboard de ánimos"
        titleId="emotion-title"
        description={description}
        badge={badge}
      />

      {status === 'error' && (
        <div className="recommendation-state">
          <ChartIcon />
          <strong>No pudimos cargar tu dashboard</strong>
          <p className="form-error recommendation-error" role="alert">
            {error ?? 'Ocurrió un error al consultar el resumen.'}
          </p>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => {
              void reload()
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {status !== 'error' && (
        <>
          {summary
            && summary.unavailable.length > 0 && (
            <p className="dashboard-partial-notice" role="status">
              No pudimos consultar: {summary.unavailable.join(', ')}. Se
              muestran los datos disponibles.
            </p>
          )}

          <div className="mood-panels">
            <article className="mood-panel">
              <div className="mood-panel-header">
                <div>
                  <span className="eyebrow">Historial</span>
                  <h3>Emociones registradas por día</h3>
                </div>
                <ChartIcon />
              </div>

              <div className="chart-shell line-chart">
                {status === 'loading' ? (
                  <EmptyChart message="Cargando…" hint="Consultando tu historial." />
                ) : (
                  <WeeklyMoodChart points={summary?.emotionTimeline ?? []} />
                )}
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

              <div className="chart-shell bar-chart">
                {status === 'loading' ? (
                  <EmptyChart message="Cargando…" hint="Consultando tus recomendaciones." />
                ) : (
                  <RecommendationsByMoodChart
                    items={summary?.recommendationsByEmotion ?? []}
                  />
                )}
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  )
}
