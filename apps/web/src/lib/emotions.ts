export const EMOTION_LABELS = {
  happy: 'Felicidad',
  sad: 'Tristeza',
  angry: 'Enojo',
  tired: 'Cansancio',
  neutral: 'Neutral',
  fearful: 'Miedo',
  surprised: 'Sorpresa',
  disgusted: 'Asco',
} as const

export type Emotion = keyof typeof EMOTION_LABELS

export const EMOTION_IDS = Object.keys(EMOTION_LABELS) as Emotion[]

export const EMOTION_OPTIONS = EMOTION_IDS.map((id) => ({
  id,
  label: EMOTION_LABELS[id],
}))

export const FACE_EXPRESSIONS = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
] as const

export type FaceExpression = (typeof FACE_EXPRESSIONS)[number]

export const FACE_EXPRESSION_TO_EMOTION: Record<FaceExpression, Emotion> = {
  neutral: 'neutral',
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  fearful: 'fearful',
  disgusted: 'disgusted',
  surprised: 'surprised',
}

export type EmotionSource = 'CAMERA' | 'MANUAL'

export type EmotionSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface EmotionResult {
  emotion: Emotion
  source: EmotionSource
  confidence?: number
}
