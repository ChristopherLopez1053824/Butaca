import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Las pruebas de RLS consultan Supabase por internet y cada consulta suma latencia.
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
