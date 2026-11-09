# Movie Service

Servicio de películas y series de Butaca. Es responsable de:

- Consultar metadatos de películas y series en TMDB.
- Generar recomendaciones a partir de la emoción registrada por el usuario.
- Persistir y consultar el historial de recomendaciones en su propia tabla `recommendations`.
- Consumir Emotion Service mediante HTTP para obtener emociones e historial.
- Aplicar autenticación JWT, aislamiento por usuario y RLS mediante `withUserContext`.

Movie Service no es propietario de `emotion_records` y no consulta esa tabla directa ni
indirectamente. Toda la información emocional se obtiene de la API de Emotion Service.

## Arquitectura y dependencias

- Node.js, Express 5 y Zod.
- `@butaca/auth` para validar JWT.
- `@butaca/database` para Prisma y `withUserContext`.
- `@butaca/shared` para constantes compartidas.
- TMDB como fuente de metadatos.
- Emotion Service como fuente de emociones.

Flujo de `POST /recommendations`:

1. Se valida el JWT del usuario.
2. Se consulta la emoción mediante `GET /api/emotions/:id`.
3. Se resuelven las temáticas aprobadas contra TMDB.
4. Se consultan películas y series mediante Discover.
5. Se aplican filtros, exclusiones y scoring 40/40/20.
6. Se persisten las recomendaciones en `recommendations`.
7. Se devuelve el lote junto con el cursor firmado para continuar.

## Endpoints

Todos los endpoints de negocio requieren `Authorization: Bearer <jwt>`.

### `GET /details/:tmdbId`

Parámetros:

- `tmdbId`: entero positivo.
- `mediaType`: `MOVIE` o `TV`.

Devuelve los metadatos normalizados de TMDB.

### `POST /recommendations`

Body:

```json
{
  "emotionRecordId": "uuid",
  "cursor": "cursor-opcional"
}
```

Genera hasta 10 películas y 10 series por lote. Si no hay suficientes candidatos válidos,
devuelve únicamente los disponibles. Persiste las recomendaciones y devuelve un cursor
firmado para continuar.

### `GET /recommendations`

Parámetros query:

- `emotionRecordId`: UUID opcional.
- `from`: fecha ISO 8601 inclusiva opcional.
- `to`: fecha ISO 8601 inclusiva opcional.
- `page`: entero, mínimo 1, por defecto 1.
- `limit`: entero, mínimo 1, máximo 100, por defecto 10.

Devuelve las recomendaciones ya persistidas del usuario autenticado. No consulta TMDB ni
genera nuevas recomendaciones. Los filtros se aplican antes de paginar y el orden es
`createdAt DESC`.

Respuesta:

```json
{
  "status": "ok",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0
  }
}
```

## Integración con TMDB

`src/clients/tmdb.client.js` centraliza las llamadas a TMDB:

- Timeout de 5 segundos.
- API Key v3 enviada únicamente desde el backend.
- Detalles de películas y series.
- Búsqueda y Discover con géneros, exclusiones y keywords.
- Normalización a camelCase.
- Errores controlados sin exponer la API Key.

La API Key nunca se devuelve en respuestas ni se registra en logs.

## Integración con Emotion Service

Contrato utilizado por Movie Service:

```http
GET {EMOTION_SERVICE_URL}/api/emotions/:id
Authorization: Bearer <jwt>
```

Respuesta exitosa:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "emotion": "happy",
    "intensity": 8,
    "createdAt": "2026-11-03T15:30:00.000Z"
  }
}
```

`intensity` es opcional si el modelo real de Emotion Service no lo proporciona.

Movie Service también implementa el adaptador de historial:

```http
GET {EMOTION_SERVICE_URL}/api/emotions?page=1&limit=10&from=...&to=...
Authorization: Bearer <jwt>
```

El adaptador conserva filtros y metadatos de paginación. No se usa para
`GET /recommendations`, que consulta únicamente recomendaciones persistidas.

Manejo de errores de Emotion Service:

| Respuesta | Movie Service |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 500 | `UPSTREAM_ERROR` |
| 503 | `SERVICE_UNAVAILABLE` |
| Timeout | `GATEWAY_TIMEOUT` |
| Error de red | `SERVICE_UNAVAILABLE` |

Los errores 5xx, timeout y red nunca se convierten en `404`.

## Variables de entorno

Ver `.env.example`. Variables principales:

- `DATABASE_URL`
- `TMDB_API_KEY`
- `TMDB_BASE_URL`
- `EMOTION_SERVICE_URL`
- `EMOTION_SERVICE_TIMEOUT_MS`
- `SUPABASE_URL`
- `SUPABASE_JWT_ISSUER`
- `SUPABASE_JWT_AUDIENCE`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_JWKS_URL`
- `RECOMMENDATIONS_CURSOR_SECRET`

`RECOMMENDATIONS_CURSOR_SECRET` es obligatoria, debe tener al menos 32 caracteres y es
independiente de `SUPABASE_JWT_SECRET`.

## Ejecución

Desde la raíz del monorepo:

```bash
pnpm --filter @butaca/movie-service dev
```

O dentro del servicio:

```bash
pnpm dev
```

El servicio escucha por defecto en el puerto `3003`.

## Pruebas

```bash
pnpm --filter @butaca/movie-service test
pnpm --filter @butaca/movie-service test:unit
pnpm --filter @butaca/movie-service test:integration
```

Las pruebas no dependen de internet ni de TMDB real. Las llamadas a TMDB y Emotion Service
se simulan con mocks.

## Formato de respuestas y errores

Respuesta exitosa:

```json
{
  "status": "ok",
  "data": {}
}
```

Error:

```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Descripción",
  "details": []
}
```

Códigos usados: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `INTERNAL_ERROR`, `UPSTREAM_ERROR`, `SERVICE_UNAVAILABLE` y
`GATEWAY_TIMEOUT`.

## Seguridad y persistencia

- El usuario se obtiene siempre de `req.auth.userId`; no se confía en IDs enviados por el cliente.
- Todas las operaciones sobre `recommendations` usan `withUserContext`.
- No se consultan tablas de otros servicios.
- El cursor está firmado con HMAC-SHA256, vinculado a `userId` y `emotionRecordId`, y
  versionado.
- Las posiciones son consecutivas por `emotionRecordId` y no se reinician en cada lote.
- La generación está protegida contra duplicados y usa un advisory lock por usuario y
  registro emocional.
