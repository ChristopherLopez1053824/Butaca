// Relaciona cada una de las ocho emociones del frontend con un tema y una
// lista de referencias bíblicas reales (libro.capítulo.versículo, notación
// USFM de 3 letras, la misma que usan la mayoría de proveedores incluido
// api.bible). Esto NO contiene texto bíblico: una referencia es una cita,
// no una obra protegida. El texto siempre se obtiene en vivo del proveedor
// configurado (ver src/clients/bible.client.js), nunca se guarda aquí.
//
// No modifica los valores del enum Emotion de Prisma: solo usa las ocho
// emociones que ya expone el frontend (ver apps/web/src/lib/emotions.ts).

export const EMOTION_VERSE_CATALOG = Object.freeze({
  HAPPY: Object.freeze([
    Object.freeze({ id: 'PHP.4.4', theme: 'alegría' }),
    Object.freeze({ id: '1TH.5.16', theme: 'gratitud' }),
    Object.freeze({ id: 'PSA.100.2', theme: 'alegría' })
  ]),
  SAD: Object.freeze([
    Object.freeze({ id: 'PSA.34.18', theme: 'consuelo' }),
    Object.freeze({ id: 'MAT.5.4', theme: 'consuelo' }),
    Object.freeze({ id: 'ISA.41.10', theme: 'esperanza' })
  ]),
  ANGRY: Object.freeze([
    Object.freeze({ id: 'EPH.4.26', theme: 'paz' }),
    Object.freeze({ id: 'JAS.1.19', theme: 'paciencia' }),
    Object.freeze({ id: 'PRO.15.1', theme: 'paz' })
  ]),
  TIRED: Object.freeze([
    Object.freeze({ id: 'MAT.11.28', theme: 'descanso' }),
    Object.freeze({ id: 'ISA.40.31', theme: 'fortaleza' }),
    Object.freeze({ id: 'PSA.23.1', theme: 'descanso' })
  ]),
  NEUTRAL: Object.freeze([
    Object.freeze({ id: 'PRO.3.5', theme: 'sabiduría' }),
    Object.freeze({ id: 'JER.29.11', theme: 'propósito' }),
    Object.freeze({ id: 'JAS.1.5', theme: 'sabiduría' })
  ]),
  FEARFUL: Object.freeze([
    Object.freeze({ id: 'JOS.1.9', theme: 'valentía' }),
    Object.freeze({ id: 'PSA.27.1', theme: 'confianza' }),
    Object.freeze({ id: '2TI.1.7', theme: 'valentía' })
  ]),
  SURPRISED: Object.freeze([
    Object.freeze({ id: 'PSA.139.14', theme: 'asombro' }),
    Object.freeze({ id: 'PSA.118.23', theme: 'asombro' }),
    Object.freeze({ id: 'PSA.40.5', theme: 'gratitud' })
  ]),
  DISGUSTED: Object.freeze([
    Object.freeze({ id: '2CO.5.17', theme: 'renovación' }),
    Object.freeze({ id: 'LAM.3.22', theme: 'perdón' }),
    Object.freeze({ id: 'COL.3.13', theme: 'perdón' })
  ])
});

export function getReferencesForEmotion(emotion) {
  if (typeof emotion !== 'string') {
    return null;
  }

  return EMOTION_VERSE_CATALOG[emotion.toUpperCase()] ?? null;
}
