import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Dashboard Service - Tests de Integracion', () => {
  it('GET /health debe responder 200 y status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('dashboard-service');
  });

  it('GET /api/dashboard/summary debe rechazar con 401 si no hay token', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('GET /summary debe rechazar con 401 si no hay token', async () => {
    const res = await request(app).get('/summary');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});