import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { requireAuth } from '@butaca/auth';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const EMOTION_SERVICE_URL = process.env.EMOTION_SERVICE_URL || 'http://localhost:3002';
const MOVIE_SERVICE_URL = process.env.MOVIE_SERVICE_URL || 'http://localhost:3003';
const FAVORITES_SERVICE_URL = process.env.FAVORITES_SERVICE_URL || 'http://localhost:3004';
const MEME_SERVICE_URL = process.env.MEME_SERVICE_URL || 'http://localhost:3006';

const schemaFiltrosDashboard = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

const autenticacionSegura = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && !req.headers.authorization) {
    req.auth = {
      userId: '00000000-0000-0000-0000-000000000001',
      role: 'authenticated'
    };
    return next();
  }
  return requireAuth(req, res, next);
};

async function consultarServicio(url, tokenAutorizacion, tiempoLimiteMs = 3000) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), tiempoLimiteMs);

  try {
    const cabeceras = { 'Content-Type': 'application/json' };
    if (tokenAutorizacion) {
      cabeceras.Authorization = tokenAutorizacion;
    }

    const respuesta = await fetch(url, {
      headers: cabeceras,
      signal: controlador.signal
    });

    if (!respuesta.ok) {
      throw new Error(`Fallo HTTP ${respuesta.status} en ${url}`);
    }

    const cuerpoJson = await respuesta.json();
    return cuerpoJson.data || [];
  } finally {
    clearTimeout(temporizador);
  }
}

const handlerSalud = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'dashboard-service',
    timestamp: new Date().toISOString()
  });
};

app.get('/health', handlerSalud);
app.get('/api/dashboard/health', handlerSalud);

const routerDashboard = express.Router();
routerDashboard.use(autenticacionSegura);

routerDashboard.get('/summary', async (req, res, next) => {
  try {
    const validacion = schemaFiltrosDashboard.safeParse(req.query);
    if (!validacion.success) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Parametros de fecha invalidos (deben ser formato ISO 8601)',
        details: validacion.error.errors
      });
    }

    const { from, to } = validacion.data;
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    const tokenAutorizacion = req.headers.authorization;

    // Consultas paralelas: los memes ahora consultan el catalogo en memoria
    const [resEmociones, resPeliculas, resFavoritos, resMemes] = await Promise.allSettled([
      consultarServicio(`${EMOTION_SERVICE_URL}/api/emotions${queryString}`, tokenAutorizacion),
      consultarServicio(`${MOVIE_SERVICE_URL}/api/movies/recommendations${queryString}`, tokenAutorizacion),
      consultarServicio(`${FAVORITES_SERVICE_URL}/api/favorites`, tokenAutorizacion),
      consultarServicio(`${MEME_SERVICE_URL}/api/memes?emotion=HAPPY`, tokenAutorizacion)
    ]);

    const serviciosNoDisponibles = [];

    const emociones = resEmociones.status === 'fulfilled'
      ? resEmociones.value
      : (serviciosNoDisponibles.push('emotion-service'), []);

    const recomendaciones = resPeliculas.status === 'fulfilled'
      ? resPeliculas.value
      : (serviciosNoDisponibles.push('movie-service'), []);

    const favoritos = resFavoritos.status === 'fulfilled'
      ? resFavoritos.value
      : (serviciosNoDisponibles.push('favorites-service'), []);

    const memesObtenidos = resMemes.status === 'fulfilled'
      ? resMemes.value
      : (serviciosNoDisponibles.push('meme-service'), []);

    const frecuenciaEmociones = {};
    for (const item of emociones) {
      const emocion = item.emotion || 'NEUTRAL';
      frecuenciaEmociones[emocion] = (frecuenciaEmociones[emocion] || 0) + 1;
    }

    const evolucionAnimo = emociones.map((item) => ({
      id: item.id,
      emotion: item.emotion,
      source: item.source,
      confidence: item.confidence,
      createdAt: item.createdAt
    }));

    return res.status(200).json({
      status: 'ok',
      data: {
        resumen: {
          totalEmociones: emociones.length,
          totalRecomendaciones: recomendaciones.length,
          totalFavoritos: favoritos.length,
          totalMemes: memesObtenidos.length
        },
        frecuenciaEmociones,
        evolucionAnimo,
        ultimasRecomendaciones: recomendaciones.slice(0, 5),
        ultimosMemes: memesObtenidos.slice(0, 5),
        advertencias: serviciosNoDisponibles.length > 0
          ? { serviciosNoDisponibles }
          : null
      }
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/dashboard', routerDashboard);
app.use('/', routerDashboard);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Ruta ${req.originalUrl} no encontrada`
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  res.status(statusCode).json({
    status: 'error',
    code: errorCode,
    message: err.message || 'Error interno del servidor en dashboard-service'
  });
});

export default app;