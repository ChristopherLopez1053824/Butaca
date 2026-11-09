import { describe, it, expect } from 'vitest';

function calcularFrecuencias(emociones) {
  const frecuencia = {};
  for (const item of emociones) {
    const emocion = item.emotion || 'NEUTRAL';
    frecuencia[emocion] = (frecuencia[emocion] || 0) + 1;
  }
  return frecuencia;
}

describe('Dashboard Service - Pruebas Unitarias de Agregacion', () => {
  it('Debe calcular correctamente la frecuencia de cada emocion', () => {
    const datosEntrada = [
      { id: '1', emotion: 'HAPPY' },
      { id: '2', emotion: 'HAPPY' },
      { id: '3', emotion: 'SAD' }
    ];

    const frecuencias = calcularFrecuencias(datosEntrada);

    expect(frecuencias.HAPPY).toBe(2);
    expect(frecuencias.SAD).toBe(1);
    expect(frecuencias.SURPRISED).toBeUndefined();
  });

  it('Debe manejar un arreglo vacio sin errores', () => {
    const frecuencias = calcularFrecuencias([]);
    expect(frecuencias).toEqual({});
  });
});