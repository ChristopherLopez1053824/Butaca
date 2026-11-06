
import { describe, it, expect } from 'vitest';
import { emotionSchema } from '../../src/validations/emotion.schema.js';

describe('Emotion Service - Validaciones Zod', () => {

  const emociones = [
    'SAD',
    'ANGRY',
    'FEARFUL',
    'DISGUSTED',
    'NEGATIVE_SURPRISE',
    'CONTEMPT',
    'FRUSTRATION',
    'CONFUSION',
    'SHAME',
    'BOREDOM'
  ];

  it.each(emociones)(
    'acepta la emocion %s',
    (emotion) => {
      const result = emotionSchema.safeParse({
        emotion,
        source: 'MANUAL'
      });

      expect(result.success).toBe(true);
    }
  );

  it('rechaza emociones no permitidas', () => {
    const result = emotionSchema.safeParse({
      emotion: 'HUNGRY',
      source: 'MANUAL'
    });

    expect(result.success).toBe(false);
  });

  it('rechaza un origen invalido', () => {
    const result = emotionSchema.safeParse({
      emotion: 'SAD',
      source: 'DESCONOCIDO'
    });

    expect(result.success).toBe(false);
  });

  it('acepta una emocion manual sin confianza', () => {
    const result = emotionSchema.safeParse({
      emotion: 'SAD',
      source: 'MANUAL'
    });

    expect(result.success).toBe(true);
  });

  it('rechaza confianza en seleccion manual', () => {
    const result = emotionSchema.safeParse({
      emotion: 'SAD',
      source: 'MANUAL',
      confidence: 0.9
    });

    expect(result.success).toBe(false);
  });

  it('exige confianza cuando el origen es CAMERA', () => {
    const result = emotionSchema.safeParse({
      emotion: 'SAD',
      source: 'CAMERA'
    });

    expect(result.success).toBe(false);
  });

  it.each([0, 0.5, 1])(
    'acepta confianza %s para CAMERA',
    (confidence) => {
      const result = emotionSchema.safeParse({
        emotion: 'SAD',
        source: 'CAMERA',
        confidence
      });

      expect(result.success).toBe(true);
    }
  );

  it.each([-0.1, 1.1])(
    'rechaza confianza fuera de rango: %s',
    (confidence) => {
      const result = emotionSchema.safeParse({
        emotion: 'SAD',
        source: 'CAMERA',
        confidence
      });

      expect(result.success).toBe(false);
    }
  );

  it('rechaza un userId enviado en el body', () => {
    const result = emotionSchema.safeParse({
      emotion: 'SAD',
      source: 'MANUAL',
      userId: 'otro-usuario'
    });

    expect(result.success).toBe(false);
  });

  it('rechaza campos obligatorios faltantes', () => {
    const result = emotionSchema.safeParse({
      emotion: 'SAD'
    });

    expect(result.success).toBe(false);
  });

});
