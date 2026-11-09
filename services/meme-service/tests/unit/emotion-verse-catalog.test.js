import { describe, expect, it } from 'vitest';
import {
  EMOTION_VERSE_CATALOG,
  getReferencesForEmotion
} from '../../src/domain/emotion-verse-catalog.js';

const FRONTEND_EMOTIONS = [
  'HAPPY',
  'SAD',
  'ANGRY',
  'TIRED',
  'NEUTRAL',
  'FEARFUL',
  'SURPRISED',
  'DISGUSTED'
];

// Formato USFM de 3 letras: LIBRO.capitulo.versiculo (p. ej. JHN.3.16).
const REFERENCE_PATTERN = /^[1-3A-Z]{2,3}\.\d+\.\d+$/;

describe('emotion-verse-catalog', () => {
  it('tiene referencias para las ocho emociones del frontend', () => {
    for (const emotion of FRONTEND_EMOTIONS) {
      expect(EMOTION_VERSE_CATALOG[emotion]).toBeDefined();
      expect(EMOTION_VERSE_CATALOG[emotion].length).toBeGreaterThan(0);
    }
  });

  it('cada referencia tiene un id con formato de cita bíblica y un tema', () => {
    for (const emotion of FRONTEND_EMOTIONS) {
      for (const reference of EMOTION_VERSE_CATALOG[emotion]) {
        expect(reference.id).toMatch(REFERENCE_PATTERN);
        expect(typeof reference.theme).toBe('string');
        expect(reference.theme.length).toBeGreaterThan(0);
      }
    }
  });

  it('no contiene texto bíblico, solo referencias', () => {
    for (const emotion of FRONTEND_EMOTIONS) {
      for (const reference of EMOTION_VERSE_CATALOG[emotion]) {
        expect(Object.keys(reference).sort()).toEqual(['id', 'theme']);
      }
    }
  });

  it('getReferencesForEmotion es insensible a mayúsculas/minúsculas', () => {
    expect(getReferencesForEmotion('happy')).toEqual(EMOTION_VERSE_CATALOG.HAPPY);
    expect(getReferencesForEmotion('HAPPY')).toEqual(EMOTION_VERSE_CATALOG.HAPPY);
  });

  it('getReferencesForEmotion devuelve null para una emoción sin catálogo', () => {
    expect(getReferencesForEmotion('CONTEMPT')).toBeNull();
    expect(getReferencesForEmotion('no-existe')).toBeNull();
    expect(getReferencesForEmotion(null)).toBeNull();
    expect(getReferencesForEmotion(undefined)).toBeNull();
  });
});
