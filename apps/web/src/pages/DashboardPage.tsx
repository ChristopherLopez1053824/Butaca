import { useAuth } from '../auth/AuthContext'
import { CameraSection } from '../components/CameraSection'
import { DashboardHeader } from '../components/DashboardHeader'
import { EmotionDashboard } from '../components/EmotionDashboard'
import { FavoritesSection } from '../components/FavoritesSection'
import { RecommendationsSection } from '../components/RecommendationsSection'
import { ServiceStatusPanel } from '../components/ServiceStatusPanel'
import '../styles/cards.css'
import '../styles/dashboard.css'

export function DashboardPage() {
  const {
    user,
    pending: authPending,
    error: authError,
    signOut,
    clearError,
  } = useAuth()

  function handleSignOut() {
    clearError()
    void signOut()
  }

  return (
    <main className="dashboard-shell">
      <h1 className="sr-only">Butaca 🎬</h1>

      <DashboardHeader
        user={user}
        pending={authPending}
        onSignOut={handleSignOut}
      />

      {authError && (
        <p className="form-error" role="alert">
          {authError}
        </p>
      )}

      <div className="dashboard-content">
        <CameraSection />
        <RecommendationsSection />

        <div className="dashboard-lower">
          <FavoritesSection />
          <EmotionDashboard />
        </div>
      </div>

      <ServiceStatusPanel />
    </main>
  )
}
