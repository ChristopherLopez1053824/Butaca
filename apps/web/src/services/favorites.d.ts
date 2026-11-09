export type FavoriteMediaType = 'MOVIE' | 'TV'

export interface Favorite {
  id: string
  tmdbId: number
  mediaType: FavoriteMediaType
  title: string
  posterPath: string | null
  releaseDate: string | null
  voteAverage: number | null
  createdAt: string
  updatedAt: string
}

export interface FavoritePagination {
  page: number
  limit: number
  total: number
}

export interface CreateFavoriteInput {
  tmdbId: number
  mediaType: FavoriteMediaType
  title: string
  posterPath?: string | null
  releaseDate?: string | null
  voteAverage?: number | null
}

export interface ListFavoritesParams {
  page?: number
  limit?: number
}

export interface ListFavoritesResult {
  data: Favorite[]
  pagination: FavoritePagination
}

export function listFavorites(
  params?: ListFavoritesParams,
): Promise<ListFavoritesResult>

export function createFavorite(input: CreateFavoriteInput): Promise<Favorite>

export function deleteFavorite(id: string): Promise<void>
