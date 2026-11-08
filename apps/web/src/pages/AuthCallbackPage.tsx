import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthLoading } from '../components/AuthLoading'
import { ButacaLogo } from '../components/ButacaLogo'
import '../styles/auth.css'

function getCallbackError() {
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ''),
  )
  const queryParams = new URLSearchParams(window.location.search)
  const description =
    hashParams.get('error_description') ??
    queryParams.get('error_description')

  if (description) {
    return description
  }

  const code = hashParams.get('error') ?? queryParams.get('error')

  if (!code) {
    return null
  }

  if (code === 'access_denied') {
    return 'El acceso fue cancelado o denegado.'
  }

  return code
}

export function AuthCallbackPage() {
  const { session, loading, error } = useAuth()
  const [callbackError] = useState<string | null>(() => getCallbackError())

  if (loading) {
    return <AuthLoading message="Completando inicio de sesión..." />
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="auth-page auth-page-centered">
      <section
        className="auth-card auth-card-narrow"
        aria-labelledby="callback-title"
      >
        <ButacaLogo centered subtitle="Tu butaca emocional" />

        <span className="eyebrow">No pudimos completar el acceso</span>
        <h1 id="callback-title">No se pudo iniciar sesión</h1>

        <p className="form-error" role="alert">
          {callbackError ?? error ?? 'No se recibió una sesión válida.'}
        </p>

        <p className="auth-note">
          Si el problema continúa, revisa la configuración de los proveedores y
          las URLs de redirección autorizadas en Supabase.
        </p>

        <Link className="button button-full" to="/login">
          Volver al inicio de sesión
        </Link>
      </section>
    </main>
  )
}
