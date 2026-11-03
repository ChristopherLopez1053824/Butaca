# Recomendaciones

## Endpoints

### `POST /recommendations`

Requiere `Authorization: Bearer <jwt>`.

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

Cada lote intenta seleccionar 10 películas y 10 series. `hasMore` indica si quedan páginas de exploración; cuando ambas fuentes se agotan, `nextCursor` es `null`.

### `GET /recommendations?emotionRecordId=<uuid>`

Requiere `Authorization: Bearer <jwt>`. Devuelve las recomendaciones ya persistidas del usuario y del registro emocional, sin consultar TMDB.

```json
{
  "status": "ok",
  "data": []
}
```

## Fuente de la emoción

La emoción se obtiene exclusivamente del Emotion Service. El contrato esperado por `movie-service` es:

```http
GET {EMOTION_SERVICE_URL}/emotion-records/{emotionRecordId}
Authorization: Bearer <jwt>
```

Respuesta esperada:

```json
{
  "status": "ok",
  "data": {
    "id": "uuid",
    "emotion": "HAPPY"
  }
}
```

También se acepta el registro directo sin envoltorio `data`. El servicio debe responder `403` si el registro pertenece a otro usuario y `404` con `code: "NOT_FOUND"` si no existe. Actualmente el Emotion Service solo implementa `/health`; por tanto la integración real de este contrato queda pendiente.

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

También se aceptan alias en español de la matriz aprobada: tristeza, enojo, miedo, asco, sorpresa negativa, desprecio, frustración, confusión, vergüenza y aburrimiento. `TIRED` y `NEUTRAL` se asocian a Calma porque el enum de Prisma no contiene equivalentes directos en la matriz original.

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

Se excluye Drama (`18`) en ambos tipos. En películas también se excluye Horror (`27`). La TV no usa `27` como género; `10766` corresponde a Soap y no se usa como Romance.

## Temáticas

Las temáticas aprobadas se resuelven contra `/search/keyword` de TMDB. Solo se acepta una coincidencia exacta, normalizando mayúsculas y acentos. Si no se resuelve ninguna keyword, la generación falla con `UPSTREAM_ERROR`; no se relajan filtros ni se inventan términos.

## Puntuación

Cada candidato se puntúa sobre 100 antes de ordenar dentro de su lote de películas o series:

- Géneros: 40 puntos. Si el candidato tiene el género prioritario en la posición `i` de la lista del objetivo, recibe `40 * (n - i) / n`, donde `n` es el número de géneros del objetivo. Si no coincide ninguno, recibe 0.
- Temática: 40 puntos.
  - 20 puntos si el candidato proviene de la consulta con keywords reales.
  - 20 puntos según el texto de título y descripción: `positivos / (positivos + negativos) * 20`.
  - Se consideran términos positivos las temáticas del objetivo y una lista de términos negativos (muerte, violencia, abuso, tragedia, etc.).
- Calidad: 20 puntos.
  - Hasta 10 puntos por `vote_average / 10`.
  - Hasta 10 puntos por confianza de votos: `min(1, log10(vote_count + 1) / 4) * 10`.

Antes de puntuar se descartan candidatos con géneros excluidos y aquellos con al menos dos coincidencias negativas y más negativas que positivas.

## Cursor

El cursor es opaco, firmado con HMAC-SHA256 y versionado. Contiene:

- `userId` y `emotionRecordId` para evitar reutilización cruzada.
- `moviePage` y `tvPage` siguientes.
- `movieExhausted` y `tvExhausted`.
- Claves `MEDIA_TYPE:tmdbId` ya entregadas.

La firma usa `RECOMMENDATIONS_CURSOR_SECRET` y, si no está definida, `SUPABASE_JWT_SECRET`. Un cursor manipulado responde `400 VALIDATION_ERROR`; un cursor de otro usuario o registro responde `403 FORBIDDEN`.

## Persistencia e idempotencia

La lectura y escritura usan `withUserContext()` para aplicar RLS con el `userId` autenticado. Las recomendaciones se guardan en `Recommendation` sin modificar el esquema.

Para reducir duplicados concurrentes se toma un advisory lock por usuario y registro emocional dentro de la transacción, y se filtran las claves ya existentes antes de `createMany`. El esquema actual no tiene una restricción única `(userId, emotionRecordId, tmdbId, mediaType)`, por lo que la idempotencia completa ante fallos extremos no puede garantizarse solo con la base de datos. La solución recomendada, para una fase que sí pueda modificar el esquema, es añadir esa restricción única y usar una escritura idempotente.
