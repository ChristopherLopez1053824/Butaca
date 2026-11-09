import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// requireAuth y la base se simulan: aquí se prueba la lógica del servicio.
vi.mock('@butaca/auth', () => ({
  requireAuth: (req, res, next) => {
    req.auth = { userId: '7f1d6a2e-3b4c-4d5e-8f90-123456789abc' };
    next();
  }
}));

const withUserContext = vi.fn();
vi.mock('@butaca/database', () => ({ withUserContext: (...args) => withUserContext(...args) }));

const { default: app } = await import('../../src/app.js');

const MEME = { provider: 'internal', imageUrl: 'https://example.com/meme.png' };

beforeEach(() => {
  withUserContext.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET / (catálogo)', () => {
  it.each(['SAD', 'FRUSTRATION', 'BOREDOM'])('devuelve imágenes para %s', async (emotion) => {
    const response = await request(app).get(`/?emotion=${emotion}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it.each(['HAPPY', 'LO_QUE_SEA', ''])('rechaza la emoción "%s"', async (emotion) => {
    const response = await request(app).get(`/?emotion=${emotion}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /history', () => {
  it('responde 404 si RLS rechaza la emoción por no existir o ser de otro usuario', async () => {
    withUserContext.mockRejectedValue(
      new Error('Database error. Code: `42501`. Message: `new row violates row-level security policy`')
    );

    const response = await request(app)
      .post('/history')
      .send({ ...MEME, emotionRecordId: '550e8400-e29b-41d4-a716-446655440000' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'La emoción indicada no existe'
    });
  });

  it('no expone el mensaje interno de un error inesperado', async () => {
    withUserContext.mockRejectedValue(new Error('Invalid `prisma.memeHistory.create()` invocation'));

    const response = await request(app).post('/history').send(MEME);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor'
    });
  });

  it('devuelve los detalles de validación', async () => {
    const response = await request(app).post('/history').send({ provider: 'internal', imageUrl: 'no-es-url' });

    expect(response.status).toBe(400);
    expect(response.body.details[0].path).toEqual(['imageUrl']);
  });
});
