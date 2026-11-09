// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFavorite,
  deleteFavorite,
  listFavorites,
} from '../services/favorites'
import type { Favorite } from '../services/favorites'
import { useFavorites } from './useFavorites'

vi.mock('../services/favorites', () => ({
  listFavorites: vi.fn(),
  createFavorite: vi.fn(),
  deleteFavorite: vi.fn(),
}))

const mockedListFavorites = vi.mocked(listFavorites)
const mockedCreateFavorite = vi.mocked(createFavorite)
const mockedDeleteFavorite = vi.mocked(deleteFavorite)

const favorite: Favorite = {
  id: 'favorite-1',
  tmdbId: 550,
  mediaType: 'MOVIE',
  title: 'Fight Club',
  posterPath: '/poster.jpg',
  releaseDate: '1999-10-15',
  voteAverage: 8.4,
  createdAt: '2026-11-08T20:00:00.000Z',
  updatedAt: '2026-11-08T20:00:00.000Z',
}

function apiError(message: string, code: string) {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  return error
}

beforeEach(() => {
  mockedListFavorites.mockReset()
  mockedCreateFavorite.mockReset()
  mockedDeleteFavorite.mockReset()
})

describe('useFavorites', () => {
  it('carga los favoritos al montar y marca empty si no hay ninguno', async () => {
    mockedListFavorites.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, total: 0 },
    })

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => expect(result.current.status).toBe('empty'))
    expect(result.current.favorites).toEqual([])
  })

  it('carga favoritos existentes y responde isFavorite correctamente', async () => {
    mockedListFavorites.mockResolvedValue({
      data: [favorite],
      pagination: { page: 1, limit: 100, total: 1 },
    })

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.isFavorite(550, 'MOVIE')).toBe(true)
    expect(result.current.isFavorite(999, 'MOVIE')).toBe(false)
  })

  it('marca error si falla la carga', async () => {
    mockedListFavorites.mockRejectedValue(new Error('Favorites Service no disponible'))

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Favorites Service no disponible')
  })

  it('agrega un favorito nuevo y lo refleja en isFavorite', async () => {
    mockedListFavorites.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, total: 0 },
    })
    mockedCreateFavorite.mockResolvedValue(favorite)

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.status).toBe('empty'))

    await act(async () => {
      await result.current.addFavorite({
        tmdbId: 550,
        mediaType: 'MOVIE',
        title: 'Fight Club',
        posterPath: '/poster.jpg',
        releaseDate: '1999-10-15',
        voteAverage: 8.4,
      })
    })

    expect(mockedCreateFavorite).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('ready')
    expect(result.current.isFavorite(550, 'MOVIE')).toBe(true)
  })

  it('no duplica la solicitud si el favorito ya existe', async () => {
    mockedListFavorites.mockResolvedValue({
      data: [favorite],
      pagination: { page: 1, limit: 100, total: 1 },
    })

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await result.current.addFavorite({
        tmdbId: 550,
        mediaType: 'MOVIE',
        title: 'Fight Club',
      })
    })

    expect(mockedCreateFavorite).not.toHaveBeenCalled()
  })

  it('elimina un favorito existente', async () => {
    mockedListFavorites.mockResolvedValue({
      data: [favorite],
      pagination: { page: 1, limit: 100, total: 1 },
    })
    mockedDeleteFavorite.mockResolvedValue(undefined)

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await result.current.removeFavorite(550, 'MOVIE')
    })

    expect(mockedDeleteFavorite).toHaveBeenCalledWith('favorite-1')
    expect(result.current.status).toBe('empty')
    expect(result.current.isFavorite(550, 'MOVIE')).toBe(false)
  })

  it('recarga la lista si el servidor responde CONFLICT al agregar', async () => {
    mockedListFavorites
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, limit: 100, total: 0 },
      })
      .mockResolvedValueOnce({
        data: [favorite],
        pagination: { page: 1, limit: 100, total: 1 },
      })
    mockedCreateFavorite.mockRejectedValue(apiError('Ya existe', 'CONFLICT'))

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.status).toBe('empty'))

    await act(async () => {
      await result.current.addFavorite({
        tmdbId: 550,
        mediaType: 'MOVIE',
        title: 'Fight Club',
      })
    })

    expect(mockedListFavorites).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ready')
  })
})
