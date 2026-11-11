# Contrato de API de Butaca

Estado: borrador para aprobación del equipo.

Este contrato define cómo se comunican el frontend, el API Gateway y los microservicios. Si un servicio necesita cambiar algo de este documento, primero se acuerda con el equipo y después se implementa. Las rutas de negocio protegidas ejecutan sus accesos a datos dentro de `withUserContext` para aplicar RLS; ningún servicio acepta un id de usuario enviado en la ruta o en el cuerpo.

| Componente | Estado del contrato |
|---|---|
| API Gateway | Implementado en la rama `ApiGateway` |
| User Service | Implementado en la rama `User-and-Favorite-service` |
| Favorites Service | Implementado en la rama `User-and-Favorite-service`; recuperado el 2026-11-09 tras un merge en `Desarrollo` que lo había revertido a placeholder (restaurado desde el commit `948c303`, anterior a su propio revert `136433c`) |
| Movie Service | Implementado en la rama `MovieService` |
| Emotion Service | Implementado en la rama `feature/emotion-service` |
| Dashboard Service | Implementado en la rama `Desarrollo` |
| Meme Service | Implementado en la rama `Desarrollo` (contenido bíblico vía api.bible, probado con clave real; usa RVR09 temporalmente porque RVR1960/NVI no están licenciadas para esa cuenta) |

## 1. Reglas generales

- El frontend solo llama al API Gateway.
- Las rutas `/api/*` requieren `Authorization: Bearer <token>`.
- El id del usuario se obtiene del JWT; nunca se recibe en la ruta, la consulta o el cuerpo.
- Las propiedades JSON usan `camelCase`.
- Cada respuesta incluye `X-Request-Id`. El frontend puede enviar el suyo; el Gateway lo reenvía al servicio y lo registra en su log.
- Las fechas con hora usan ISO 8601 en UTC: `2026-11-01T20:00:00.000Z`.
- Las fechas sin hora usan `YYYY-MM-DD`.
- Los ids propios de Butaca son UUID. `tmdbId` es un entero positivo.
- `emotion` admite `HAPPY`, `SAD`, `ANGRY`, `TIRED`, `NEUTRAL`, `FEARFUL`, `SURPRISED`, `DISGUSTED`, `NEGATIVE_SURPRISE`, `CONTEMPT`, `FRUSTRATION`, `CONFUSION`, `SHAME` y `BOREDOM`. El frontend utiliza las ocho primeras; las seis restantes se conservan por compatibilidad.
- `source` admite `CAMERA` y `MANUAL`.
- `mediaType` admite `MOVIE` y `TV`.

## 2. Rutas entre el Gateway y los servicios

El Gateway quita el prefijo `/api/<servicio>` antes de reenviar la petición, y cada servicio declara sus rutas sin ese prefijo. Emotion Service es la excepción: conserva `/api/emotions` y el Gateway se lo reenvía completo, salvo `/health`.

| El frontend llama a | El servicio recibe |
|---|---|
| `GET /api/users/me` | `GET /me` |
| `POST /api/emotions` | `POST /api/emotions` |
| `GET /api/emotions/:id` | `GET /api/emotions/:id` |
| `GET /api/emotions/health` | `GET /health` |
| `POST /api/movies/recommendations` | `POST /recommendations` |
| `GET /api/favorites?limit=5` | `GET /?limit=5` |
| `GET /api/dashboard/summary` | `GET /summary` |

## 3. Formato de respuestas

Respuesta exitosa:

```json
{ "status": "ok", "data": {} }
```

Listado paginado:

```json
{
  "status": "ok",
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 0 }
}
```

- `page` empieza en 1.
- `limit` admite hasta 100.
- `GET /health` conserva su formato: `status`, `service` y `timestamp`.
- Emotion Service responde internamente con `{ "success": true, "data": ... }` y `{ "success": false, "error": { "code", "message" } }`. El Gateway lo convierte a este formato antes de enviarlo al frontend. Los servicios que llaman a Emotion directamente reciben su formato interno.
- Un borrado exitoso responde `204` sin cuerpo.

## 4. Formato de errores

```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "Texto legible",
  "details": []
}
```

`details` es opcional. Todos los errores responden en JSON, incluidos los 404 y los errores no controlados.

Al convertir las respuestas de Emotion, el Gateway cambia estos códigos:

| Código de Emotion | Código común |
|---|---|
| `INVALID_PARAMETERS` | `VALIDATION_ERROR` |
| `INVALID_DATE_RANGE` | `VALIDATION_ERROR` |
| `EMOTION_NOT_FOUND` | `NOT_FOUND` |
| `INTERNAL_SERVER_ERROR` | `INTERNAL_ERROR` |

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Cuerpo, parámetros o UUID inválidos |
| 401 | `UNAUTHORIZED` | Falta el token o no es válido |
| 403 | `FORBIDDEN` | El usuario no tiene permiso |
| 404 | `NOT_FOUND` | El recurso o la ruta no existe |
| 409 | `CONFLICT` | Registro duplicado |
| 429 | `RATE_LIMIT_EXCEEDED` | Se superó el límite de solicitudes |
| 500 | `INTERNAL_ERROR` | Error no controlado |
| 500 | `AUTH_CONFIGURATION_ERROR` | Autenticación mal configurada |
| 503 | `SERVICE_NOT_CONFIGURED` | Falta configuración propia del servicio (p. ej. la API Key de un proveedor externo) |
| 502 | `UPSTREAM_ERROR` | Respuesta inválida de TMDB u otro servicio |
| 503 | `SERVICE_UNAVAILABLE` | Un servicio no está disponible |
| 504 | `GATEWAY_TIMEOUT` | Se agotó el tiempo de espera |

## 5. User Service

### `GET /api/users/me`

Devuelve el perfil propio. Responde `404 NOT_FOUND` si el trigger de Supabase aún no lo creó.

```json
{
  "status": "ok",
  "data": {
    "id": "uuid",
    "displayName": "Nombre",
    "avatarUrl": "https://example.com/avatar.png",
    "createdAt": "2026-11-01T20:00:00.000Z",
    "updatedAt": "2026-11-01T20:00:00.000Z"
  }
}
```

### `PATCH /api/users/me`

Actualiza uno o ambos campos. Debe incluir al menos uno y no admite otros.

```json
{
  "displayName": "Nombre",
  "avatarUrl": "https://example.com/avatar.png"
}
```

`displayName` admite `null` y hasta 120 caracteres. `avatarUrl` admite `null` o una URL válida. El servicio no crea ni elimina perfiles.

## 6. Emotion Service

La detección ocurre en el navegador. Este servicio nunca recibe ni guarda imágenes.

Registro de emoción:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "emotion": "HAPPY",
  "source": "CAMERA",
  "confidence": 0.92,
  "createdAt": "2026-11-01T20:00:00.000Z"
}
```

### `POST /api/emotions`

Crea un registro y responde `201`.

```json
{ "emotion": "HAPPY", "source": "CAMERA", "confidence": 0.92 }
```

`confidence` va de 0 a 1. Es obligatoria cuando `source` es `CAMERA`; con `MANUAL` debe omitirse.

La cámara usa face-api.js, que detecta 7 expresiones. El frontend las traduce así antes de enviarlas:

| face-api.js | `emotion` |
|---|---|
| `happy` | `HAPPY` |
| `sad` | `SAD` |
| `angry` | `ANGRY` |
| `neutral` | `NEUTRAL` |
| `fearful` | `FEARFUL` |
| `surprised` | `SURPRISED` |
| `disgusted` | `DISGUSTED` |

Las ocho emociones del frontend pueden registrarse con `CAMERA` o `MANUAL`. `SURPRISED` no se transforma en `NEGATIVE_SURPRISE`.

`NEGATIVE_SURPRISE`, `CONTEMPT`, `FRUSTRATION`, `CONFUSION`, `SHAME` y `BOREDOM` quedan fuera de la integración actual del frontend.

### `GET /api/emotions`

Devuelve el historial propio, del más reciente al más antiguo. Admite `from`, `to`, `page` y `limit`. Además de `page`, `limit` y `total`, `pagination` incluye `totalPages`, `hasNextPage` y `hasPreviousPage`.

### `GET /api/emotions/:id`

Devuelve un registro propio. Responde `404 NOT_FOUND` si no existe o pertenece a otro usuario.

## 7. Movie Service

### `POST /api/movies/recommendations`

Genera y guarda recomendaciones. Responde `200`.

```json
{ "emotionRecordId": "uuid", "cursor": "cursor-opcional" }
```

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
      "createdAt": "2026-11-01T20:00:00.000Z"
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

Esta ruta usa cursor en lugar de `page`. Cuando no hay más resultados, `nextCursor` es `null`.

Movie obtiene la emoción desde Emotion Service y reconoce sus 14 valores. Si Emotion no responde o devuelve un error, Movie responde `502 UPSTREAM_ERROR`.

### `GET /api/movies/recommendations`

Devuelve las recomendaciones guardadas. Admite `emotionRecordId`, `from`, `to`, `page` y `limit`. El valor predeterminado de `limit` es 10.

### `GET /api/movies/details/:tmdbId?mediaType=MOVIE`

Devuelve los metadatos normalizados de una película o serie desde TMDB.

## 8. Favorites Service

### `POST /api/favorites`

Crea un favorito y responde `201`. El cliente envía los metadatos que se guardarán.

```json
{
  "tmdbId": 550,
  "mediaType": "MOVIE",
  "title": "Fight Club",
  "posterPath": "/poster.jpg",
  "releaseDate": "1999-10-15",
  "voteAverage": 8.4
}
```

`title` es obligatorio. `posterPath`, `releaseDate` y `voteAverage` admiten `null`. `voteAverage` va de 0 a 10. Un duplicado responde `409 CONFLICT`.

### `GET /api/favorites`

Devuelve los favoritos propios, del más reciente al más antiguo. Admite `page` y `limit`. El valor predeterminado de `limit` es 20.

### `DELETE /api/favorites/:id`

Elimina un favorito propio y responde `204` sin cuerpo. Responde `404 NOT_FOUND` si no existe o pertenece a otro usuario.

## 9. Dashboard Service

### `GET /api/dashboard/summary`

Admite `from` y `to`. Reúne los datos de Emotion, Movie y Favorites sin leer sus tablas.

```json
{
  "status": "ok",
  "data": {
    "emotionTimeline": [
      { "date": "2026-11-01", "emotion": "HAPPY", "count": 2 }
    ],
    "recommendationsByEmotion": [
      { "emotion": "HAPPY", "mediaType": "MOVIE", "count": 10 }
    ],
    "favoritesCount": 4,
    "unavailable": []
  }
}
```

Si un servicio falla, el resumen conserva los datos disponibles y agrega ese servicio a `unavailable`, por ejemplo `["favorites"]`.

## 10. Meme Service (contenido bíblico)

El directorio, el puerto (3006) y el registro en el Gateway se conservan;
el contenido que sirve cambió de memes a versículos bíblicos relacionados
con la emoción del usuario. El texto siempre se obtiene en vivo de un
proveedor externo con licencia (hoy: api.bible); nunca se genera ni se
inventa.

**Traducción real en uso:** se verificó contra la cuenta real de api.bible
que RVR1960 y NVI no están habilitadas para esta clave (de 249 Biblias
visibles, ninguna coincide). Mientras se gestiona esa licencia con
api.bible/Biblica, el servicio usa **RVR09** (Reina Valera 1909, dominio
público) como traducción temporal. `translation`/`translationName` en la
respuesta reflejan siempre la traducción real configurada, obtenida en vivo
del proveedor (`GET /bibles/{bibleId}`), nunca un valor fijo en código.

### `GET /api/memes?emotion=HAPPY&translation=RVR09`

`emotion` es obligatoria. `translation` es opcional; si se envía y no
coincide con la traducción configurada en el servicio, responde
`400 VALIDATION_ERROR` en vez de mostrar contenido de una traducción que no
está confirmada.

```json
{
  "status": "ok",
  "data": {
    "provider": "api.bible",
    "translation": "RVR09",
    "translationName": "Reina Valera 1909",
    "externalId": "PHP.4.4",
    "reference": "Filipenses 4:4",
    "theme": "alegría",
    "text": "Gozaos en el Señor siempre: otra vez digo: Que os gocéis.",
    "copyright": "Reina-Valera 1909 - Dominio público. Fue realizada por Sociedades Bíblicas Unidas y publicada por primera vez en 1909."
  }
}
```

Si `BIBLE_API_KEY` no está configurada, o el proveedor configurado todavía
no está implementado, responde `503 SERVICE_NOT_CONFIGURED` con un mensaje
comprensible, sin afectar a los demás microservicios.

### `POST /api/memes/history`

Registra qué contenido se le mostró al usuario autenticado.

```json
{ "provider": "RVR09", "externalId": "PHP.4.4", "title": "Filipenses 4:4 (RVR09)", "emotionRecordId": "uuid-opcional" }
```

### `GET /api/memes/history`

Historial propio, paginado (`page`, `limit`, `from`, `to`), más reciente primero.

## 11. Comunicación entre servicios

Cada llamada usa la URL del servicio por variable de entorno, reenvía `Authorization` y tiene timeout. Estas llamadas no pasan por el Gateway.

El Gateway envía a cada servicio la IP del usuario en `X-Forwarded-For` y el identificador de la petición en `X-Request-Id`. Los servicios usan `app.set('trust proxy', 1)` para aplicar su rate limit por usuario. Por eso no deben quedar expuestos directamente a internet: solo el Gateway y el frontend son públicos.

| Origen | Destino | Llamada |
|---|---|---|
| Movie | Emotion | `GET {EMOTION_SERVICE_URL}/api/emotions/:id` |
| Dashboard | Emotion | `GET {EMOTION_SERVICE_URL}/api/emotions` |
| Dashboard | Movie | `GET {MOVIE_SERVICE_URL}/recommendations` |
| Dashboard | Favorites | `GET {FAVORITES_SERVICE_URL}/` |

Las respuestas entre servicios usan el formato de este contrato, excepto Emotion, que usa su formato interno. Ningún servicio lee ni escribe tablas de otro.

## 12. Auto-Wake (API Gateway)

Los seis microservicios corren en el plan gratuito de Render y se suspenden
tras 15 minutos sin tráfico (ver nota de límites en `render.yaml`). Estas dos
rutas dejan que el frontend le pida al Gateway que los reactive al entrar al
Dashboard, en vez de que cada usuario tenga que abrir manualmente la URL de
cada servicio. Requieren el mismo `Authorization: Bearer <token>` que el
resto de `/api/*`; no hay forma anónima de disparar un ciclo de activación.

### `POST /api/wake`

Si ya hay un ciclo en curso, no inicia uno nuevo: devuelve el estado actual
sin volver a pedirle nada a los seis servicios. Si no hay ninguno en curso,
arranca uno (pings paralelos a cada `/health`, con reintentos) y responde de
inmediato con el estado conocido hasta ese momento; no espera a que termine.

### `GET /api/wake`

Devuelve el estado más reciente sin iniciar nada. El frontend lo sondea
cada pocos segundos hasta que `onlineCount` llegue a `total` o se agote su
propio tiempo de espera.

Ambas responden el mismo cuerpo:

```json
{
  "status": "ok",
  "data": {
    "waking": true,
    "startedAt": "2026-11-10T00:00:00.000Z",
    "onlineCount": 3,
    "total": 6,
    "services": {
      "users": { "status": "online", "lastCheckedAt": "2026-11-10T00:00:00.000Z" },
      "emotions": { "status": "waking", "lastCheckedAt": "2026-11-10T00:00:00.000Z" },
      "movies": { "status": "timeout", "lastCheckedAt": "2026-11-10T00:00:00.000Z" },
      "favorites": { "status": "offline", "lastCheckedAt": null },
      "dashboard": { "status": "error", "lastCheckedAt": "2026-11-10T00:00:00.000Z" },
      "memes": { "status": "online", "lastCheckedAt": "2026-11-10T00:00:00.000Z" }
    }
  }
}
```

`status` de cada servicio: `offline` (nunca comprobado todavía), `waking`
(ping en curso), `online` (su `/health` respondió 200 con
`{ "status": "ok" }`), `timeout` (no respondió dentro del tiempo límite) o
`error` (respuesta distinta de 200, cuerpo inválido, o fallo de red/DNS). Un
servicio solo se marca `online` por responder correctamente a su propio
`/health`; nunca por haber recibido la solicitud de activación.

## 13. Temas por aprobar

- Definir si `/health` queda público en los servicios y cómo aislarlos en el despliegue.

### Nota de implementación de `GET /api/dashboard/summary`

Movie Service no expone `emotionRecordId` en `GET /recommendations` (ver sección 7), así que Dashboard Service no puede agrupar recomendaciones por emoción con una sola llamada. En su lugar: pide el historial de emociones a Emotion Service (hasta 200 registros más recientes del rango solicitado), y por cada registro de emoción distinto (hasta 30) consulta `GET /recommendations?emotionRecordId=<id>` en Movie Service para conocer su `mediaType`. Ninguna de las dos llamadas cambia el contrato de Emotion ni de Movie Service. Si en el futuro se agrega `emotionRecordId` a `GET /recommendations`, este paso puede simplificarse a una sola llamada.
