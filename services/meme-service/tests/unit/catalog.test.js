import { describe, it, expect } from 'vitest';

const MEMES_POR_EMOCION = {
  HAPPY: [
    { provider: 'internal', imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba' }
  ],
  NEUTRAL: [
    { provider: 'internal', imageUrl: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5' }
  ]
};

function obtenerMemes(emocion) {
  const clave = (emocion || 'NEUTRAL').toUpperCase();
  return MEMES_POR_EMOCION[clave] || MEMES_POR_EMOCION.NEUTRAL;
}

describe('Meme Service - Pruebas Unitarias del Catalogo', () => {
  it('Debe devolver memes correspondientes a la emocion HAPPY', () => {
    const resultado = obtenerMemes('HAPPY');
    expect(resultado).toBeInstanceOf(Array);
    expect(resultado.length).toBeGreaterThan(0);
    expect(resultado[0].provider).toBe('internal');
  });

  it('Debe aplicar fallback a NEUTRAL si la emocion es desconocida o nula', () => {
    const resultadoDesconocido = obtenerMemes('EMOCION_INVENTADA');
    const resultadoNulo = obtenerMemes(null);

    expect(resultadoDesconocido).toEqual(MEMES_POR_EMOCION.NEUTRAL);
    expect(resultadoNulo).toEqual(MEMES_POR_EMOCION.NEUTRAL);
  });
});