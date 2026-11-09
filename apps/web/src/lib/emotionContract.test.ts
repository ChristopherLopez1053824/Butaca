import { describe, expect, it } from 'vitest'
import {
  API_EMOTIONS,
  buildEmotionPayload,
  getApiEmotionLabel,
  toApiEmotion,
} from './emotionContract'
import type { Emotion } from './emotions'

const FRONTEND_EMOTIONS: Emotion[] = [
  'happy',
  'sad',
  'angry',
  'tired',
  'neutral',
  'fearful',
  'surprised',
  'disgusted',
]

describe('emotionContract', () => {
  it('convierte las ocho emociones del frontend sin equivalencias adicionales', () => {
    expect(FRONTEND_EMOTIONS.map(toApiEmotion)).toEqual([...API_EMOTIONS])
  })

  it('mantiene SURPRISED separada de NEGATIVE_SURPRISE', () => {
    expect(toApiEmotion('surprised')).toBe('SURPRISED')
  })

  it('construye una carga CAMERA con confianza', () => {
    expect(
      buildEmotionPayload({
        emotion: 'happy',
        source: 'CAMERA',
        confidence: 0.92,
      }),
    ).toEqual({
      emotion: 'HAPPY',
      source: 'CAMERA',
      confidence: 0.92,
    })
  })

  it('construye una carga MANUAL sin confianza', () => {
    expect(
      buildEmotionPayload({
        emotion: 'tired',
        source: 'MANUAL',
        confidence: 0.5,
      }),
    ).toEqual({
      emotion: 'TIRED',
      source: 'MANUAL',
    })
  })

  it('rechaza CAMERA sin una confianza válida', () => {
    expect(() =>
      buildEmotionPayload({ emotion: 'sad', source: 'CAMERA' }),
    ).toThrow('La confianza de la cámara debe estar entre 0 y 1.')

    expect(() =>
      buildEmotionPayload({
        emotion: 'sad',
        source: 'CAMERA',
        confidence: 1.2,
      }),
    ).toThrow('La confianza de la cámara debe estar entre 0 y 1.')
  })

  it('expone etiquetas legibles para las emociones de la API', () => {
    expect(getApiEmotionLabel('FEARFUL')).toBe('Miedo')
    expect(getApiEmotionLabel('SURPRISED')).toBe('Sorpresa')
  })
})
