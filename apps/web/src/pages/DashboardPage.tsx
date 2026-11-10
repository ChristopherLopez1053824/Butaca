import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { BibleVerseSection } from '../components/BibleVerseSection'
import { CameraSection } from '../components/CameraSection'
import { DashboardHeader } from '../components/DashboardHeader'
import { EmotionDashboard } from '../components/EmotionDashboard'
import { FavoritesSection } from '../components/FavoritesSection'
import { RecommendationsSection } from '../components/RecommendationsSection'
import type { RecommendationsStatus } from '../components/RecommendationsSection'
import { ServiceStatusPanel } from '../components/ServiceStatusPanel'
import { useEmotionFlow } from '../hooks/useEmotionFlow'
import type { EmotionFlowStatus } from '../hooks/useEmotionFlow'
import { useEmotionVerse } from '../hooks/useEmotionVerse'
import { useFavorites } from '../hooks/useFavorites'
import { getApiEmotionLabel } from '../lib/emotionContract'
import type { EmotionSaveStatus } from '../lib/emotions'
import type { Recommendation } from '../services/recommendations'
import type { Favorite } from '../services/favorites'
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
  const favorites = useFavorites()
  const [favoriteError, setFavoriteError] = useState<string | null>(null)
  const emotionVerse = useEmotionVerse(
    emotionFlow.emotionRecord?.emotion ?? null,
    emotionFlow.emotionRecord?.id ?? null,
  )
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

  async function handleToggleFavorite(recommendation: Recommendation) {
    setFavoriteError(null)

    try {
      if (
        favorites.isFavorite(recommendation.tmdbId, recommendation.mediaType)
      ) {
        await favorites.removeFavorite(
          recommendation.tmdbId,
          recommendation.mediaType,
        )
        return
      }

      await favorites.addFavorite({
        tmdbId: recommendation.tmdbId,
        mediaType: recommendation.mediaType,
        title: recommendation.title,
        posterPath: recommendation.posterPath,
        releaseDate: recommendation.releaseDate,
        voteAverage: recommendation.voteAverage,
      })
    } catch (error) {
      setFavoriteError(
        error instanceof Error && error.message
          ? error.message
          : 'No pudimos actualizar tus favoritos. Inténtalo de nuevo.',
      )
    }
  }

  async function handleRemoveFavorite(favorite: Favorite) {
    setFavoriteError(null)

    try {
      await favorites.removeFavorite(favorite.tmdbId, favorite.mediaType)
    } catch (error) {
      setFavoriteError(
        error instanceof Error && error.message
          ? error.message
          : 'No pudimos actualizar tus favoritos. Inténtalo de nuevo.',
      )
    }
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
          pagination={emotionFlow.pagination}
          emotionLabel={emotionLabel}
          error={recommendationsError}
          onRetry={() => {
            void emotionFlow.retryRecommendations()
          }}
          loadMoreStatus={emotionFlow.loadMoreStatus}
          loadMoreError={emotionFlow.loadMoreError?.message ?? null}
          onLoadMore={() => {
            void emotionFlow.loadMoreRecommendations()
          }}
          isFavorite={favorites.isFavorite}
          isFavoritePending={favorites.isPending}
          onToggleFavorite={handleToggleFavorite}
        />
        {favoriteError && (
          <p className="form-error dashboard-favorite-error" role="alert">
            {favoriteError}
          </p>
        )}
        <BibleVerseSection
          status={emotionVerse.status}
          verse={emotionVerse.verse}
          error={emotionVerse.error}
          onRetry={emotionVerse.reload}
        />

        <div className="dashboard-lower">
          <FavoritesSection
            status={favorites.status}
            favorites={favorites.favorites}
            error={favorites.error}
            isRemoving={favorites.isPending}
            onRemove={handleRemoveFavorite}
            onRetry={() => {
              void favorites.reload()
            }}
          />
          <EmotionDashboard />
        </div>
      </div>

      <ServiceStatusPanel />
    </main>
  )
}
