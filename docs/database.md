# Base de datos, RLS y contexto de usuario

## Contexto de usuario con Prisma

`packages/database/src/user-context.js` exporta:

```js
withUserContext(userId, callback)
createUserContext(prismaClient)
```

`createUserContext()` permite crear el helper con un cliente Prisma propio, útil para pruebas de aislamiento con una conexión controlada. El export `withUserContext` usa el cliente compartido de `src/client.js`.

El helper:

1. Valida que `userId` sea un UUID.
2. Abre una transacción interactiva de Prisma.
3. Ejecuta `set_config(..., true)` para dejar el contexto limitado a la transacción.
4. Configura `request.jwt.claims`, `request.jwt.claim.sub` y `request.jwt.claim.role`. Los dos primeros son los que utiliza `auth.uid()` en Supabase.
5. Ejecuta `SET LOCAL ROLE authenticated`.
6. Entrega únicamente el cliente transaccional `tx` al callback.
7. Propaga los errores para que Prisma haga rollback automático.

Ejemplo de uso:

```js
import { withUserContext } from '@butaca/database';

const favorites = await withUserContext(req.auth.userId, (tx) =>
  tx.favorite.findMany()
);
```

Todas las consultas del callback deben usar `tx`. No se debe usar el `prisma` global dentro del callback, porque esa consulta podría ejecutarse en otra conexión del pool sin el contexto del usuario.

El rol nunca se toma del cliente. `withUserContext` fija siempre `authenticated`.

## auth.uid() en Supabase

Supabase implementa `auth.uid()` leyendo el contexto JWT. Dependiendo de la versión del proyecto puede leer:

- `request.jwt.claim.sub`
- `request.jwt.claims` como JSON y su propiedad `sub`

Por eso el helper configura ambas variables con `set_config(..., true)`. El tercer argumento `true` hace que el valor sea local a la transacción y PostgreSQL lo restablezca al hacer commit o rollback.

## Requisito del rol de conexión

`SET LOCAL ROLE authenticated` solo funciona si el rol de login tiene membresía sobre `authenticated`.

El rol de ejecución de los microservicios debe:

- No ser `SUPERUSER`.
- No tener `BYPASSRLS`.
- No ser propietario de las tablas.
- Tener `GRANT authenticated TO butaca_app`.
- Conectarse mediante `DATABASE_URL`.
- Mantener `DIRECT_URL` únicamente para migraciones y tareas administrativas.

El script `packages/database/sql/butaca_app_role.sql` prepara ese rol, revoca cualquier permiso directo sobre tablas, secuencias y el esquema `public`, y verifica que `butaca_app` no sea propietario de tablas. No contiene contraseñas reales. La contraseña debe generarse fuera del repositorio y asignarse manualmente:

```sql
ALTER ROLE butaca_app WITH PASSWORD '<PASSWORD_GENERADO_FUERA_DEL_REPOSITORIO>';
```

En el pooler de Supabase el usuario del connection string suele tener el formato:

```text
butaca_app.<project-ref>
```

## Migración RLS

La migración `packages/database/prisma/migrations/0002_rls/migration.sql`:

- Habilita RLS en `profiles`, `emotion_records`, `recommendations`, `favorites` y `meme_history`.
- Crea políticas únicamente para el rol `authenticated`.
- No crea políticas para `anon`.
- Permite operaciones sobre filas propias.
- Verifica que `recommendations.emotion_record_id` pertenezca al mismo usuario.
- Verifica que `meme_history.emotion_record_id`, cuando no es `NULL`, pertenezca al mismo usuario.
- Revoca permisos de tabla a `anon` y `PUBLIC`.
- Concede a `authenticated` y `service_role` solo `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre las tablas de aplicación.
- Crea el trigger `on_auth_user_created` para insertar un perfil cuando se crea un usuario en `auth.users`, incluyendo `created_at` y `updated_at`.

El trigger `public.handle_new_user()` es `SECURITY DEFINER` y usa `search_path = ''`. Lee únicamente datos opcionales de `raw_user_meta_data` y no almacena contraseñas ni tokens. PostgreSQL no permite invocar una función de trigger directamente como RPC; por eso se mantiene su `EXECUTE` por defecto y no se revoca.

## Pasos manuales en Supabase

1. Revisar y aplicar la migración `0002_rls` desde un entorno autorizado. No se ejecutó en este repositorio.
2. Ejecutar `packages/database/sql/butaca_app_role.sql` como administrador.
3. Asignar una contraseña segura a `butaca_app` fuera del repositorio.
4. Configurar `DATABASE_URL` con el usuario `butaca_app` y `DIRECT_URL` con el usuario administrador.
5. Confirmar que el pooler use el formato de usuario `butaca_app.<project-ref>`.
6. Verificar que `auth.users`, el rol `authenticated` y la función `auth.uid()` existan.
7. Probar el trigger creando un usuario de prueba y comprobando que aparece su fila en `profiles`.

## Pruebas RLS

Las pruebas de integración reales están en:

```text
packages/database/tests/rls.integration.test.js
```

No usan mocks. Se omiten automáticamente si faltan las variables de entorno. Para ejecutarlas se necesitan dos usuarios reales de Supabase Auth y una base de datos con las migraciones aplicadas.

Variables requeridas:

```env
RLS_TEST_DATABASE_URL=postgresql://butaca_app.<project-ref>:<password>@<host>:6543/postgres
RLS_TEST_ADMIN_URL=postgresql://postgres.<project-ref>:<password>@<host>:5432/postgres
RLS_TEST_USER_A=<uuid-de-un-usuario-real-de-auth.users>
RLS_TEST_USER_B=<uuid-de-otro-usuario-real-de-auth.users>
```

Ejecución:

```bash
pnpm --filter @butaca/database test:integration
```

Las pruebas cubren:

- `auth.uid()`, `request.jwt.claim.role` y `current_user = authenticated` dentro de la transacción.
- Lectura de registros propios.
- Bloqueo de lectura de registros ajenos.
- Bloqueo de inserción con `user_id` ajeno.
- Bloqueo de actualización y eliminación de registros ajenos.
- Bloqueo de cambios de `user_id` en un registro propio.
- Aislamiento de `profiles` entre usuarios.
- Bloqueo de recomendaciones y de `meme_history` asociados a emociones ajenas.
- Ausencia de filtración de contexto entre transacciones consecutivas y sobre una conexión reutilizada.
- Rollback ante errores.
- Denegación de acceso sin contexto de usuario.
- Creación del perfil mediante el trigger y presencia de `created_at` y `updated_at`.

## Limitaciones

- RLS no se aplica al propietario de las tablas ni a roles con `BYPASSRLS`. Por eso los microservicios no deben conectarse como `postgres`.
- El trigger de perfiles requiere que `auth.users` exista; está pensado para Supabase.
- La migración no se aplicó en este repositorio. Las pruebas de integración solo son válidas después de aplicarla manualmente.
- El helper no puede impedir por sí solo que un desarrollador use el `prisma` global dentro del callback. Esa regla debe respetarse en el código de cada microservicio.
