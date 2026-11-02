-- Ejecutar como administrador (rol postgres) desde el SQL Editor de Supabase.
-- No incluir contraseñas reales en este archivo ni en el repositorio.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'butaca_app'
  ) THEN
    EXECUTE 'CREATE ROLE butaca_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS';
  END IF;
END
$$;

ALTER ROLE butaca_app
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;

GRANT authenticated TO butaca_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM butaca_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM butaca_app;
REVOKE ALL ON SCHEMA public FROM butaca_app;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tableowner = 'butaca_app'
  ) THEN
    RAISE EXCEPTION 'butaca_app no debe ser propietario de tablas en public';
  END IF;
END
$$;

-- Ejecutar por separado, generando una contraseña fuera del repositorio:
-- ALTER ROLE butaca_app WITH PASSWORD '<PASSWORD_GENERADO_FUERA_DEL_REPOSITORIO>';
