import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWakeController } from '../../src/wake.js';

const SERVICES = [
  ['users', 'http://users.test'],
  ['emotions', 'http://emotions.test'],
  ['movies', 'http://movies.test'],
  ['favorites', 'http://favorites.test'],
  ['dashboard', 'http://dashboard.test'],
  ['memes', 'http://memes.test']
];

const FAST_OPTIONS = {
  pingTimeoutMs: 50,
  retryIntervalMs: 5,
  maxWakeDurationMs: 40
};

function okResponse() {
  return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
}

function waitUntilIdle(wake) {
  return new Promise((resolve) => {
    const check = () => {
      if (!wake.getSnapshot().waking) {
        resolve();
        return;
      }

      setTimeout(check, 5);
    };

    check();
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createWakeController', () => {
  it('empieza con los seis servicios en offline y sin ciclo en curso', () => {
    const wake = createWakeController(SERVICES, FAST_OPTIONS);
    const snapshot = wake.getSnapshot();

    expect(snapshot.waking).toBe(false);
    expect(snapshot.total).toBe(6);
    expect(snapshot.onlineCount).toBe(0);
    expect(Object.keys(snapshot.services)).toHaveLength(6);
    expect(snapshot.services.users).toEqual({ status: 'offline', lastCheckedAt: null });
  });

  it('marca los seis como online cuando todos responden /health correctamente', async () => {
    globalThis.fetch = vi.fn(async () => okResponse());

    const wake = createWakeController(SERVICES, FAST_OPTIONS);
    const started = wake.startCycle();

    expect(started.waking).toBe(true);

    await waitUntilIdle(wake);

    const snapshot = wake.getSnapshot();
    expect(snapshot.onlineCount).toBe(6);

    for (const [name] of SERVICES) {
      expect(snapshot.services[name].status).toBe('online');
      expect(snapshot.services[name].lastCheckedAt).not.toBeNull();
    }
  });

  it('distingue timeout de error y deja online a los que sí responden', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (url.includes('movies')) {
        throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
      }

      if (url.includes('favorites')) {
        return new Response('fail', { status: 500 });
      }

      return okResponse();
    });

    const wake = createWakeController(SERVICES, FAST_OPTIONS);
    wake.startCycle();

    await waitUntilIdle(wake);

    const snapshot = wake.getSnapshot();
    expect(snapshot.services.movies.status).toBe('timeout');
    expect(snapshot.services.favorites.status).toBe('error');
    expect(snapshot.services.users.status).toBe('online');
    expect(snapshot.onlineCount).toBe(4);
  });

  it('reintenta y termina online si un servicio se despierta en el segundo intento', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? new Response('aun no', { status: 502 }) : okResponse();
    });

    const wake = createWakeController(SERVICES, FAST_OPTIONS);
    wake.startCycle();

    await waitUntilIdle(wake);

    const snapshot = wake.getSnapshot();
    expect(snapshot.onlineCount).toBe(6);
    expect(calls).toBeGreaterThan(SERVICES.length);
  });

  it('no inicia un segundo ciclo mientras el primero sigue activo', async () => {
    let fetchCalls = 0;
    globalThis.fetch = vi.fn(async () => {
      fetchCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return okResponse();
    });

    const wake = createWakeController(SERVICES, FAST_OPTIONS);
    const first = wake.startCycle();
    const second = wake.startCycle();

    expect(second.startedAt).toBe(first.startedAt);

    await waitUntilIdle(wake);

    // Si hubiera arrancado un segundo ciclo en paralelo, cada servicio
    // habría recibido el doble de solicitudes en esta primera ronda.
    expect(fetchCalls).toBe(SERVICES.length);
  });

  it('no asume que un servicio está listo solo por responder algo inválido', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'degraded' }), { status: 200 }));

    const wake = createWakeController(SERVICES, FAST_OPTIONS);
    wake.startCycle();

    await waitUntilIdle(wake);

    const snapshot = wake.getSnapshot();
    expect(snapshot.onlineCount).toBe(0);
    expect(snapshot.services.users.status).toBe('error');
  });
});
