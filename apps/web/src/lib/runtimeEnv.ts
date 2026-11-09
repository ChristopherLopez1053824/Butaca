// En producción (contenedor), /env.js lo genera el arranque del contenedor
// con las variables reales (ver infrastructure/docker/web-entrypoint.sh) y
// las deja en window.__ENV__. En desarrollo local ese archivo no existe,
// así que se usan las variables normales de Vite (import.meta.env).

export interface RuntimeEnv {
  VITE_API_URL?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

declare global {
  interface Window {
    __ENV__?: RuntimeEnv
  }
}

export function getRuntimeEnv(key: keyof RuntimeEnv): string | undefined {
  if (typeof window !== 'undefined') {
    const value = window.__ENV__?.[key]

    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  return import.meta.env[key]
}
