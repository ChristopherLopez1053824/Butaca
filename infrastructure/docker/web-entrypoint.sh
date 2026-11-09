#!/bin/sh
# Genera /env.js con las variables reales del contenedor en tiempo de
# arranque (no en tiempo de build). nginx:alpine ejecuta automáticamente
# todo script en /docker-entrypoint.d/ antes de iniciar nginx.
#
# Esto existe porque Render Blueprint no permite pasar build args de Docker
# por render.yaml: sin esto, VITE_API_URL/VITE_SUPABASE_* quedarían vacíos
# en cualquier imagen construida fuera de un entorno con esos ARG.
set -eu

escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/env.js <<EOF
window.__ENV__ = {
  VITE_API_URL: "$(escape "${VITE_API_URL:-}")",
  VITE_SUPABASE_URL: "$(escape "${VITE_SUPABASE_URL:-}")",
  VITE_SUPABASE_ANON_KEY: "$(escape "${VITE_SUPABASE_ANON_KEY:-}")"
};
EOF
