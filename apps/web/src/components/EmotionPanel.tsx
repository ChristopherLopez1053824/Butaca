import type { EmotionDetectionState } from '../hooks/useEmotionDetection'
import {
  EMOTION_LABELS,
  EMOTION_OPTIONS,
  type Emotion,
  type EmotionResult,
  type EmotionSaveStatus,
  type EmotionSource,
} from '../lib/emotions'
import '../styles/emotion-panel.css'
import { SparklesIcon } from './icons'

interface EmotionPanelProps {
  cameraActive: boolean
  detection: EmotionDetectionState
  selectedEmotion: Emotion | null
  selectionSource: EmotionSource | null
  confirmedEmotion: EmotionResult | null
  saveStatus: EmotionSaveStatus
  saveError: string | null
  onSelectManual: (emotion: Emotion) => void
  onUseDetected: () => void
  onConfirm: () => void
}

export function EmotionPanel({
  cameraActive,
  detection,
  selectedEmotion,
  selectionSource,
  confirmedEmotion,
  saveStatus,
  saveError,
  onSelectManual,
  onUseDetected,
  onConfirm,
}: EmotionPanelProps) {
  const detected = detection.detected
  const canConfirm =
    selectedEmotion !== null &&
    selectionSource !== null &&
    saveStatus !== 'saving'
  const detectedSelected =
    detected !== null &&
    selectionSource === 'CAMERA' &&
    selectedEmotion === detected.emotion

  function renderDetectionStatus() {
    if (!cameraActive) {
      return (
        <p>
          Activa la cámara para detectar tu emoción automáticamente. También
          puedes elegirla manualmente.
        </p>
      )
    }

    if (detection.modelStatus === 'loading') {
      return <p>Cargando el modelo de emociones…</p>
    }

    if (detection.modelStatus === 'error') {
      return (
        <p>
          {detection.error} Puedes elegir tu emoción manualmente mientras
          tanto.
        </p>
      )
    }

    if (detection.status === 'error') {
      return <p>{detection.error}</p>
    }

    if (detection.status === 'no-face') {
      return (
        <p>
          No se detecta ningún rostro. Colócate frente a la cámara con buena
          iluminación.
        </p>
      )
    }

    if (detection.status === 'detected' && detected) {
      return (
        <p className="camera-emotion-detected">
          Emoción detectada:{' '}
          <strong>{EMOTION_LABELS[detected.emotion]}</strong>
          <span className="camera-emotion-confidence">
            {Math.round(detected.confidence * 100)} % de confianza
          </span>
        </p>
      )
    }

    return <p>Analizando tu expresión…</p>
  }

  return (
    <div className="camera-emotion-panel">
      <div className="camera-emotion-block">
        <div className="camera-emotion-heading">
          <SparklesIcon />
          <div>
            <span className="eyebrow">Detección automática</span>
            <h3>Tu emoción en cámara</h3>
          </div>
        </div>

        <div
          className="camera-emotion-status"
          role="status"
          aria-live="polite"
        >
          {renderDetectionStatus()}
        </div>

        {detected && cameraActive && (
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={onUseDetected}
          >
            {detectedSelected
              ? 'Emoción detectada seleccionada'
              : 'Usar emoción detectada'}
          </button>
        )}
      </div>

      <div className="camera-emotion-block">
        <div className="camera-emotion-heading">
          <div>
            <span className="eyebrow">Selección manual</span>
            <h3>Elige cómo te sientes</h3>
          </div>
        </div>

        <div
          className="camera-emotion-options"
          role="group"
          aria-label="Selecciona tu emoción"
        >
          {EMOTION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="camera-emotion-option"
              aria-pressed={selectedEmotion === option.id}
              onClick={() => onSelectManual(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="camera-emotion-actions">
          <button
            type="button"
            className="button button-small"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {saveStatus === 'saving'
              ? 'Guardando emoción…'
              : 'Confirmar emoción'}
          </button>

          {selectedEmotion && (
            <span className="camera-emotion-selected">
              Seleccionada: {EMOTION_LABELS[selectedEmotion]}
              {selectionSource === 'CAMERA' ? ' (cámara)' : ' (manual)'}
            </span>
          )}
        </div>

        {confirmedEmotion && (
          <p className="camera-emotion-confirmed" role="status">
            Emoción confirmada:{' '}
            <strong>{EMOTION_LABELS[confirmedEmotion.emotion]}</strong>
            {confirmedEmotion.source === 'CAMERA' &&
            confirmedEmotion.confidence !== undefined
              ? ` (${Math.round(confirmedEmotion.confidence * 100)} % de confianza)`
              : ' (selección manual)'}
          </p>
        )}

        {confirmedEmotion && saveStatus === 'saving' && (
          <p className="camera-emotion-confirmed" role="status">
            Guardando tu emoción…
          </p>
        )}

        {confirmedEmotion && saveStatus === 'saved' && (
          <p className="camera-emotion-confirmed" role="status">
            Emoción guardada correctamente.
          </p>
        )}

        {confirmedEmotion && saveStatus === 'error' && (
          <p className="form-error" role="alert">
            {saveError ?? 'No pudimos guardar tu emoción. Inténtalo de nuevo.'}
          </p>
        )}
      </div>
    </div>
  )
}
