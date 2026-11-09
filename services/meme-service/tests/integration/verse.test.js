import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { AppError } from '../../src/errors.js';

const { withUserContext, getVerseForEmotion } = vi.hoisted(() => ({
  withUserContext: vi.fn(),
  getVerseForEmotion: vi.fn()
}));

const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';
const AUTHORIZATION = 'Bearer test-token';

vi.mock('@butaca/auth', () => ({
  requireAuth: (req, res, next) => {
    if (req.headers.authorization !== AUTHORIZATION) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Token de autenticación requerido'
      });
    }

    req.auth = { userId: USER_ID };
    return next();
  }
}));

vi.mock('@butaca/database', () => ({ withUserContext }));
vi.mock('../../src/services/verse.service.js', () => ({ getVerseForEmotion }));

const app = (await import('../../src/app.js')).default;

const verse = {
  provider: 'api.bible',
  translation: 'RVR1960',
  externalId: 'JHN.3.16',
  reference: 'Juan 3:16',
  theme: 'esperanza',
  text: 'Porque de tal manera amó Dios al mundo...',
  copyright: '© Sociedades Bíblicas Unidas'
};

describe('meme-service (contenido bíblico)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /', () => {
    it('requiere autenticación', async () => {
      const response = await request(app).get('/').query({ emotion: 'HAPPY' });

      expect(response.status).toBe(401);
      expect(getVerseForEmotion).not.toHaveBeenCalled();
    });

    it('requiere el parámetro emotion', async () => {
      const response = await request(app)
        .get('/')
        .set('Authorization', AUTHORIZATION);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('devuelve el versículo real para la emoción autenticada', async () => {
      getVerseForEmotion.mockResolvedValue(verse);

      const response = await request(app)
        .get('/')
        .query({ emotion: 'HAPPY' })
        .set('Authorization', AUTHORIZATION);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', data: verse });
      expect(getVerseForEmotion).toHaveBeenCalledWith('HAPPY', {
        requestedTranslation: undefined
      });
    });

    it('rechaza una traducción distinta a la configurada (decidido por el servicio)', async () => {
      getVerseForEmotion.mockRejectedValue(
        new AppError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'La traducción "NVI" no está disponible; este servicio solo tiene configurada "RVR09"'
        })
      );

      const response = await request(app)
        .get('/')
        .query({ emotion: 'HAPPY', translation: 'NVI' })
        .set('Authorization', AUTHORIZATION);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(getVerseForEmotion).toHaveBeenCalledWith('HAPPY', {
        requestedTranslation: 'NVI'
      });
    });

    it('acepta la traducción cuando coincide con la configurada', async () => {
      getVerseForEmotion.mockResolvedValue(verse);

      const response = await request(app)
        .get('/')
        .query({ emotion: 'HAPPY', translation: 'RVR09' })
        .set('Authorization', AUTHORIZATION);

      expect(response.status).toBe(200);
      expect(getVerseForEmotion).toHaveBeenCalledWith('HAPPY', {
        requestedTranslation: 'RVR09'
      });
    });

    it('propaga un error controlado si falta la API Key', async () => {
      getVerseForEmotion.mockRejectedValue(
        new AppError({
          statusCode: 503,
          code: 'SERVICE_NOT_CONFIGURED',
          message: 'Falta BIBLE_API_KEY'
        })
      );

      const response = await request(app)
        .get('/')
        .query({ emotion: 'HAPPY' })
        .set('Authorization', AUTHORIZATION);

      expect(response.status).toBe(503);
      expect(response.body.code).toBe('SERVICE_NOT_CONFIGURED');
    });
  });

  describe('POST /history', () => {
    it('requiere autenticación', async () => {
      const response = await request(app)
        .post('/history')
        .send({ provider: 'RVR1960', externalId: 'JHN.3.16' });

      expect(response.status).toBe(401);
      expect(withUserContext).not.toHaveBeenCalled();
    });

    it('registra el contenido mostrado al usuario autenticado', async () => {
      const created = {
        id: 'history-1',
        userId: USER_ID,
        emotionRecordId: null,
        provider: 'RVR1960',
        externalId: 'JHN.3.16',
        title: 'Juan 3:16 (RVR1960)',
        createdAt: new Date('2026-01-01T00:00:00.000Z')
      };
      const tx = { memeHistory: { create: vi.fn().mockResolvedValue(created) } };
      withUserContext.mockImplementation((userId, callback) => callback(tx));

      const response = await request(app)
        .post('/history')
        .set('Authorization', AUTHORIZATION)
        .send({
          provider: 'RVR1960',
          externalId: 'JHN.3.16',
          title: 'Juan 3:16 (RVR1960)'
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({
        id: 'history-1',
        emotionRecordId: null,
        provider: 'RVR1960',
        externalId: 'JHN.3.16',
        title: 'Juan 3:16 (RVR1960)',
        createdAt: '2026-01-01T00:00:00.000Z'
      });
      expect(withUserContext).toHaveBeenCalledWith(USER_ID, expect.any(Function));
      expect(tx.memeHistory.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          emotionRecordId: null,
          provider: 'RVR1960',
          externalId: 'JHN.3.16',
          title: 'Juan 3:16 (RVR1960)'
        }
      });
    });

    it('no confía en un userId enviado por el cliente (rechaza campos ajenos)', async () => {
      const tx = { memeHistory: { create: vi.fn() } };
      withUserContext.mockImplementation((userId, callback) => callback(tx));

      const response = await request(app)
        .post('/history')
        .set('Authorization', AUTHORIZATION)
        .send({
          provider: 'RVR1960',
          externalId: 'JHN.3.16',
          userId: 'otro-usuario'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(tx.memeHistory.create).not.toHaveBeenCalled();
    });

    it('rechaza payloads inválidos', async () => {
      const response = await request(app)
        .post('/history')
        .set('Authorization', AUTHORIZATION)
        .send({ provider: '' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(withUserContext).not.toHaveBeenCalled();
    });
  });

  describe('GET /history', () => {
    it('requiere autenticación', async () => {
      const response = await request(app).get('/history');

      expect(response.status).toBe(401);
      expect(withUserContext).not.toHaveBeenCalled();
    });

    it('devuelve el historial paginado del usuario autenticado', async () => {
      const entries = [{
        id: 'history-1',
        userId: USER_ID,
        emotionRecordId: null,
        provider: 'RVR1960',
        externalId: 'JHN.3.16',
        title: 'Juan 3:16 (RVR1960)',
        createdAt: new Date('2026-01-01T00:00:00.000Z')
      }];
      const tx = {
        memeHistory: {
          count: vi.fn().mockResolvedValue(1),
          findMany: vi.fn().mockResolvedValue(entries)
        }
      };
      withUserContext.mockImplementation((userId, callback) => callback(tx));

      const response = await request(app)
        .get('/history')
        .set('Authorization', AUTHORIZATION);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 1 });
      expect(response.body.data).toEqual([{
        id: 'history-1',
        emotionRecordId: null,
        provider: 'RVR1960',
        externalId: 'JHN.3.16',
        title: 'Juan 3:16 (RVR1960)',
        createdAt: '2026-01-01T00:00:00.000Z'
      }]);
      expect(tx.memeHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: USER_ID }
      }));
    });
  });

  describe('rutas inexistentes', () => {
    it('devuelve errores JSON para rutas que no existen', async () => {
      const response = await request(app)
        .get('/unknown')
        .set('Authorization', AUTHORIZATION);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });
});
