import http from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Simula requireAuth: aquí solo interesa cómo Dashboard consulta a los demás servicios.
vi.mock('@butaca/auth', () => ({
  requireAuth: (req, res, next) => {
    req.auth = { userId: '7f1d6a2e-3b4c-4d5e-8f90-123456789abc' };
    next();
  }
}));

let app;
let servers = [];
let received = [];

// Cada servicio simulado responde solo en la ruta que declara el servicio real.
function stub(routes) {
  const server = http.createServer((req, res) => {
    received.push(`${req.method} ${req.url}`);
    const path = req.url.split('?')[0];
    const body = routes[path];

    res.writeHead(body ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body ?? { status: 'error', code: 'NOT_FOUND' }));
  });

  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

beforeAll(async () => {
  process.env.EMOTION_SERVICE_URL = await stub({
    '/api/emotions': {
      success: true,
      data: [
        { id: 'e1', emotion: 'SAD', source: 'CAMERA', confidence: 0.9, createdAt: '2026-11-01T10:00:00.000Z' },
        { id: 'e2', emotion: 'SAD', source: 'MANUAL', confidence: null, createdAt: '2026-11-02T10:00:00.000Z' }
      ],
      pagination: { page: 1, limit: 100, total: 2 }
    }
  });
  process.env.MOVIE_SERVICE_URL = await stub({
    '/recommendations': { status: 'ok', data: [{ id: 'r1', title: 'Película' }], pagination: { page: 1, limit: 100, total: 150 } }
  });
  process.env.FAVORITES_SERVICE_URL = await stub({
    '/': { status: 'ok', data: [{ id: 'f1' }], pagination: { page: 1, limit: 100, total: 1 } }
  });
  // Meme Service apagado: Dashboard debe responder igual y avisarlo.
  process.env.MEME_SERVICE_URL = 'http://127.0.0.1:1';

  ({ default: app } = await import('../../src/app.js'));
});

afterAll(() => {
  servers.forEach((server) => server.close());
});

describe('GET /summary', () => {
  it('consulta a cada servicio en la ruta del contrato', async () => {
    received = [];
    await request(app).get('/summary');

    expect(received).toEqual(expect.arrayContaining([
      'GET /api/emotions?limit=100',
      'GET /recommendations?limit=100',
      'GET /?limit=100'
    ]));
  });

  it('usa el total real de cada servicio y avisa cuál no respondió', async () => {
    const response = await request(app).get('/summary');

    expect(response.status).toBe(200);
    expect(response.body.data.resumen).toEqual({
      totalEmociones: 2,
      totalRecomendaciones: 150,
      totalFavoritos: 1,
      totalMemes: 0
    });
    expect(response.body.data.frecuenciaEmociones).toEqual({ SAD: 2 });
    expect(response.body.data.advertencias).toEqual({ serviciosNoDisponibles: ['meme-service'] });
  });

  it('reenvía los filtros de fecha', async () => {
    received = [];
    await request(app).get('/summary?from=2026-11-01T00:00:00.000Z');

    expect(received).toContain('GET /api/emotions?from=2026-11-01T00%3A00%3A00.000Z&limit=100');
  });
});
