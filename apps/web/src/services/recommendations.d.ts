export type RecommendationMediaType = 'MOVIE' | 'TV'

export interface Recommendation {
  id: string
  tmdbId: number
  mediaType: RecommendationMediaType
  title: string
  overview: string | null
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string | null
  voteAverage: number | null
  position: number | null
  createdAt: string
}

export interface RecommendationPagination {
  limit: number
  returned: number
  movieCount: number
  tvCount: number
  hasMore: boolean
  nextCursor: string | null
}

export interface RecommendationRequest {
  emotionRecordId: string
  cursor?: string
}

export interface RecommendationResult {
  data: Recommendation[]
  pagination: RecommendationPagination
}

export function requestRecommendations(
  request: RecommendationRequest,
): Promise<RecommendationResult>
