
# Emotion Service — Butaca 🎬

Microservicio encargado de registrar, validar y consultar los estados emocionales de los usuarios de Butaca.

Forma parte de la arquitectura de microservicios del proyecto y permite que otros servicios, como Movie Service, consulten las emociones registradas mediante una API REST.

## 1. Tecnologías utilizadas

- Node.js y Express 5: desarrollo de la API REST.
- Zod: validación de datos de entrada.
- Prisma 7: acceso a la base de datos.
- Supabase PostgreSQL: almacenamiento de emociones.
- Supabase Auth: autenticación mediante JWT.
- Vitest y Supertest: pruebas unitarias y de integración.
- Helmet y express-rate-limit: seguridad del servidor.

## 2. Responsabilidades

Emotion Service permite:

- Registrar emociones detectadas por cámara o seleccionadas manualmente.
- Validar las emociones y sus datos asociados.
- Almacenar registros en la tabla `emotion_records`.
- Consultar el historial emocional de un usuario.
- Filtrar registros por fecha y aplicar paginación.
- Consultar emociones individuales mediante su ID.
- Restringir el acceso a los datos del usuario autenticado.

La detección facial corresponde al Frontend.

Emotion Service no recibe ni almacena fotografías o imágenes de la cámara.

La generación de recomendaciones corresponde a Movie Service.

## 3. Emociones permitidas

La API permite registrar las siguientes emociones:

| Emoción | Valor |
|---|---|
| Tristeza | `SAD` |
| Enojo | `ANGRY` |
| Miedo | `FEARFUL` |
| Asco | `DISGUSTED` |
| Sorpresa negativa | `NEGATIVE_SURPRISE` |
| Desprecio | `CONTEMPT` |
| Frustración | `FRUSTRATION` |
| Confusión | `CONFUSION` |
| Vergüenza | `SHAME` |
| Aburrimiento | `BOREDOM` |

Estas emociones se validan mediante Zod.

El enum de PostgreSQL conserva otros valores originales por compatibilidad con el esquema existente, pero el endpoint POST solo acepta las diez emociones acordadas.

## 4. Origen de las emociones

Se admiten dos valores para `source`:

- `CAMERA`: emoción estimada mediante detección facial en el Frontend.
- `MANUAL`: emoción seleccionada directamente por el usuario.

Cuando el origen es `CAMERA`, se requiere el campo `confidence`, con un valor entre 0 y 1.

Cuando el origen es `MANUAL`, no se debe enviar `confidence`.

El nivel de confianza representa la puntuación asignada por el detector a una expresión facial, no la intensidad emocional real del usuario.

## 5. Endpoints

Puerto predeterminado: `3002`

### GET /health

Comprueba que el microservicio está funcionando.

No requiere autenticación.

Respuesta HTTP 200:

```json
{
  "status": "ok",
  "service": "emotion-service",
  "timestamp": "2026-11-05T19:44:35.814Z"
}
```

### POST /api/emotions

Registra una nueva emoción del usuario autenticado.

Requiere JWT.

Ejemplo de solicitud manual:

```json
{
  "emotion": "SAD",
  "source": "MANUAL"
}
```

Ejemplo de solicitud con cámara:

```json
{
  "emotion": "ANGRY",
  "source": "CAMERA",
  "confidence": 0.91
}
```

Respuesta HTTP 201:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "660e8400-e29b-41d4-a716-446655440000",
    "emotion": "SAD",
    "source": "MANUAL",
    "confidence": null,
    "createdAt": "2026-11-05T19:30:00.000Z"
  }
}
```

Los identificadores y las fechas son ilustrativos.

El `userId` se obtiene del JWT validado y no del cuerpo de la solicitud.

### GET /api/emotions

Consulta el historial emocional del usuario autenticado.

Requiere JWT.

Parámetros opcionales:

| Parámetro | Descripción |
|---|---|
| `page` | Página solicitada. Predeterminado: 1 |
| `limit` | Registros por página. Predeterminado: 10, máximo: 100 |
| `from` | Fecha inicial ISO 8601 UTC, inclusiva |
| `to` | Fecha final ISO 8601 UTC, inclusiva |

Ejemplo:

```http
GET /api/emotions?page=1&limit=10
```

Respuesta HTTP 200:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

El ejemplo muestra un historial vacío.

Los registros se ordenan por `createdAt` descendente y, como criterio secundario, por ID descendente.

La paginación se realiza directamente en PostgreSQL mediante Prisma.

### GET /api/emotions/:id

Consulta un registro emocional mediante su UUID.

Requiere JWT.

Ejemplo:

```http
GET /api/emotions/550e8400-e29b-41d4-a716-446655440000
```

El servicio devuelve el registro únicamente si pertenece al usuario autenticado.

Si el registro no existe o pertenece a otro usuario, devuelve HTTP 404.

## 6. Autenticación y seguridad

Todas las rutas `/api/emotions` requieren autenticación.

Las solicitudes deben incluir:

```http
Authorization: Bearer <JWT>
```

Se utiliza `@butaca/auth` para verificar el token de Supabase.

La identidad autenticada se obtiene de `req.auth.userId`.

Las consultas a la base de datos utilizan `withUserContext()` del paquete `@butaca/database`.

Esta función ejecuta las operaciones dentro de una transacción configurada con el contexto del usuario, permitiendo aplicar las políticas Row Level Security (RLS).

También se utiliza:

- Helmet para configurar cabeceras de seguridad.
- Rate limiting de 100 solicitudes por 15 minutos.
- Zod para validar los datos de entrada.
- Restricción por `userId` en las consultas.
- Variables de entorno para proteger las credenciales.

## 7. Manejo de errores

Las rutas de negocio utilizan el siguiente formato:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Los datos de la emoción son inválidos."
  }
}
```

Principales códigos HTTP:

| Código | Descripción |
|---|---|
| 200 | Consulta exitosa |
| 201 | Emoción registrada |
| 400 | Parámetros o datos inválidos |
| 401 | Autenticación ausente o inválida |
| 403 | Usuario sin permisos |
| 404 | Registro o ruta inexistente |
| 413 | Solicitud demasiado grande |
| 500 | Error interno del servidor |

Nota de integración: el middleware compartido `@butaca/auth` utiliza actualmente el formato `status: "error"` para errores de autenticación HTTP 401. Los errores propios de Emotion Service utilizan `success: false`. Esta diferencia debe acordarse con el equipo antes de la integración definitiva.

## 8. Configuración del entorno

El proyecto utiliza pnpm y paquetes compartidos dentro de un monorepo.

Desde la raíz del proyecto, instalar las dependencias:

```powershell
pnpm install
```

Crear un archivo `.env` dentro de `services/emotion-service/`, utilizando `.env.example` como referencia.

Variables necesarias:

```dotenv
PORT=3002
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
SUPABASE_JWT_AUDIENCE=authenticated
```

- `DATABASE_URL`: conexión de ejecución a PostgreSQL.
- `DIRECT_URL`: conexión utilizada para migraciones de Prisma desde la configuración del paquete Database.
- `SUPABASE_URL`: URL del proyecto de Supabase Auth.
- `SUPABASE_JWT_AUDIENCE`: audiencia esperada del JWT.

La configuración de autenticación también permite variables adicionales para JWKS o JWT Secret según el tipo de firma utilizado por Supabase.

No incluir credenciales reales en el repositorio.

### Generar el cliente Prisma

Desde la raíz de Butaca:

```powershell
pnpm --filter @butaca/database db:generate
```

Las migraciones deben coordinarse con el equipo encargado del esquema compartido.

La migración `0003_add_emotion_values` incorpora las seis emociones adicionales al enum de PostgreSQL.

## 9. Ejecución local

Desde la raíz del proyecto:

```powershell
pnpm --filter @butaca/emotion-service exec node --env-file=.env --watch src/server.js
```

Una vez iniciado, comprobar:

```text
http://localhost:3002/health
```

Si el servicio está funcionando, devolverá `status: "ok"`.

Esta comprobación confirma el funcionamiento del servidor, pero no sustituye las pruebas de acceso a PostgreSQL.

## 10. Pruebas

El microservicio utiliza Vitest y Supertest.

### Pruebas unitarias

Validan las reglas del esquema Zod.

Ejecutar desde la raíz:

```powershell
pnpm --filter @butaca/emotion-service test:unit
```

Incluyen verificaciones de:

- Emociones permitidas.
- Emociones inválidas.
- Origen CAMERA y MANUAL.
- Confianza entre 0 y 1.
- Campos obligatorios y adicionales.

### Pruebas de integración

Las pruebas de emociones utilizan autenticación real y conexión a Supabase PostgreSQL, sin reemplazar Prisma ni la autenticación por mocks.

Requieren un JWT válido de un usuario de prueba.

En PowerShell:

```powershell
$env:TEST_JWT = $session.access_token
pnpm --filter @butaca/emotion-service test:integration
```

La variable `$session` debe contener una sesión vigente obtenida mediante Supabase Auth.

Para ejecutar también la prueba de aislamiento entre usuarios, se requiere una segunda cuenta real:

```powershell
$env:TEST_JWT_2 = $session2.access_token
```

Las pruebas comprueban:

- Rechazo de solicitudes sin JWT.
- Registro de emociones manuales y de cámara.
- Consulta por ID.
- Historial y paginación.
- Filtros por fecha.
- Validación de parámetros incorrectos.
- Restricción de acceso entre usuarios.

Las pruebas pueden crear registros reales de emociones y están diseñadas para eliminar los que generen durante la ejecución.

No deben ejecutarse con cuentas o datos de producción.

### Ejecutar todas las pruebas

```powershell
pnpm --filter @butaca/emotion-service test
```

Las pruebas de integración requieren sus variables de entorno correspondientes.

## 11. Integración con otros servicios

Emotion Service es propietario de la tabla `emotion_records`.

Movie Service puede consultar una emoción mediante:

```http
GET /api/emotions/:id
```

También puede obtener el historial mediante:

```http
GET /api/emotions
```

Las peticiones deben incluir la autenticación del usuario.

Movie Service no debe consultar directamente `emotion_records` ni importar los repositorios internos de Emotion Service.

Emotion Service devuelve la emoción registrada, mientras que Movie Service se encarga de determinar las recomendaciones correspondientes.

## 12. Estado de implementación

Se comprobó manualmente el funcionamiento de:

- Registro de emociones mediante POST.
- Consulta del historial mediante GET.
- Consulta de una emoción mediante su ID.
- Autenticación con JWT real.
- Persistencia y recuperación de registros en Supabase.
- Migración de las seis emociones adicionales.

También se ejecutaron pruebas automatizadas de integración con Supabase real.

Antes de la integración definitiva se debe confirmar el contrato de respuestas con el equipo y completar la verificación de aislamiento con dos usuarios si aún está pendiente.

## 13. Alcance del microservicio

Emotion Service no implementa:

- Inicio de sesión con Google o GitHub.
- Detección de expresiones faciales.
- Captura o almacenamiento de imágenes.
- Recomendaciones de películas.
- Gestión de favoritos.
- Generación de memes.
- Interfaz del dashboard.

Estas funcionalidades pertenecen a los componentes correspondientes de la arquitectura Butaca.
