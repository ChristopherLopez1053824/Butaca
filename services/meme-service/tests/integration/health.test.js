import { describe, it, expect, vi } from 'vitest';

// Garantiza que la variable exista antes de importar cualquier modulo
vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/butaca';
});

import request from 'supertest';
import app from '../../src/app.js';

describe('Meme Service - Tests de Integracion', () => {
  it('GET /health debe responder 200 y status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('meme-service');
  });

  it('GET / debe rechazar con 401 si no hay token', async () => {
    const res = await request(app).get('/').query({ emotion: 'HAPPY' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('POST /history debe rechazar con 401 si no hay token', async () => {
    const res = await request(app)
      .post('/history')
      .send({
        provider: 'RVR1960',
        externalId: 'JHN.3.16'
      });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('GET /history debe rechazar con 401 si no hay token', async () => {
    const res = await request(app).get('/history');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
