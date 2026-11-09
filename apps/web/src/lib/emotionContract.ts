import type { Emotion, EmotionResult, EmotionSource } from './emotions'

export const API_EMOTIONS = [
  'HAPPY',
  'SAD',
  'ANGRY',
  'TIRED',
  'NEUTRAL',
  'FEARFUL',
  'SURPRISED',
  'DISGUSTED',
] as const

export type ApiEmotion = (typeof API_EMOTIONS)[number]

export const API_EMOTION_LABELS: Record<ApiEmotion, string> = {
  HAPPY: 'Felicidad',
  SAD: 'Tristeza',
  ANGRY: 'Enojo',
  TIRED: 'Cansancio',
  NEUTRAL: 'Neutral',
  FEARFUL: 'Miedo',
  SURPRISED: 'Sorpresa',
  DISGUSTED: 'Asco',
}

export const FRONTEND_TO_API_EMOTION: Record<Emotion, ApiEmotion> = {
  happy: 'HAPPY',
  sad: 'SAD',
  angry: 'ANGRY',
  tired: 'TIRED',
  neutral: 'NEUTRAL',
  fearful: 'FEARFUL',
  surprised: 'SURPRISED',
  disgusted: 'DISGUSTED',
}

export interface EmotionPayload {
  emotion: ApiEmotion
  source: EmotionSource
  confidence?: number
}

export function toApiEmotion(emotion: Emotion): ApiEmotion {
  return FRONTEND_TO_API_EMOTION[emotion]
}

export function buildEmotionPayload(result: EmotionResult): EmotionPayload {
  const emotion = toApiEmotion(result.emotion)

  if (result.source === 'MANUAL') {
    return { emotion, source: 'MANUAL' }
  }

  if (
    result.confidence === undefined ||
    !Number.isFinite(result.confidence) ||
    result.confidence < 0 ||
    result.confidence > 1
  ) {
    throw new Error('La confianza de la cámara debe estar entre 0 y 1.')
  }

  return {
    emotion,
    source: 'CAMERA',
    confidence: result.confidence,
  }
}

export function getApiEmotionLabel(emotion: ApiEmotion): string {
  return API_EMOTION_LABELS[emotion]
}
