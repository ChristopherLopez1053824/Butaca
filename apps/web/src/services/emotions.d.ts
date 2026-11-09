import type { ApiEmotion, EmotionPayload } from '../lib/emotionContract'
import type { EmotionSource } from '../lib/emotions'

export interface EmotionRecord {
  id: string
  userId: string
  emotion: ApiEmotion
  source: EmotionSource
  confidence: number | null
  createdAt: string
}

export function createEmotion(payload: EmotionPayload): Promise<EmotionRecord>
