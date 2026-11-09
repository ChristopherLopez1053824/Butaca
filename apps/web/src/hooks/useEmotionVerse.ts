import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError } from '../services/api'
import { getVerseForEmotion, recordVerseHistory } from '../services/verses'
import type { BibleVerse } from '../services/verses'

export type EmotionVerseStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'not-configured'
  | 'error'

export interface EmotionVerseState {
  status: EmotionVerseStatus
  verse: BibleVerse | null
  error: string | null
}

export interface EmotionVerse extends EmotionVerseState {
  reload: () => void
}

const INITIAL_STATE: EmotionVerseState = {
  status: 'idle',
  verse: null,
  error: null,
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error ? (error as ApiError).code : undefined
}

export function useEmotionVerse(
  emotion: string | null,
  emotionRecordId: string | null,
): EmotionVerse {
  const [state, setState] = useState<EmotionVerseState>(INITIAL_STATE)
  const requestIdRef = useRef(0)
  const recordedForRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!emotion) {
      requestIdRef.current += 1
      setState(INITIAL_STATE)
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setState({ status: 'loading', verse: null, error: null })

    try {
      const verse = await getVerseForEmotion({ emotion })

      if (requestId !== requestIdRef.current) {
        return
      }

      setState({ status: 'ready', verse, error: null })

      if (emotionRecordId && recordedForRef.current !== emotionRecordId) {
        recordedForRef.current = emotionRecordId

        void recordVerseHistory({
          provider: verse.translation,
          externalId: verse.externalId,
          title: `${verse.reference} (${verse.translation})`,
          emotionRecordId,
        }).catch(() => {
          // El historial es best-effort: si falla, no afecta lo que ya se
          // le mostró al usuario.
        })
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return
      }

      const code = errorCode(error)

      setState({
        status: code === 'SERVICE_NOT_CONFIGURED' ? 'not-configured' : 'error',
        verse: null,
        error: toMessage(error, 'No pudimos cargar el versículo de hoy.'),
      })
    }
  }, [emotion, emotionRecordId])

  useEffect(() => {
    void load()
  }, [load])

  return {
    ...state,
    reload: () => {
      void load()
    },
  }
}
