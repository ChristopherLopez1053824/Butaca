import { describe, expect, it } from 'vitest';
import {
  decodeCursor,
  encodeCursor
} from '../../src/services/recommendation-cursor.service.js';

const PAYLOAD = {
  userId: '7f1d6a2e-3b4c-4d5e-8f90-123456789abc',
  emotionRecordId: '0b7c8d9e-1f20-4a3b-9c4d-567890abcdef',
  moviePage: 2,
  tvPage: 1,
  movieExhausted: false,
  tvExhausted: true,
  delivered: ['MOVIE:550', 'TV:1399', 'MOVIE:550']
};

describe('recommendation cursor', () => {
  it('firma y recupera el estado', () => {
    const cursor = encodeCursor(PAYLOAD);
    const decoded = decodeCursor(cursor);

    expect(decoded).toEqual({
      ...PAYLOAD,
      v: 1,
      delivered: ['MOVIE:550', 'TV:1399']
    });
  });

  it('rechaza un cursor manipulado', () => {
    const cursor = encodeCursor(PAYLOAD);
    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith('a') ? 'b' : 'a'}`;

    expect(() => decodeCursor(tampered)).toThrow(expect.objectContaining({
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    }));
  });

  it('rechaza un cursor con formato inválido', () => {
    expect(() => decodeCursor('no-es-un-cursor')).toThrow(expect.objectContaining({
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    }));
  });
});
