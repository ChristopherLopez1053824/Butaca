export interface EmotionTimelinePoint {
  date: string
  emotion: string
  count: number
}

export interface RecommendationByEmotion {
  emotion: string
  mediaType: 'MOVIE' | 'TV'
  count: number
}

export interface DashboardSummary {
  emotionTimeline: EmotionTimelinePoint[]
  recommendationsByEmotion: RecommendationByEmotion[]
  favoritesCount: number
  unavailable: string[]
}

export interface DashboardSummaryParams {
  from?: string
  to?: string
}

export function getDashboardSummary(
  params?: DashboardSummaryParams,
): Promise<DashboardSummary>
