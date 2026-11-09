# Meme Service (contenido bíblico relacionado con emociones)

A pesar del nombre del directorio y del puerto (se conservan por compatibilidad
con el registro actual en el API Gateway), este servicio ya no sirve memes.
Relaciona la emoción registrada del usuario con un versículo bíblico real,
obtenido en vivo de un proveedor externo con licencia, y guarda el historial
de qué se le mostró a cada usuario.

El texto bíblico **nunca se inventa ni se genera**: siempre se pide al
proveedor configurado (`BIBLE_API_PROVIDER`) en el momento de la solicitud.
El servicio solo guarda su propio catálogo de *referencias* (cita bíblica +
tema), que no son material protegido por derechos de autor.

## Arquitectura y dependencias

- Express + Helmet + `express-rate-limit`, igual que el resto de servicios internos.
- `@butaca/auth` (`requireAuth`) para validar el JWT de Supabase.
- `@butaca/database` (`withUserContext`) para leer/escribir `MemeHistory` con RLS.
- `fetch` nativo de Node para llamar al proveedor bíblico — sin SDK adicional.
- No se comunica con Emotion ni Movie Service directamente; recibe la emoción
  como parámetro de consulta, igual que hoy la envía el frontend.

## Proveedor de contenido bíblico

Hoy solo está implementado **api.bible** (`src/clients/bible.client.js`),
usando su endpoint público documentado:

```
GET {BIBLE_API_BASE_URL}/bibles/{BIBLE_API_TRANSLATION}/passages/{referencia}
Header: api-key: <BIBLE_API_KEY>
```

Referencia: <https://docs.api.bible/guides/passages>.

RVR1960 y NVI son traducciones con derechos de autor (Sociedades Bíblicas
Unidas / American Bible Society, y Biblica respectivamente). **No asumas que
están disponibles solo porque aparecen en la página pública de un
proveedor** — tu cuenta de api.bible debe tenerlas habilitadas, lo cual se
confirma consultando `GET /v1/bibles` ya autenticado desde el panel o la API.
Hasta que eso se confirme, el servicio no debe mostrar ningún contenido de
esa traducción como si viniera realmente de ella.

### Estado real confirmado (verificado contra la cuenta de api.bible en uso)

Se consultó `GET /v1/bibles` con la clave real configurada: de 249 Biblias
visibles para esta cuenta, **ninguna es RVR1960 ni NVI**. Lo más cercano es
`RVR09` (Reina Valera 1909, dominio público), que sí está disponible.
Conseguir RVR1960 o NVI requiere pedir la licencia "Standard License" a
api.bible/Biblica por separado — no es automático con solo tener una cuenta.

Mientras se gestiona esa licencia, el servicio usa **RVR09** como traducción
temporal (`bibleId` `592420522e16049f-01`), con su atribución real de
dominio público. No es RVR1960: es una traducción distinta y más antigua,
usada aquí solo para que el resto del sistema sea probable de extremo a
extremo con texto bíblico real, no inventado.

Para agregar NVI o RVR1960 más adelante, una vez obtenida la licencia: solo
se necesita el `bibleId` real que te entregue el proveedor para esa
traducción. La arquitectura (cliente, catálogo, rutas) no cambia — el
`abbreviation`/`name` que se muestra al usuario se obtiene siempre en vivo
de `GET /bibles/{bibleId}` (con caché en memoria del proceso), nunca
hardcodeado.

### ¿Por qué no se implementó YouVersion Platform Services?

Tiene un catálogo público que confirma RVR1960 y NVI
(`bible.com/languages/spa`), pero no encontramos documentación pública de
sus endpoints REST reales (rutas, formato de respuesta) sin crear una cuenta
de desarrollador. Como la instrucción fue no inventar endpoints ni formatos,
se dejó solo preparada la arquitectura para añadirlo después si se confirma
su documentación.

## Variables de entorno

| Variable | Obligatoria | Qué hace si falta |
|---|---|---|
| `PORT` | No (default `3006`) | — |
| `NODE_ENV` | No (default `development`) | — |
| `BIBLE_API_PROVIDER` | No (default `api.bible`) | Si se pone un proveedor no implementado, `GET /` responde `503 SERVICE_NOT_CONFIGURED`. |
| `BIBLE_API_BASE_URL` | No (default `https://rest.api.bible/v1`) | — |
| `BIBLE_API_KEY` | **Sí, para `GET /`** | Si falta, `GET /` responde `503 SERVICE_NOT_CONFIGURED` con un mensaje claro. El servicio arranca y `/health` funciona igual sin ella. |
| `BIBLE_API_TRANSLATION` | **Sí, para `GET /`** (default `592420522e16049f-01` = RVR09, ver nota arriba) | Si el `bibleId` no es válido para tu clave, `GET /` responde `404 NOT_FOUND`. |
| `BIBLE_API_TIMEOUT_MS` | No (default `5000`) | — |
| `SUPABASE_URL` / `SUPABASE_JWT_ISSUER` / `SUPABASE_JWT_AUDIENCE` / `SUPABASE_JWT_SECRET` / `SUPABASE_JWKS_URL` | Sí, para cualquier ruta autenticada | Sin esto, `@butaca/auth` responde `500 AUTH_CONFIGURATION_ERROR` en vez de validar el token. |
| `DATABASE_URL` | Sí, para arrancar | Sin esto, `@butaca/database` lanza un error al importarse y el proceso no inicia. |

**Importante sobre `BIBLE_API_TRANSLATION`:** no es el texto "RVR1960" de
forma literal — es el `bibleId` opaco que api.bible asigna a esa traducción
en tu cuenta. El valor en `.env.example` es solo un marcador de posición;
reemplázalo por el id real una vez que lo confirmes.

Copia `.env.example` a `.env` y completa los valores. El `.env` no se incluye
en este cambio — tú agregas la API Key manualmente.

## Endpoints

### `GET /` (vía Gateway: `GET /api/memes?emotion=HAPPY&translation=RVR1960`)

Devuelve un versículo real relacionado con la emoción. `emotion` es
obligatoria; `translation` es opcional, pero si se envía debe coincidir con
la traducción configurada (si no coincide, `400 VALIDATION_ERROR`, nunca se
inventa contenido de otra traducción).

```json
{
  "status": "ok",
  "data": {
    "provider": "api.bible",
    "translation": "RVR1960",
    "externalId": "JHN.3.16",
    "reference": "Juan 3:16",
    "theme": "esperanza",
    "text": "Porque de tal manera amó Dios al mundo...",
    "copyright": "© Sociedades Bíblicas Unidas. Usado con permiso."
  }
}
```

### `POST /history` (vía Gateway: `POST /api/memes/history`)

Registra qué contenido se le mostró al usuario autenticado (el `userId`
siempre sale del JWT, nunca del cuerpo).

```json
{ "provider": "RVR1960", "externalId": "JHN.3.16", "title": "Juan 3:16 (RVR1960)", "emotionRecordId": "uuid-opcional" }
```

### `GET /history` (vía Gateway: `GET /api/memes/history`)

Historial propio, paginado (`page`, `limit`, `from`, `to`), más reciente primero.

## Catálogo de emociones

`src/domain/emotion-verse-catalog.js` relaciona las ocho emociones del
frontend con 2–3 referencias bíblicas reales cada una (cita, no texto). No
modifica los valores del enum `Emotion` de Prisma.

## Historial (`MemeHistory`)

Se reutiliza el modelo y la tabla existentes (`meme_history`), con RLS ya
migrada:

- `provider` → código de la traducción/proveedor.
- `externalId` → referencia canónica (`JHN.3.16`).
- `title` → referencia legible (`"Juan 3:16 (RVR1960)"`).
- `emotionRecordId` → igual que antes, opcional, debe pertenecer al mismo usuario.
- `imageUrl` ahora es opcional (migración `0004_meme_history_optional_image`,
  aditiva — no borra ni modifica los 4 registros de memes que ya existían).

No se agregó ninguna columna para guardar el texto bíblico completo: el
texto se obtiene siempre en vivo del proveedor, nunca se redistribuye desde
nuestra base de datos.

## Ejecución

```bash
pnpm --filter @butaca/meme-service dev
```

## Pruebas

```bash
pnpm --filter @butaca/meme-service test
```

Las pruebas usan mocks para `@butaca/auth`, `@butaca/database` y el
proveedor bíblico — no requieren una `BIBLE_API_KEY` real ni acceso a la base de datos.

## Seguridad

- Nunca se usa el texto bíblico para entrenar modelos de IA ni se envía a
  servicios de IA para procesarlo — se muestra tal cual lo entrega el
  proveedor, con su aviso de copyright.
- La API Key nunca se expone en la URL, en logs ni en respuestas HTTP; va
  solo en el header `api-key` de la petición al proveedor.
- Todas las rutas de negocio exigen `Authorization: Bearer <JWT>` y usan
  `withUserContext` para que RLS limite cada consulta al propio usuario.
