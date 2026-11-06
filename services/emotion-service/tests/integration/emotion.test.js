
import 'dotenv/config';

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll
} from 'vitest';

import request from 'supertest';
import { randomUUID } from 'node:crypto';

const tokenA = process.env.TEST_JWT;
const tokenB = process.env.TEST_JWT_2;

let app;
let userA;
let userB;

const registrosA = [];
const registrosB = [];

describe('Emotion Service - Integracion real', () => {

  beforeAll(async () => {
    if (!tokenA) {
      throw new Error(
        'Falta TEST_JWT. Obtén un JWT real de Supabase Auth.'
      );
    }

    const module = await import('../../src/app.js');
    app = module.default;
  });

  afterAll(async () => {
    if (!registrosA.length && !registrosB.length) {
      return;
    }

    const { withUserContext, prisma } =
      await import('@butaca/database');

    try {
      if (userA && registrosA.length) {
        await withUserContext(userA, (tx) =>
          tx.emotionRecord.deleteMany({
            where: {
              userId: userA,
              id: { in: registrosA.map(r => r.id) }
            }
          })
        );
      }

      if (userB && registrosB.length) {
        await withUserContext(userB, (tx) =>
          tx.emotionRecord.deleteMany({
            where: {
              userId: userB,
              id: { in: registrosB.map(r => r.id) }
            }
          })
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  const authA = () => ({
    Authorization: `Bearer ${tokenA}`
  });

  const authB = () => ({
    Authorization: `Bearer ${tokenB}`
  });

  // ======================================
  // AUTENTICACION
  // ======================================

  it('rechaza solicitudes sin JWT', async () => {
    const res = await request(app)
      .get('/api/emotions');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  // ======================================
  // POST - REGISTRAR EMOCIONES
  // ======================================

  it('registra una emocion manual en Supabase', async () => {
    const res = await request(app)
      .post('/api/emotions')
      .set(authA())
      .send({
        emotion: 'SAD',
        source: 'MANUAL'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.emotion).toBe('SAD');
    expect(res.body.data.confidence).toBeNull();

    userA = res.body.data.userId;
    registrosA.push(res.body.data);
  });

  it('registra una emocion detectada por camara', async () => {
    const res = await request(app)
      .post('/api/emotions')
      .set(authA())
      .send({
        emotion: 'ANGRY',
        source: 'CAMERA',
        confidence: 0.91
      });

    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe('CAMERA');
    expect(res.body.data.confidence).toBeCloseTo(0.91);

    registrosA.push(res.body.data);
  });

  it('registra una de las nuevas emociones', async () => {
    const res = await request(app)
      .post('/api/emotions')
      .set(authA())
      .send({
        emotion: 'BOREDOM',
        source: 'MANUAL'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.emotion).toBe('BOREDOM');

    registrosA.push(res.body.data);
  });

  it('rechaza emociones invalidas', async () => {
    const res = await request(app)
      .post('/api/emotions')
      .set(authA())
      .send({
        emotion: 'HUNGRY',
        source: 'MANUAL'
      });

    expect(res.status).toBe(400);
  });

  it('rechaza CAMERA sin confidence', async () => {
    const res = await request(app)
      .post('/api/emotions')
      .set(authA())
      .send({
        emotion: 'SAD',
        source: 'CAMERA'
      });

    expect(res.status).toBe(400);
  });

  it('rechaza confidence fuera del rango', async () => {
    const res = await request(app)
      .post('/api/emotions')
      .set(authA())
      .send({
        emotion: 'SAD',
        source: 'CAMERA',
        confidence: 1.5
      });

    expect(res.status).toBe(400);
  });

  it('rechaza un userId enviado por el cliente', async () => {
    const res = await request(app)
      .post('/api/emotions')
      .set(authA())
      .send({
        emotion: 'SAD',
        source: 'MANUAL',
        userId: randomUUID()
      });

    expect(res.status).toBe(400);
  });

  // ======================================
  // GET - CONSULTAR POR ID
  // ======================================

  it('consulta una emocion existente por ID', async () => {
    const id = registrosA[0].id;

    const res = await request(app)
      .get(`/api/emotions/${id}`)
      .set(authA());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.userId).toBe(userA);
  });

  it('devuelve 404 para una emocion inexistente', async () => {
    const res = await request(app)
      .get(`/api/emotions/${randomUUID()}`)
      .set(authA());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EMOTION_NOT_FOUND');
  });

  it('rechaza identificadores invalidos', async () => {
    const res = await request(app)
      .get('/api/emotions/123')
      .set(authA());

    expect(res.status).toBe(400);
  });

  // ======================================
  // GET - HISTORIAL Y PAGINACION
  // ======================================

  it('consulta el historial del usuario', async () => {
    const res = await request(app)
      .get('/api/emotions?limit=100')
      .set(authA());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const ids = res.body.data.map(r => r.id);

    for (const registro of registrosA) {
      expect(ids).toContain(registro.id);
    }

    expect(res.body.data.every(
      r => r.userId === userA
    )).toBe(true);
  });

  it('pagina los resultados correctamente', async () => {
    const primera = await request(app)
      .get('/api/emotions?page=1&limit=1')
      .set(authA());

    const segunda = await request(app)
      .get('/api/emotions?page=2&limit=1')
      .set(authA());

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);

    expect(primera.body.data).toHaveLength(1);
    expect(segunda.body.data).toHaveLength(1);

    expect(primera.body.pagination.page).toBe(1);
    expect(primera.body.pagination.limit).toBe(1);
    expect(primera.body.pagination.hasNextPage).toBe(true);

    expect(primera.body.data[0].id)
      .not.toBe(segunda.body.data[0].id);
  });

  it('aplica filtros de fecha', async () => {
    const fechas = registrosA.map(r =>
      new Date(r.createdAt).getTime()
    );

    const from = new Date(
      Math.min(...fechas) - 60000
    ).toISOString();

    const to = new Date(
      Math.max(...fechas) + 60000
    ).toISOString();

    const res = await request(app)
      .get('/api/emotions')
      .query({ from, to, limit: 100 })
      .set(authA());

    expect(res.status).toBe(200);

    const ids = res.body.data.map(r => r.id);

    for (const registro of registrosA) {
      expect(ids).toContain(registro.id);
    }
  });

  it('devuelve historial vacio sin coincidencias', async () => {
    const res = await request(app)
      .get('/api/emotions')
      .query({
        from: '2099-01-01T00:00:00.000Z',
        to: '2099-01-02T00:00:00.000Z'
      })
      .set(authA());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('rechaza limit mayor a 100', async () => {
    const res = await request(app)
      .get('/api/emotions?limit=101')
      .set(authA());

    expect(res.status).toBe(400);
  });

  it('rechaza fechas invalidas', async () => {
    const res = await request(app)
      .get('/api/emotions?from=fecha-invalida')
      .set(authA());

    expect(res.status).toBe(400);
  });

  it('rechaza fechas invertidas', async () => {
    const res = await request(app)
      .get('/api/emotions')
      .query({
        from: '2026-11-10T00:00:00.000Z',
        to: '2026-11-01T00:00:00.000Z'
      })
      .set(authA());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
  });

  // ======================================
  // AISLAMIENTO ENTRE DOS USUARIOS REALES
  // ======================================

  it.skipIf(!tokenB)(
    'impide consultar emociones de otro usuario',
    async () => {
      const creada = await request(app)
        .post('/api/emotions')
        .set(authB())
        .send({
          emotion: 'FEARFUL',
          source: 'MANUAL'
        });

      expect(creada.status).toBe(201);

      userB = creada.body.data.userId;
      registrosB.push(creada.body.data);

      // Deben ser cuentas diferentes
      expect(userB).not.toBe(userA);

      // Usuario B intenta leer emocion de A
      const accesoB = await request(app)
        .get(`/api/emotions/${registrosA[0].id}`)
        .set(authB());

      expect(accesoB.status).toBe(404);

      // Usuario A intenta leer emocion de B
      const accesoA = await request(app)
        .get(`/api/emotions/${registrosB[0].id}`)
        .set(authA());

      expect(accesoA.status).toBe(404);

      // El historial de B no incluye emociones de A
      const historialB = await request(app)
        .get('/api/emotions?limit=100')
        .set(authB());

      expect(historialB.status).toBe(200);

      const idsB = historialB.body.data.map(r => r.id);

      expect(idsB).not.toContain(registrosA[0].id);
      expect(idsB).toContain(registrosB[0].id);
    }
  );

});
