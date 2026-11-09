import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('favorites-service', () => {
  it('debe responder correctamente al endpoint de salud', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('favorites-service');
    expect(response.body.timestamp).toBeDefined();
  });
});
