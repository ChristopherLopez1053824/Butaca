const AUTH_ERROR_MESSAGES = [
  {
    pattern: /invalid login credentials/i,
    message: 'Correo o contraseña incorrectos.',
  },
  {
    pattern: /email not confirmed/i,
    message: 'Debes confirmar tu correo antes de iniciar sesión.',
  },
  {
    pattern: /user already registered|already registered/i,
    message: 'Ya existe una cuenta con este correo electrónico.',
  },
  {
    pattern: /password should be at least|password.*characters/i,
    message: 'La contraseña no cumple con la longitud mínima requerida.',
  },
  {
    pattern: /signups not allowed|signup.*disabled/i,
    message: 'El registro de nuevas cuentas no está habilitado en Supabase.',
  },
  {
    pattern: /provider is not enabled|unsupported provider/i,
    message:
      'El proveedor de inicio de sesión no está habilitado en Supabase.',
  },
  {
    pattern: /only request this after|rate limit|too many requests/i,
    message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  },
  {
    pattern: /invalid email|email address.*invalid/i,
    message: 'El correo electrónico ingresado no es válido.',
  },
  {
    pattern: /failed to fetch|network request failed|fetch failed/i,
    message: 'No se pudo conectar con Supabase. Revisa tu conexión.',
  },
] as const

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const knownError = AUTH_ERROR_MESSAGES.find(({ pattern }) =>
      pattern.test(error.message),
    )

    return knownError?.message ?? error.message
  }

  return 'No se pudo completar la autenticación. Inténtalo de nuevo.'
}
