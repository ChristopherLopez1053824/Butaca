// Auto-Wake: el Gateway pide a los seis microservicios que respondan a su
// propio /health para que Render los reactive si estaban suspendidos por
// inactividad (plan free). No asume que un servicio está listo solo porque
// respondió algo: solo lo marca "online" si su /health responde 200 con
// { status: 'ok' }, igual que exige el contrato (docs/api-contracts.md).

const PING_TIMEOUT_MS = 8000;
const RETRY_INTERVAL_MS = 4000;

// Render documenta que un servicio gratuito dormido puede tardar ~1 minuto
// en volver a arrancar (ver nota de límites en render.yaml). Dejamos el
// ciclo de espera por debajo de PROXY_TIMEOUT_MS (90s) para que siempre
// termine y libere el candado antes de que otra petición dispare uno nuevo.
const MAX_WAKE_DURATION_MS = 80000;

function isTimeoutError(error) {
  return error?.name === 'TimeoutError';
}

async function pingOnce(url, pingTimeoutMs) {
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/health`, {
      signal: AbortSignal.timeout(pingTimeoutMs)
    });

    if (!response.ok) {
      return 'error';
    }

    const body = await response.json().catch(() => null);

    return body?.status === 'ok' ? 'online' : 'error';
  } catch (error) {
    return isTimeoutError(error) ? 'timeout' : 'error';
  }
}

// services: mismos pares [nombre, url] que usa el proxy del Gateway
// (ver la lista `services` en app.js), para no duplicar ni inventar URLs.
// Las pruebas pueden pasar timeouts/intervalos más cortos en `options`.
export function createWakeController(services, options = {}) {
  const pingTimeoutMs = options.pingTimeoutMs ?? PING_TIMEOUT_MS;
  const retryIntervalMs = options.retryIntervalMs ?? RETRY_INTERVAL_MS;
  const maxWakeDurationMs = options.maxWakeDurationMs ?? MAX_WAKE_DURATION_MS;

  const names = services.map(([name]) => name);
  const state = new Map(
    names.map((name) => [name, { status: 'offline', lastCheckedAt: null }])
  );

  let waking = false;
  let startedAt = null;

  function setStatus(name, status) {
    state.set(name, { status, lastCheckedAt: new Date().toISOString() });
  }

  async function wakeOne(name, url) {
    const deadline = Date.now() + maxWakeDurationMs;

    for (;;) {
      setStatus(name, 'waking');

      const result = await pingOnce(url, pingTimeoutMs);

      if (result === 'online') {
        setStatus(name, 'online');
        return;
      }

      setStatus(name, result);

      if (Date.now() >= deadline) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }

  function getSnapshot() {
    const onlineCount = [...state.values()]
      .filter((entry) => entry.status === 'online').length;

    return {
      waking,
      startedAt,
      onlineCount,
      total: names.length,
      services: Object.fromEntries(state)
    };
  }

  // No inicia un segundo ciclo si ya hay uno en curso: varios usuarios
  // entrando a la vez comparten el mismo ciclo en lugar de multiplicar las
  // solicitudes de activación hacia los seis microservicios.
  function startCycle() {
    if (waking) {
      return getSnapshot();
    }

    waking = true;
    startedAt = new Date().toISOString();

    Promise.all(services.map(([name, url]) => wakeOne(name, url)))
      .finally(() => {
        waking = false;
      });

    return getSnapshot();
  }

  return { startCycle, getSnapshot };
}
