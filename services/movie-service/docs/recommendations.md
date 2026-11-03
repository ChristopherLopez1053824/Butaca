# Recomendaciones

## Endpoints

Todos los endpoints requieren `Authorization: Bearer <jwt>`.

### `POST /recommendations`

Body:

```json
{
  "emotionRecordId": "uuid",
  "cursor": "cursor-opcional"
}
```

Respuesta `200`:

```json
{
  "status": "ok",
  "data": [
    {
      "id": "uuid",
      "tmdbId": 550,
      "mediaType": "MOVIE",
      "title": "Fight Club",
      "overview": "Texto",
      "posterPath": "/poster.jpg",
      "backdropPath": "/backdrop.jpg",
      "releaseDate": "1999-10-15",
      "voteAverage": 8.4,
      "position": 1,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "returned": 1,
    "movieCount": 1,
    "tvCount": 0,
    "hasMore": true,
    "nextCursor": "cursor-firmado"
  }
}
```

Cada lote intenta seleccionar hasta 10 películas y 10 series. Si no hay suficientes
candidatos válidos, devuelve los disponibles sin relajar filtros. Las posiciones son
consecutivas por `emotionRecordId` y continúan en los siguientes lotes. `hasMore` indica si
quedan páginas de exploración; cuando ambas fuentes se agotan, `nextCursor` es `null`.

### `GET /recommendations`

Parámetros query:

- `emotionRecordId`: UUID opcional.
- `from`: fecha ISO 8601 inclusiva opcional.
- `to`: fecha ISO 8601 inclusiva opcional.
- `page`: entero, mínimo 1, por defecto 1.
- `limit`: entero, mínimo 1, máximo 100, por defecto 10.

Ejemplo:

```http
GET /recommendations?emotionRecordId=uuid&from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.999Z&page=1&limit=10
```

Devuelve las recomendaciones persistidas del usuario autenticado. No consulta TMDB ni
genera nuevas recomendaciones. Los filtros se aplican antes de paginar, el total se calcula
antes de paginar y el orden es `createdAt DESC`. La consulta usa `withUserContext` y filtra
por `userId`; si un `emotionRecordId` no pertenece al usuario, el resultado es `data: []`
sin revelar información de otro usuario.

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

Una página sin resultados responde `200` con `data: []`.

## Fuente de la emoción

La emoción se obtiene exclusivamente del Emotion Service. Movie Service no consulta la
tabla `emotion_records` ni importa modelos o repositorios internos de ese servicio.

Contrato utilizado:

```http
GET {EMOTION_SERVICE_URL}/api/emotions/{emotionRecordId}
Authorization: Bearer <jwt>
```

Respuesta esperada:

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

`intensity` es opcional si el modelo real de Emotion Service no lo proporciona y no se usa
para el scoring.

También existe un adaptador para el historial emocional:

```http
GET {EMOTION_SERVICE_URL}/api/emotions?page=1&limit=10&from=...&to=...
Authorization: Bearer <jwt>
```

Este adaptador conserva los filtros y los metadatos de paginación de Emotion Service. No se
usa en `GET /recommendations`, que consulta únicamente la tabla propia `recommendations`.

### Errores de Emotion Service

| Respuesta | Movie Service |
|---|---|
| 400 | `400 VALIDATION_ERROR` |
| 401 | `401 UNAUTHORIZED` |
| 403 | `403 FORBIDDEN` |
| 404 | `404 NOT_FOUND` |
| 500 | `502 UPSTREAM_ERROR` |
| 503 | `503 SERVICE_UNAVAILABLE` |
| Timeout | `504 GATEWAY_TIMEOUT` |
| Error de red | `503 SERVICE_UNAVAILABLE` |

Los errores 5xx, timeout y red nunca se convierten en `404`. `GET /recommendations` no
consulta Emotion Service, por lo que un fallo de ese servicio no puede ocultarse como
historial vacío o inexistente.

## Matriz emocional

| Emoción recibida | Objetivo |
| --- | --- |
| `HAPPY` | Alegría |
| `SAD` | Alegría |
| `ANGRY` | Calma |
| `FEARFUL` | Seguridad |
| `DISGUSTED` | Aceptación |
| `SURPRISED` | Tranquilidad |
| `TIRED` | Calma |
| `NEUTRAL` | Calma |

También se aceptan alias en español de la matriz aprobada: tristeza, enojo, miedo, asco,
sorpresa negativa, desprecio, frustración, confusión, vergüenza y aburrimiento. `TIRED` y
`NEUTRAL` se asocian a Calma porque el enum de Prisma no contiene equivalentes directos en
la matriz original.

## Géneros TMDB

Los géneros se consultan con OR (`|`) y las exclusiones con `without_genres`.

| Objetivo | Películas | Series |
| --- | --- | --- |
| Alegría | 35, 16, 12, 10751 | 35, 16, 10759, 10751 |
| Calma | 16, 10749, 10751 | 16, 10751 |
| Seguridad | 12, 10751, 14 | 10759, 10751, 10765 |
| Aceptación | 35, 10751, 16 | 35, 10751, 16 |
| Tranquilidad | 10751, 10749, 16 | 10751, 16 |
| Empatía | 35, 10751, 16, 99 | 35, 10751, 16, 99 |
| Motivación | 12, 28, 36, 99 | 10759, 99 |
| Claridad | 99, 9648, 36 | 99, 9648 |
| Confianza personal | 35, 10749, 10751 | 35, 10751 |
| Entusiasmo | 12, 878, 28, 14, 10402 | 10759, 10765 |

Se excluye Drama (`18`) en ambos tipos. En películas también se excluye Horror (`27`). La TV
no usa `27` como género; `10766` corresponde a Soap y no se usa como Romance.

## Temáticas

Las temáticas aprobadas se resuelven contra `/search/keyword` de TMDB. Solo se acepta una
coincidencia exacta, normalizando mayúsculas y acentos. Si no se resuelve ninguna keyword,
la generación falla con `UPSTREAM_ERROR`; no se relajan filtros ni se inventan términos.

## Puntuación

Cada candidato se puntúa sobre 100 antes de ordenar dentro de su lote de películas o series:

- Géneros: 40 puntos. Si el candidato tiene el género prioritario en la posición `i` de la
  lista del objetivo, recibe `40 * (n - i) / n`, donde `n` es el número de géneros del
  objetivo. Si no coincide ninguno, recibe 0.
- Temática: 40 puntos.
  - 20 puntos si el candidato proviene de la consulta con keywords reales.
  - 20 puntos según el texto de título y descripción: `positivos / (positivos + negativos) * 20`.
  - Se consideran términos negativos: muerte, violencia, abuso, tragedia, etc.
- Calidad: 20 puntos.
  - Hasta 10 puntos por `vote_average / 10`.
  - Hasta 10 puntos por confianza de votos: `min(1, log10(vote_count + 1) / 4) * 10`.

Antes de puntuar se descartan candidatos con géneros excluidos y aquellos con al menos dos
coincidencias negativas y más negativas que positivas.

## Duplicados y selección

- Los candidatos se deduplican por `mediaType + tmdbId` dentro de una misma página de TMDB,
  entre páginas y entre lotes.
- También se excluyen las claves ya persistidas para el mismo usuario y registro emocional.
- La selección continúa en páginas siguientes de TMDB hasta completar el lote o agotar las
  páginas disponibles.
- `persistSelection` vuelve a deduplicar antes de escribir y calcula la posición máxima
  existente para continuar la numeración.

## Cursor

El cursor es opaco, firmado con HMAC-SHA256 y versionado. Contiene:

- `userId` y `emotionRecordId` para evitar reutilización cruzada.
- `moviePage` y `tvPage` siguientes.
- `movieExhausted` y `tvExhausted`.
- Claves `MEDIA_TYPE:tmdbId` ya entregadas.

La firma usa exclusivamente `RECOMMENDATIONS_CURSOR_SECRET`, que es obligatoria y debe tener
al menos 32 caracteres. No se usa `SUPABASE_JWT_SECRET` como alternativa.

La lista de claves entregadas se limita a las últimas 1000 para mantener acotado el tamaño
del cursor. La deduplicación definitiva se apoya en las claves ya persistidas en la base de
datos. Un cursor manipulado responde `400 VALIDATION_ERROR`; un cursor de otro usuario o
registro responde `403 FORBIDDEN`.

El cursor se genera antes de persistir. Si la codificación falla, no se guardan
recomendaciones y el cliente recibe el error correspondiente.

## Persistencia e idempotencia

La lectura y escritura usan `withUserContext()` para aplicar RLS con el `userId`
autenticado. Las recomendaciones se guardan en `Recommendation`; no se modifica el esquema.

Para reducir duplicados concurrentes se toma un advisory lock por usuario y registro
emocional dentro de la transacción, se deduplican las claves seleccionadas y se filtran las
claves ya existentes antes de `createMany`.

El esquema actual no tiene una restricción única
`(userId, emotionRecordId, tmdbId, mediaType)`, por lo que la idempotencia completa ante
fallos extremos no puede garantizarse solo con la base de datos. Añadir esa restricción
requiere una modificación de esquema fuera del alcance de Movie Service.
