import { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/camera.css'
import { CameraIcon, SparklesIcon } from './icons'

type CameraStatus = 'idle' | 'confirming' | 'requesting' | 'active' | 'error'

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'No se concedió permiso para usar la cámara. Pulsa “Activar cámara” y acepta el permiso en tu navegador.'
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No encontramos una cámara disponible en este dispositivo.'
      case 'NotReadableError':
        return 'No pudimos acceder a la cámara. Puede estar siendo usada por otra aplicación.'
      case 'AbortError':
        return 'Se interrumpió el acceso a la cámara. Inténtalo de nuevo.'
      default:
        return 'Ocurrió un error al activar la cámara. Inténtalo de nuevo.'
    }
  }

  return 'No se pudo activar la cámara. Revisa los permisos del navegador e inténtalo de nuevo.'
}

function getStatusLabel(status: CameraStatus) {
  if (status === 'confirming') {
    return 'Esperando confirmación'
  }

  if (status === 'requesting') {
    return 'Solicitando permiso...'
  }

  if (status === 'active') {
    return 'Cámara activa'
  }

  if (status === 'error') {
    return 'No se pudo activar la cámara'
  }

  return 'Cámara apagada'
}

export function CameraSection() {
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const activateButtonRef = useRef<HTMLButtonElement>(null)
  const mountedRef = useRef(true)
  const requestRef = useRef(0)

  const stopStream = useCallback(() => {
    const stream = streamRef.current

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      requestRef.current += 1
      stopStream()
    }
  }, [stopStream])

  useEffect(() => {
    if (status !== 'active') {
      return
    }

    const video = videoRef.current
    const stream = streamRef.current

    if (!video || !stream) {
      return
    }

    video.srcObject = stream
    void video.play().catch(() => undefined)
  }, [status])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'Tu navegador no permite acceder a la cámara. Usa un navegador actualizado y una conexión segura (HTTPS o localhost).',
      )
      setStatus('error')
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setError(null)
    setStatus('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })

      if (!mountedRef.current || requestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      setStatus('active')
    } catch (cameraError) {
      if (!mountedRef.current || requestRef.current !== requestId) {
        return
      }

      stopStream()
      setError(getCameraErrorMessage(cameraError))
      setStatus('error')
    }
  }, [stopStream])

  const stopCamera = useCallback(() => {
    requestRef.current += 1
    stopStream()
    setError(null)
    setStatus('idle')
  }, [stopStream])

  const openConfirmation = useCallback(() => {
    setError(null)
    setStatus('confirming')
  }, [])

  const cancelConfirmation = useCallback(() => {
    setStatus('idle')
    activateButtonRef.current?.focus()
  }, [])

  const acceptConfirmation = useCallback(() => {
    void startCamera()
  }, [startCamera])

  useEffect(() => {
    if (status !== 'confirming') {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelConfirmation()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [status, cancelConfirmation])

  const isCameraVisible = status === 'active'
  const isRequesting = status === 'requesting'

  return (
    <section className="camera-card" aria-labelledby="camera-title">
      <div className="camera-card-header">
        <div>
          <span className="eyebrow">Reconocimiento en vivo</span>
          <h2 id="camera-title">Cámara de reconocimiento</h2>
          <p>
            Activa tu cámara para verte en pantalla mientras Butaca prepara tus
            recomendaciones. La imagen no se guarda ni se envía al servidor.
          </p>
        </div>

        <div
          className={`camera-state ${status}`}
          role="status"
          aria-live="polite"
        >
          <span className="camera-state-dot" aria-hidden="true" />
          {getStatusLabel(status)}
        </div>
      </div>

      <div className={`camera-frame ${status}`}>
        {(isCameraVisible || isRequesting) && (
          <video
            ref={videoRef}
            className="camera-video"
            hidden={!isCameraVisible}
            autoPlay
            muted
            playsInline
            aria-label="Vista previa en tiempo real de tu cámara"
          />
        )}

        {isRequesting && (
          <div className="camera-placeholder">
            <span className="camera-spinner" aria-hidden="true" />
            <p>Esperando la respuesta de tu navegador</p>
            <p className="camera-hint">
              Acepta el permiso en el cuadro de diálogo para ver la vista previa.
            </p>
          </div>
        )}

        {!isCameraVisible && !isRequesting && (
          <div className="camera-idle">
            <div className="camera-idle-visual" aria-hidden="true">
              <span className="camera-orbit camera-orbit-one" />
              <span className="camera-orbit camera-orbit-two" />
              <span className="camera-idle-icon">
                <CameraIcon />
              </span>
              <SparklesIcon className="camera-spark camera-spark-one" />
              <SparklesIcon className="camera-spark camera-spark-two" />
            </div>
            <h3>
              {status === 'error'
                ? 'No pudimos activar la cámara'
                : 'Tu cámara está apagada'}
            </h3>
            <p>
              {status === 'error'
                ? 'Revisa el mensaje y vuelve a intentarlo.'
                : 'Actívala para verte aquí mientras Butaca prepara tus recomendaciones.'}
            </p>

            <div className="camera-control">
              <button
                ref={activateButtonRef}
                type="button"
                className="button"
                onClick={openConfirmation}
                aria-expanded={status === 'confirming'}
                aria-controls="camera-consent-panel"
                aria-haspopup="dialog"
              >
                Activar cámara
              </button>

              {status === 'confirming' && (
                <div
                  id="camera-consent-panel"
                  className="camera-consent"
                  role="dialog"
                  aria-modal="false"
                  aria-labelledby="camera-consent-title"
                  aria-describedby="camera-consent-description"
                >
                  <h3 id="camera-consent-title">¿Activar tu cámara?</h3>
                  <p id="camera-consent-description">
                    Usaremos tu cámara para mostrarte en la pantalla de Butaca.
                    La imagen no se guarda ni se envía al servidor.
                  </p>

                  <div className="camera-consent-actions">
                    <button
                      type="button"
                      className="button"
                      autoFocus
                      onClick={acceptConfirmation}
                    >
                      Aceptar y activar
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={cancelConfirmation}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isCameraVisible && (
          <>
            <div className="camera-live-badge">
              <span aria-hidden="true" />
              En vivo
            </div>

            <div className="camera-frame-actions">
              <button
                type="button"
                className="button button-danger button-small"
                onClick={stopCamera}
              >
                Detener cámara
              </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <p className="camera-privacy">
        Puedes detener la cámara en cualquier momento. Butaca no guarda ni envía
        tu imagen.
      </p>
    </section>
  )
}
