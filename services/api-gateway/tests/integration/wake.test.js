import http from 'node:http';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const JWT_SECRET = 'clave-de-prueba-con-mas-de-32-caracteres';
const ISSUER = 'http://supabase.test/auth/v1';
const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';

let app;
let token;
let healthyServer;

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function signToken(role) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setSubject(USER_ID)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

beforeAll(async () => {
  healthyServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'fake', timestamp: new Date().toISOString() }));
  });

  const healthyUrl = `http://127.0.0.1:${await listen(healthyServer)}`;

  delete process.env.SUPABASE_URL;
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.SUPABASE_JWT_ISSUER = ISSUER;
  process.env.USER_SERVICE_URL = healthyUrl;
  process.env.EMOTION_SERVICE_URL = healthyUrl;
  process.env.MOVIE_SERVICE_URL = healthyUrl;
  process.env.FAVORITES_SERVICE_URL = healthyUrl;
  process.env.DASHBOARD_SERVICE_URL = healthyUrl;
  process.env.MEME_SERVICE_URL = healthyUrl;

  vi.resetModules();
  ({ default: app } = await import('../../src/app.js'));
  token = await signToken('authenticated');
});

afterAll(() => {
  healthyServer.close();
});

async function pollUntilAllOnline(maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await request(app)
      .get('/api/wake')
      .set('Authorization', `Bearer ${token}`);

    if (response.body.data.onlineCount === response.body.data.total) {
      return response.body.data;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('Los servicios nunca llegaron a onlineCount === total');
}

describe('auto-wake del api-gateway', () => {
  it('exige autenticación, igual que el resto de /api', async () => {
    const response = await request(app).post('/api/wake');

    expect(response.status).toBe(401);
  });

  it('GET /api/wake también exige autenticación', async () => {
    const response = await request(app).get('/api/wake');

    expect(response.status).toBe(401);
  });

  it('POST inicia un ciclo y responde con el estado de los seis servicios', async () => {
    const response = await request(app)
      .post('/api/wake')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.data.total).toBe(6);
    expect(Object.keys(response.body.data.services)).toEqual(
      expect.arrayContaining(['users', 'emotions', 'movies', 'favorites', 'dashboard', 'memes'])
    );
  });

  it('GET refleja que los seis servicios terminan online', async () => {
    await request(app).post('/api/wake').set('Authorization', `Bearer ${token}`);

    const data = await pollUntilAllOnline();

    expect(data.onlineCount).toBe(6);
    expect(data.waking).toBe(false);

    for (const name of ['users', 'emotions', 'movies', 'favorites', 'dashboard', 'memes']) {
      expect(data.services[name].status).toBe('online');
    }
  });

  it('no abre un segundo ciclo si ya hay uno en curso', async () => {
    const [first, second] = await Promise.all([
      request(app).post('/api/wake').set('Authorization', `Bearer ${token}`),
      request(app).post('/api/wake').set('Authorization', `Bearer ${token}`)
    ]);

    expect(first.body.data.startedAt).toBe(second.body.data.startedAt);
  });
});
