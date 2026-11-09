# Ejecuta la coleccion de Postman desde la terminal, sin abrir Postman.
# Requisitos: servicios levantados (pnpm dev:services) y apps/web/.env con VITE_SUPABASE_ANON_KEY.
#
# Uso (desde la raiz del repositorio):
#   powershell -ExecutionPolicy Bypass -File docs\postman\probar-api.ps1 -Email tu@correo.com -Password tuClave

param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$BaseUrl = "http://localhost:3000"
)

$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envWeb = Join-Path $raiz "apps\web\.env"
if (-not (Test-Path $envWeb)) { Write-Error "No existe apps\web\.env"; exit 1 }

$linea = Get-Content $envWeb | Where-Object { $_ -match '^\s*VITE_SUPABASE_ANON_KEY\s*=' } | Select-Object -First 1
if (-not $linea) { Write-Error "Falta VITE_SUPABASE_ANON_KEY en apps\web\.env"; exit 1 }
$anonKey = ($linea -split '=', 2)[1].Trim().Trim('"').Trim("'")

$coleccion = Join-Path $PSScriptRoot "Butaca.postman_collection.json"

npx --yes newman@6 run $coleccion `
  --env-var "baseUrl=$BaseUrl" `
  --env-var "anonKey=$anonKey" `
  --env-var "email=$Email" `
  --env-var "password=$Password"

exit $LASTEXITCODE
