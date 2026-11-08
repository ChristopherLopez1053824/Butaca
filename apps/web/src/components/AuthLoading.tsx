import '../styles/auth.css'
import { ButacaLogo } from './ButacaLogo'

interface AuthLoadingProps {
  message?: string
}

export function AuthLoading({
  message = 'Comprobando sesión...',
}: AuthLoadingProps) {
  return (
    <main className="auth-page auth-page-centered">
      <section className="auth-loading">
        <ButacaLogo centered subtitle="Tu butaca emocional" />
        <span className="auth-loader" aria-hidden="true" />
        <p role="status">{message}</p>
      </section>
    </main>
  )
}
