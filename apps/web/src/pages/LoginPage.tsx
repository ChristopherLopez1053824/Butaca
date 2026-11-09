import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { OAuthProvider } from '../auth/AuthContext'
import { AuthLoading } from '../components/AuthLoading'
import { ButacaLogo } from '../components/ButacaLogo'
import { CameraIcon, GithubIcon, GoogleIcon } from '../components/icons'
import { SUPABASE_CONFIG_ERROR } from '../lib/supabase'
import '../styles/auth.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

type AuthMode = 'login' | 'register'

interface LoginLocationState {
  from?: {
    pathname?: string
    search?: string
    hash?: string
  }
}

export function LoginPage() {
  const {
    session,
    loading,
    pending,
    error,
    isConfigured,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    clearError,
  } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const state = location.state as LoginLocationState | null
  const redirectTo = state?.from
    ? `${state.from.pathname ?? '/'}${state.from.search ?? ''}${state.from.hash ?? ''}`
    : '/'

  if (loading) {
    return <AuthLoading />
  }

  if (session) {
    return <Navigate to={redirectTo} replace />
  }

  const displayedError =
    validationError ??
    error ??
    (isConfigured ? null : SUPABASE_CONFIG_ERROR)

  function switchMode(nextMode: AuthMode) {
    if (pending || nextMode === mode) {
      return
    }

    setMode(nextMode)
    setValidationError(null)
    setInfoMessage(null)
    setPassword('')
    setConfirmPassword('')
    clearError()
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pending) {
      return
    }

    setValidationError(null)
    setInfoMessage(null)
    clearError()

    const normalizedEmail = email.trim()
    const normalizedName = fullName.trim()

    if (mode === 'register' && !normalizedName) {
      setValidationError('Ingresa tu nombre completo.')
      return
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setValidationError('Ingresa un correo electrónico válido.')
      return
    }

    if (!password) {
      setValidationError('Ingresa tu contraseña.')
      return
    }

    if (mode === 'register') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setValidationError(
          `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        )
        return
      }

      if (!confirmPassword) {
        setValidationError('Confirma tu contraseña.')
        return
      }

      if (password !== confirmPassword) {
        setValidationError('Las contraseñas no coinciden.')
        return
      }

      const status = await signUpWithEmail(
        normalizedName,
        normalizedEmail,
        password,
      )

      if (status === 'confirmation_required') {
        setInfoMessage(
          'Cuenta creada. Revisa tu correo electrónico para confirmarla antes de iniciar sesión.',
        )
        setPassword('')
        setConfirmPassword('')
        setMode('login')
      }

      return
    }

    await signInWithEmail(normalizedEmail, password)
  }

  function handleOAuth(provider: OAuthProvider) {
    if (pending) {
      return
    }

    setValidationError(null)
    setInfoMessage(null)
    clearError()
    void signInWithOAuth(provider)
  }

  const formDisabled = !isConfigured || pending

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand-block">
          <ButacaLogo size="lg" subtitle="Tu butaca emocional" centered />
        </div>

        <header className="auth-header">
          <span className="eyebrow">
            {mode === 'login' ? 'Acceso seguro' : 'Nueva cuenta'}
          </span>
          <h1 id="auth-title">
            {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
          </h1>
          <p>
            {mode === 'login'
              ? 'Vuelve a tu butaca y descubre tu próxima historia.'
              : 'Guarda tus películas y emociones en un solo lugar.'}
          </p>
        </header>

        <div className="auth-tabs" role="group" aria-label="Modo de acceso">
          <button
            type="button"
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            aria-pressed={mode === 'login'}
            onClick={() => switchMode('login')}
            disabled={pending}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
            aria-pressed={mode === 'register'}
            onClick={() => switchMode('register')}
            disabled={pending}
          >
            Crear cuenta
          </button>
        </div>

        {displayedError && (
          <p className="form-error" role="alert">
            {displayedError}
          </p>
        )}

        {infoMessage && (
          <p className="form-success" role="status">
            {infoMessage}
          </p>
        )}

        <form className="auth-form" onSubmit={handleEmailSubmit} noValidate>
          {mode === 'register' && (
            <label className="field">
              <span>Nombre completo</span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
                disabled={formDisabled}
              />
            </label>
          )}

          <label className="field">
            <span>Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              required
              disabled={formDisabled}
            />
          </label>

          <label className="field">
            <span>
              {mode === 'register'
                ? `Contraseña (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`
                : 'Contraseña'}
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              required
              disabled={formDisabled}
            />
          </label>

          {mode === 'register' && (
            <label className="field">
              <span>Confirmar contraseña</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                disabled={formDisabled}
              />
            </label>
          )}

          <button
            type="submit"
            className="button button-full"
            disabled={formDisabled}
          >
            {pending
              ? 'Procesando...'
              : mode === 'login'
                ? 'Ingresar con correo'
                : 'Crear cuenta'}
          </button>
        </form>

        <div className="auth-divider">
          <span>{mode === 'login' ? 'o continúa con' : 'o regístrate con'}</span>
        </div>

        <div className="oauth-buttons">
          <button
            type="button"
            className="oauth-button oauth-google"
            onClick={() => handleOAuth('google')}
            disabled={formDisabled}
          >
            <GoogleIcon className="oauth-icon" />
            Continuar con Google
          </button>
          <button
            type="button"
            className="oauth-button oauth-github"
            onClick={() => handleOAuth('github')}
            disabled={formDisabled}
          >
            <GithubIcon className="oauth-icon" />
            Continuar con GitHub
          </button>
        </div>

        {mode === 'register' && (
          <p className="auth-note">
            Si Supabase requiere confirmación por correo, deberás confirmar la
            cuenta antes de iniciar sesión.
          </p>
        )}

        <footer className="auth-footer">
          <div className="auth-privacy">
            <span className="auth-privacy-icon">
              <CameraIcon />
            </span>
            <p>
              Privacidad y seguridad: la cámara se usa solo para la vista previa
              local. Butaca no guarda ni envía tu imagen.
            </p>
          </div>

          <p className="auth-note">
            El acceso con Google y GitHub requiere que los proveedores estén
            habilitados en Supabase y que la URL de callback esté autorizada.
          </p>
        </footer>
      </section>
    </main>
  )
}
