import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  detectEmotion,
  loadEmotionModels,
  type DetectedEmotion,
} from '../services/faceEmotionDetection'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'
export type DetectionStatus =
  | 'idle'
  | 'detecting'
  | 'no-face'
  | 'detected'
  | 'error'

export interface EmotionDetectionState {
  modelStatus: ModelStatus
  status: DetectionStatus
  detected: DetectedEmotion | null
  error: string | null
}

const DETECTION_INTERVAL_MS = 800
const VIDEO_WAIT_MS = 400

const INITIAL_STATE: EmotionDetectionState = {
  modelStatus: 'idle',
  status: 'idle',
  detected: null,
  error: null,
}

const DETECTION_ERROR_MESSAGE =
  'No se pudo analizar el video. Puedes seleccionar tu emoción manualmente.'

export function useEmotionDetection(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): EmotionDetectionState {
  const [state, setState] = useState<EmotionDetectionState>(INITIAL_STATE)
  const lastKeyRef = useRef('')

  useEffect(() => {
    if (!enabled) {
      lastKeyRef.current = ''
      setState(INITIAL_STATE)
      return
    }

    let cancelled = false
    let inFlight = false
    let timer: number | undefined

    setState({
      modelStatus: 'loading',
      status: 'idle',
      detected: null,
      error: null,
    })

    function schedule(delay: number) {
      if (cancelled) {
        return
      }

      timer = window.setTimeout(() => {
        void run()
      }, delay)
    }

    async function run() {
      if (cancelled || inFlight) {
        return
      }

      const video = videoRef.current

      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        schedule(VIDEO_WAIT_MS)
        return
      }

      inFlight = true

      try {
        const detected = await detectEmotion(video)

        if (cancelled) {
          return
        }

        if (!detected) {
          if (lastKeyRef.current !== 'no-face') {
            lastKeyRef.current = 'no-face'
            setState((previous) => ({
              ...previous,
              status: 'no-face',
              detected: null,
              error: null,
            }))
          }
          return
        }

        const confidence = Math.round(detected.confidence * 100) / 100
        const key = `${detected.emotion}:${confidence}`

        if (key !== lastKeyRef.current) {
          lastKeyRef.current = key
          setState((previous) => ({
            ...previous,
            status: 'detected',
            detected: { ...detected, confidence },
            error: null,
          }))
        }
      } catch {
        if (cancelled) {
          return
        }

        if (lastKeyRef.current !== 'error') {
          lastKeyRef.current = 'error'
          setState((previous) => ({
            ...previous,
            status: 'error',
            error: DETECTION_ERROR_MESSAGE,
          }))
        }
      } finally {
        inFlight = false
        schedule(DETECTION_INTERVAL_MS)
      }
    }

    loadEmotionModels()
      .then(() => {
        if (cancelled) {
          return
        }

        setState((previous) => ({
          ...previous,
          modelStatus: 'ready',
          status: 'detecting',
        }))
        void run()
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setState({
          modelStatus: 'error',
          status: 'error',
          detected: null,
          error:
            'No se pudieron cargar los modelos de detección de emociones.',
        })
      })

    return () => {
      cancelled = true

      if (timer !== undefined) {
        window.clearTimeout(timer)
      }
    }
  }, [enabled, videoRef])

  return state
}
