
import { z } from 'zod';

// Emociones permitidas en Butaca
export const emotionSchema = z.object({
  emotion: z.enum([
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
  ]),

  // Origen de la emoción
  source: z.enum(['CAMERA', 'MANUAL']),

  // Nivel de confianza entre 0 y 1
  confidence: z.number().min(0).max(1).optional()

}).strict().superRefine((data, ctx) => {

  // La cámara debe proporcionar confianza
  if (data.source === 'CAMERA' && data.confidence === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['confidence'],
      message: 'La confianza es obligatoria cuando se utiliza la cámara.'
    });
  }

  // Las emociones manuales no necesitan confianza
  if (data.source === 'MANUAL' && data.confidence !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['confidence'],
      message: 'La selección manual no debe incluir confianza.'
    });
  }
});
