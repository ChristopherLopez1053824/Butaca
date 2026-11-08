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

  it('GET /api/memes debe rechazar con 401 si no hay token', async () => {
    const res = await request(app).get('/api/memes');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/memes/history debe rechazar con 401 si no hay token', async () => {
    const res = await request(app)
      .post('/api/memes/history')
      .send({
        provider: 'internal',
        imageUrl: 'https://example.com/test.jpg'
      });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});