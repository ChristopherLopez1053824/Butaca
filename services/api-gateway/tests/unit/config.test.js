import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('usa los valores por defecto', () => {
    const config = loadConfig({});

    expect(config.PORT).toBe(3000);
    expect(config.PROXY_TIMEOUT_MS).toBe(15000);
    expect(config.USER_SERVICE_URL).toBe('http://localhost:3001');
  });

  it('usa el valor por defecto si una variable está vacía', () => {
    expect(loadConfig({ PROXY_TIMEOUT_MS: '' }).PROXY_TIMEOUT_MS).toBe(15000);
  });

  it('convierte los números que llegan como texto', () => {
    expect(loadConfig({ PROXY_TIMEOUT_MS: '5000' }).PROXY_TIMEOUT_MS).toBe(5000);
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'rechaza PROXY_TIMEOUT_MS con el valor %s',
    (value) => {
      expect(() => loadConfig({ PROXY_TIMEOUT_MS: value }))
        .toThrow('PROXY_TIMEOUT_MS');
    }
  );

  it('rechaza un puerto fuera de rango', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow('PORT');
  });

  it('rechaza una URL de servicio inválida', () => {
    expect(() => loadConfig({ MOVIE_SERVICE_URL: 'movie-service:3003' }))
      .toThrow('MOVIE_SERVICE_URL');
  });

  it('no confía en proxies por defecto', () => {
    expect(loadConfig({}).TRUST_PROXY).toBe(0);
    expect(loadConfig({ TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
  });

  it.each(['-1', 'abc', '1.5'])('rechaza TRUST_PROXY con el valor %s', (value) => {
    expect(() => loadConfig({ TRUST_PROXY: value })).toThrow('TRUST_PROXY');
  });

  it('registra peticiones fuera de las pruebas, salvo que se desactive', () => {
    expect(loadConfig({ NODE_ENV: 'development' }).LOG_REQUESTS).toBe(true);
    expect(loadConfig({ NODE_ENV: 'test' }).LOG_REQUESTS).toBe(false);
    expect(loadConfig({ NODE_ENV: 'development', LOG_REQUESTS: 'false' }).LOG_REQUESTS).toBe(false);
  });
});
