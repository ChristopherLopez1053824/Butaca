# Contratos implementados

Las rutas de negocio públicas de estos servicios requieren
`Authorization: Bearer <JWT>`. El gateway valida el token y elimina el prefijo
del proxy antes de enviar la solicitud: `/api/users/me` llega a user-service
como `/me`; `/api/favorites` llega a favorites-service como `/`. Por eso ambos
servicios validan también el JWT y obtienen de él el UUID del usuario; no aceptan un id de
usuario en la ruta ni en el cuerpo. Los accesos a datos se ejecutan dentro de
`withUserContext` para aplicar RLS.

Las respuestas exitosas usan `{ "status": "ok", "data": ... }`. Los errores usan
`{ "status": "error", "code": "...", "message": "..." }`; los errores de
validación pueden incluir `details`.

## User Service

### `GET /api/users/me`

Devuelve el perfil propio. Responde `404 NOT_FOUND` si el trigger de Supabase
aún no creó el perfil.

### `PATCH /api/users/me`

Actualiza uno o ambos campos del perfil. El cuerpo debe incluir al menos un campo
y no puede contener otros:

```json
{
  "displayName": "Nombre",
  "avatarUrl": "https://example.com/avatar.png"
}
```

`displayName` admite `null` y hasta 120 caracteres; `avatarUrl` admite `null` o
una URL válida. El servicio no crea ni elimina perfiles.

## Favorites Service

### `POST /api/favorites`

Crea un favorito y responde `201`. El cliente proporciona el título porque el
Movie Service aún no ofrece la consulta de metadatos:

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

`mediaType` admite `MOVIE` o `TV`; `posterPath`, `releaseDate` y `voteAverage`
son opcionales y admiten `null`. El título es obligatorio. `releaseDate` usa
`YYYY-MM-DD` y `voteAverage` debe estar entre 0 y 10. Un favorito duplicado
responde `409 CONFLICT`.

### `GET /api/favorites`

Devuelve los favoritos propios, ordenados por fecha de creación descendente, con
paginación opcional mediante `page` (predeterminado `1`) y `limit`
(predeterminado `20`, máximo `100`):

```json
{
  "status": "ok",
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 0 }
}
```

### `DELETE /api/favorites/:id`

Elimina el favorito propio con el UUID indicado. Responde `204` sin cuerpo, o
`404 NOT_FOUND` si no existe o no pertenece al usuario autenticado.