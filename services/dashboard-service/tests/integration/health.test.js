import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Simulamos la libreria @butaca/auth para que acepte un usuario de prueba
vi.mock('@butaca/auth', () => ({
  requireAuth: (req, res, next) => {
    req.auth = { userId: '11111111-1111-1111-1111-111111111111', role: 'authenticated' };
    next();
  }
}));

import app from '../../src/app.js';

describe('Dashboard Service - Pruebas de Logica y Agregacion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /health debe responder 200 y status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('dashboard-service');
  });

  it('GET /api/dashboard/summary debe calcular totales y frecuencias correctamente', async () => {
    // Simulamos que los otros servicios responden con datos reales
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url.includes('emotions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'ok',
            data: [
              { id: 'e1', emotion: 'HAPPY', source: 'CAMERA', confidence: 0.95, createdAt: '2026-11-01T10:00:00Z' },
              { id: 'e2', emotion: 'HAPPY', source: 'MANUAL', confidence: null, createdAt: '2026-11-02T10:00:00Z' },
              { id: 'e3', emotion: 'SAD', source: 'MANUAL', confidence: null, createdAt: '2026-11-03T10:00:00Z' }
            ]
          })
        });
      }
      if (url.includes('movies')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'ok',
            data: [{ id: 'm1', title: 'Inside Out' }]
          })
        });
      }
      // Favoritos y Memes responden vacios
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: 'ok', data: [] })
      });
    });

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    
    // Verificamos los calculos matematicos del agregador
    expect(res.body.data.resumen.totalEmociones).toBe(3);
    expect(res.body.data.resumen.totalRecomendaciones).toBe(1);
    expect(res.body.data.resumen.totalFavoritos).toBe(0);
    expect(res.body.data.frecuenciaEmociones.HAPPY).toBe(2);
    expect(res.body.data.frecuenciaEmociones.SAD).toBe(1);
    expect(res.body.data.advertencias).toBeNull();
  });

  it('GET /api/dashboard/summary debe tolerar caidas de servicios secundarios', async () => {
    // Simulamos que movie-service y meme-service fallan por timeout o caida
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (url.includes('movies') || url.includes('memes')) {
        return Promise.reject(new Error('Conexion rechazada'));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: 'ok', data: [] })
      });
    });

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    // El dashboard entrega lo que tiene y advierte de los que fallaron
    expect(res.body.data.advertencias.serviciosNoDisponibles).toContain('movie-service');
    expect(res.body.data.advertencias.serviciosNoDisponibles).toContain('meme-service');
  });
});