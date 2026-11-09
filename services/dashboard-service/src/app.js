import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { requireAuth } from '@butaca/auth';

const app = express();

app.disable('x-powered-by');

// Las peticiones llegan por el API Gateway, que envía la IP real del usuario
// en X-Forwarded-For. Confiar en un salto permite aplicar el rate limit por usuario.
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());

// Direcciones base de los microservicios aguas abajo
const EMOTION_SERVICE_URL = process.env.EMOTION_SERVICE_URL || 'http://localhost:3002';
const MOVIE_SERVICE_URL = process.env.MOVIE_SERVICE_URL || 'http://localhost:3003';
const FAVORITES_SERVICE_URL = process.env.FAVORITES_SERVICE_URL || 'http://localhost:3004';
const MEME_SERVICE_URL = process.env.MEME_SERVICE_URL || 'http://localhost:3006';

// Validacion de filtros temporales opcionales
const schemaFiltrosDashboard = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

// Funcion auxiliar de consulta HTTP con limite de tiempo estricto.
// Devuelve los registros de la pagina y el total real que informa el servicio.
async function consultarServicio(url, tokenAutorizacion, tiempoLimiteMs = 5000) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), tiempoLimiteMs);

  try {
    const respuesta = await fetch(url, {
      headers: {
        'Authorization': tokenAutorizacion,
        'Content-Type': 'application/json'
      },
      signal: controlador.signal
    });

    if (!respuesta.ok) {
      throw new Error(`Fallo HTTP ${respuesta.status} al consultar ${url}`);
    }

    const cuerpoJson = await respuesta.json();
    const data = Array.isArray(cuerpoJson.data) ? cuerpoJson.data : [];
    return { data, total: cuerpoJson.pagination?.total ?? data.length };
  } finally {
    clearTimeout(temporizador);
  }
}

// 1. Endpoint publico de salud
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'dashboard-service',
    timestamp: new Date().toISOString()
  });
});

// Enrutador protegido del panel
const routerDashboard = express.Router();
routerDashboard.use(requireAuth);

// 2. Resumen consolidado del usuario
routerDashboard.get('/summary', async (req, res, next) => {
  try {
    const validacion = schemaFiltrosDashboard.safeParse(req.query);
    if (!validacion.success) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Parametros de fecha invalidos (deben ser formato ISO 8601)',
        details: validacion.error.issues
      });
    }

    const { from, to } = validacion.data;
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    // Cada listado trae hasta 100 registros; los totales salen de pagination.total.
    params.append('limit', '100');
    const queryString = `?${params.toString()}`;

    const tokenAutorizacion = req.headers.authorization;

    // Consultas en paralelo con tolerancia a fallos. Las rutas siguen el contrato:
    // Emotion conserva /api/emotions; Movie, Favorites y Meme declaran sus rutas sin prefijo.
    const [resEmociones, resPeliculas, resFavoritos, resMemes] = await Promise.allSettled([
      consultarServicio(`${EMOTION_SERVICE_URL}/api/emotions${queryString}`, tokenAutorizacion),
      consultarServicio(`${MOVIE_SERVICE_URL}/recommendations${queryString}`, tokenAutorizacion),
      consultarServicio(`${FAVORITES_SERVICE_URL}/?limit=100`, tokenAutorizacion),
      consultarServicio(`${MEME_SERVICE_URL}/history${queryString}`, tokenAutorizacion)
    ]);

    const serviciosNoDisponibles = [];

    const emociones = resEmociones.status === 'fulfilled'
      ? resEmociones.value
      : (serviciosNoDisponibles.push('emotion-service'), { data: [], total: 0 });

    const recomendaciones = resPeliculas.status === 'fulfilled'
      ? resPeliculas.value
      : (serviciosNoDisponibles.push('movie-service'), { data: [], total: 0 });

    const favoritos = resFavoritos.status === 'fulfilled'
      ? resFavoritos.value
      : (serviciosNoDisponibles.push('favorites-service'), { data: [], total: 0 });

    const historialMemes = resMemes.status === 'fulfilled'
      ? resMemes.value
      : (serviciosNoDisponibles.push('meme-service'), { data: [], total: 0 });

    // Conteo y agregacion de datos
    const frecuenciaEmociones = {};
    for (const item of emociones.data) {
      const emocion = item.emotion || 'NEUTRAL';
      frecuenciaEmociones[emocion] = (frecuenciaEmociones[emocion] || 0) + 1;
    }

    const evolucionAnimo = emociones.data.map((item) => ({
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
          totalEmociones: emociones.total,
          totalRecomendaciones: recomendaciones.total,
          totalFavoritos: favoritos.total,
          totalMemes: historialMemes.total
        },
        frecuenciaEmociones,
        evolucionAnimo,
        ultimasRecomendaciones: recomendaciones.data.slice(0, 5),
        ultimosMemes: historialMemes.data.slice(0, 5),
        advertencias: serviciosNoDisponibles.length > 0
          ? { serviciosNoDisponibles }
          : null
      }
    });
  } catch (error) {
    next(error);
  }
});

// Compatibilidad de rutas directa y via API Gateway
app.use('/api/dashboard', routerDashboard);
app.use('/', routerDashboard);

// Manejador 404 estandarizado
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Ruta ${req.originalUrl} no encontrada`
  });
});

// Manejador global de errores
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