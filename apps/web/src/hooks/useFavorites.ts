import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError } from '../services/api'
import {
  createFavorite,
  deleteFavorite,
  listFavorites,
} from '../services/favorites'
import type { CreateFavoriteInput, Favorite } from '../services/favorites'

export type FavoritesStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export interface FavoritesState {
  status: FavoritesStatus
  favorites: Favorite[]
  error: string | null
}

export interface Favorites extends FavoritesState {
  reload: () => Promise<void>
  isFavorite: (tmdbId: number, mediaType: Favorite['mediaType']) => boolean
  isPending: (tmdbId: number, mediaType: Favorite['mediaType']) => boolean
  addFavorite: (input: CreateFavoriteInput) => Promise<void>
  removeFavorite: (
    tmdbId: number,
    mediaType: Favorite['mediaType'],
  ) => Promise<void>
}

const LIST_LIMIT = 100

function favoriteKey(tmdbId: number, mediaType: string): string {
  return `${mediaType}:${tmdbId}`
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error ? (error as ApiError).code : undefined
}

export function useFavorites(): Favorites {
  const [state, setState] = useState<FavoritesState>({
    status: 'idle',
    favorites: [],
    error: null,
  })
  const [pending, setPending] = useState<Set<string>>(new Set())
  const requestIdRef = useRef(0)

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setState((previous) => ({ ...previous, status: 'loading', error: null }))

    try {
      const result = await listFavorites({ limit: LIST_LIMIT })

      if (requestId !== requestIdRef.current) {
        return
      }

      setState({
        status: result.data.length > 0 ? 'ready' : 'empty',
        favorites: result.data,
        error: null,
      })
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return
      }

      setState({
        status: 'error',
        favorites: [],
        error: toMessage(error, 'No pudimos cargar tus favoritos.'),
      })
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const isFavorite = useCallback(
    (tmdbId: number, mediaType: Favorite['mediaType']) =>
      state.favorites.some(
        (favorite) =>
          favorite.tmdbId === tmdbId && favorite.mediaType === mediaType,
      ),
    [state.favorites],
  )

  const isPending = useCallback(
    (tmdbId: number, mediaType: Favorite['mediaType']) =>
      pending.has(favoriteKey(tmdbId, mediaType)),
    [pending],
  )

  const addFavorite = useCallback(
    async (input: CreateFavoriteInput) => {
      const key = favoriteKey(input.tmdbId, input.mediaType)

      if (pending.has(key) || isFavorite(input.tmdbId, input.mediaType)) {
        return
      }

      setPending((previous) => new Set(previous).add(key))

      try {
        const favorite = await createFavorite(input)

        setState((previous) => ({
          status: 'ready',
          favorites: [favorite, ...previous.favorites],
          error: null,
        }))
      } catch (error) {
        if (errorCode(error) === 'CONFLICT') {
          await reload()
          return
        }

        throw error
      } finally {
        setPending((previous) => {
          const next = new Set(previous)
          next.delete(key)
          return next
        })
      }
    },
    [pending, isFavorite, reload],
  )

  const removeFavorite = useCallback(
    async (tmdbId: number, mediaType: Favorite['mediaType']) => {
      const key = favoriteKey(tmdbId, mediaType)

      if (pending.has(key)) {
        return
      }

      const favorite = state.favorites.find(
        (item) => item.tmdbId === tmdbId && item.mediaType === mediaType,
      )

      if (!favorite) {
        return
      }

      setPending((previous) => new Set(previous).add(key))

      try {
        await deleteFavorite(favorite.id)

        setState((previous) => {
          const favorites = previous.favorites.filter(
            (item) => item.id !== favorite.id,
          )

          return {
            status: favorites.length > 0 ? 'ready' : 'empty',
            favorites,
            error: null,
          }
        })
      } catch (error) {
        if (errorCode(error) === 'NOT_FOUND') {
          await reload()
          return
        }

        throw error
      } finally {
        setPending((previous) => {
          const next = new Set(previous)
          next.delete(key)
          return next
        })
      }
    },
    [pending, state.favorites, reload],
  )

  return {
    ...state,
    reload,
    isFavorite,
    isPending,
    addFavorite,
    removeFavorite,
  }
}
