import { useAuth } from '../auth/AuthContext'
import { CameraSection } from '../components/CameraSection'
import { DashboardHeader } from '../components/DashboardHeader'
import { EmotionDashboard } from '../components/EmotionDashboard'
import { FavoritesSection } from '../components/FavoritesSection'
import { RecommendationsSection } from '../components/RecommendationsSection'
import type { RecommendationsStatus } from '../components/RecommendationsSection'
import { ServiceStatusPanel } from '../components/ServiceStatusPanel'
import { useEmotionFlow } from '../hooks/useEmotionFlow'
import type { EmotionFlowStatus } from '../hooks/useEmotionFlow'
import { getApiEmotionLabel } from '../lib/emotionContract'
import type { EmotionSaveStatus } from '../lib/emotions'
import '../styles/cards.css'
import '../styles/dashboard.css'

function getSaveStatus(
  status: EmotionFlowStatus,
  hasEmotionRecord: boolean,
): EmotionSaveStatus {
  if (status === 'saving-emotion') {
    return 'saving'
  }

  if (hasEmotionRecord) {
    return 'saved'
  }

  return status === 'error-saving-emotion' ? 'error' : 'idle'
}

function getRecommendationsStatus(
  status: EmotionFlowStatus,
): RecommendationsStatus {
  if (status === 'loading-recommendations') {
    return 'loading'
  }

  if (status === 'ready' || status === 'empty') {
    return status
  }

  return status === 'error-loading-recommendations' ? 'error' : 'idle'
}

export function DashboardPage() {
  const {
    user,
    pending: authPending,
    error: authError,
    signOut,
    clearError,
  } = useAuth()
  const emotionFlow = useEmotionFlow()
  const saveStatus = getSaveStatus(
    emotionFlow.status,
    emotionFlow.emotionRecord !== null,
  )
  const recommendationsStatus = getRecommendationsStatus(emotionFlow.status)
  const emotionLabel = emotionFlow.emotionRecord
    ? getApiEmotionLabel(emotionFlow.emotionRecord.emotion)
    : null
  const saveError =
    emotionFlow.status === 'error-saving-emotion'
      ? emotionFlow.error?.message ?? null
      : null
  const recommendationsError =
    emotionFlow.status === 'error-loading-recommendations'
      ? emotionFlow.error?.message ?? null
      : null

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
        <CameraSection
          onEmotionConfirmed={emotionFlow.confirmEmotion}
          saveStatus={saveStatus}
          saveError={saveError}
        />
        <RecommendationsSection
          status={recommendationsStatus}
          recommendations={emotionFlow.recommendations}
          emotionLabel={emotionLabel}
          error={recommendationsError}
          onRetry={() => {
            void emotionFlow.retryRecommendations()
          }}
        />

        <div className="dashboard-lower">
          <FavoritesSection />
          <EmotionDashboard />
        </div>
      </div>

      <ServiceStatusPanel />
    </main>
  )
}
