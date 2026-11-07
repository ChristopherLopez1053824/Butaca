# API Gateway

Es el único punto de entrada del frontend. Valida el JWT de Supabase, aplica las protecciones generales y reenvía cada petición al microservicio que corresponde. No contiene lógica de negocio ni acceso a la base de datos.

## Cómo ejecutarlo

Desde la raíz del repositorio:

```bash
pnpm install
cp services/api-gateway/.env.example services/api-gateway/.env
pnpm --filter @butaca/api-gateway dev
```

El servicio queda disponible en `http://localhost:3000`.

## Rutas

Todas las rutas `/api/*` requieren `Authorization: Bearer <token>`.

| Ruta | Destino | Puerto local |
|---|---|---|
| `GET /health` | API Gateway (pública) | 3000 |
| `/api/users/*` | User Service | 3001 |
| `/api/emotions/*` | Emotion Service | 3002 |
| `/api/movies/*` | Movie Service | 3003 |
| `/api/favorites/*` | Favorites Service | 3004 |
| `/api/dashboard/*` | Dashboard Service | 3005 |
| `/api/memes/*` | Meme Service | 3006 |

## Ruta que recibe cada servicio

El Gateway quita el prefijo antes de reenviar la petición, y cada servicio declara sus rutas sin `/api/<prefijo>`. Emotion Service es la excepción: conserva `/api/emotions`, así que el Gateway le reenvía la ruta completa, salvo `/health`.

| El frontend llama a | El servicio recibe |
|---|---|
| `GET /api/users/me` | `GET /me` |
| `POST /api/emotions` | `POST /api/emotions` |
| `GET /api/emotions/:id` | `GET /api/emotions/:id` |
| `GET /api/emotions/health` | `GET /health` |
| `POST /api/movies/recommendations` | `POST /recommendations` |
| `GET /api/favorites?limit=5` | `GET /?limit=5` |

## Autenticación

1. El frontend obtiene el JWT con Supabase Auth y lo envía en cada petición.
2. `@butaca/auth` verifica la firma, el emisor, la audiencia, la expiración y que `sub` sea un UUID.
3. El Gateway exige que `role` sea `authenticated`.
4. Se eliminan las cabeceras `x-user-*` y `x-internal-*` que envíe el cliente.
5. La cabecera `Authorization` se reenvía para que el servicio destino también pueda validar el token.

## Formato de Emotion Service

Emotion Service responde con `success` y `error`. El Gateway convierte esas respuestas al formato común antes de enviarlas al frontend, y cambia sus códigos propios por los del contrato. Por ejemplo, `INVALID_PARAMETERS` pasa a ser `VALIDATION_ERROR`.

## IP del usuario y rate limit

El Gateway limita a 200 peticiones cada 15 minutos por IP. Al reenviar una petición, reemplaza la cabecera `X-Forwarded-For` con la IP del usuario, así que cualquier valor enviado por el cliente se descarta. Cada servicio confía en un salto (`app.set('trust proxy', 1)`) y aplica su propio límite por usuario, no por la IP del Gateway.

Si el Gateway se despliega detrás de otro proxy, `TRUST_PROXY` indica cuántos proxies hay delante para obtener la IP real. En local queda en 0.

## Trazabilidad

Cada respuesta incluye la cabecera `X-Request-Id`. Si el frontend envía un `X-Request-Id` válido (letras, números, `.`, `_` o `-`, hasta 64 caracteres), el Gateway lo conserva; si no, genera un UUID. El mismo valor se reenvía al servicio y aparece en el log del Gateway:

```
[gateway] 0a3f78d1-f6db-47c4-a2d0-a2e559b84cab GET /api/movies/recommendations 200 812ms
```

El log no incluye la consulta de la URL ni las cabeceras, para no registrar datos del usuario.

## Errores

Todos los errores usan este formato:

```json
{ "status": "error", "code": "NOT_FOUND", "message": "Texto legible" }
```

| HTTP | `code` | Cuándo |
|---|---|---|
| 401 | `UNAUTHORIZED` | Falta el token o no es válido |
| 403 | `FORBIDDEN` | El rol no es `authenticated` |
| 404 | `NOT_FOUND` | La ruta no existe |
| 429 | `RATE_LIMIT_EXCEEDED` | Se superaron 200 peticiones en 15 minutos |
| 500 | `INTERNAL_ERROR` | Error inesperado del Gateway |
| 503 | `SERVICE_UNAVAILABLE` | El servicio destino no responde o se cayó |
| 504 | `GATEWAY_TIMEOUT` | El servicio superó `PROXY_TIMEOUT_MS` |

## Variables de entorno

El Gateway valida `PORT`, `WEB_URL`, `PROXY_TIMEOUT_MS`, `TRUST_PROXY`, `LOG_REQUESTS` y las URL de los servicios al iniciar. Si un valor no es válido, no arranca e indica cuál debe corregirse. Si una variable está vacía, usa su valor por defecto.

| Variable | Uso |
|---|---|
| `PORT` | Puerto del Gateway |
| `WEB_URL` | Origen permitido por CORS |
| `PROXY_TIMEOUT_MS` | Tiempo máximo de espera por servicio; por defecto, 15000 |
| `TRUST_PROXY` | Proxies delante del Gateway; por defecto, 0 |
| `LOG_REQUESTS` | `true` o `false`; por defecto registra todo, excepto en las pruebas |
| `SUPABASE_URL` | Proyecto de Supabase |
| `SUPABASE_JWT_ISSUER` | Emisor esperado del token |
| `SUPABASE_JWT_AUDIENCE` | Audiencia esperada del token |
| `SUPABASE_JWT_SECRET` | Solo para tokens antiguos firmados con HS256 |
| `*_SERVICE_URL` | URL de cada microservicio |

## Pruebas

```bash
pnpm --filter @butaca/api-gateway test
pnpm --filter @butaca/api-gateway test:unit
pnpm --filter @butaca/api-gateway test:integration
```

Las pruebas no necesitan Supabase ni los demás servicios, porque usan servidores simulados.