// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getVerseForEmotion, recordVerseHistory } from '../services/verses'
import type { BibleVerse } from '../services/verses'
import { useEmotionVerse } from './useEmotionVerse'

vi.mock('../services/verses', () => ({
  getVerseForEmotion: vi.fn(),
  recordVerseHistory: vi.fn(),
}))

const mockedGetVerse = vi.mocked(getVerseForEmotion)
const mockedRecordHistory = vi.mocked(recordVerseHistory)

const verse: BibleVerse = {
  provider: 'api.bible',
  translation: 'RVR1960',
  externalId: 'JHN.3.16',
  reference: 'Juan 3:16',
  theme: 'esperanza',
  text: 'Porque de tal manera amó Dios al mundo...',
  copyright: '© Sociedades Bíblicas Unidas',
}

function apiError(message: string, code: string) {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  return error
}

beforeEach(() => {
  mockedGetVerse.mockReset()
  mockedRecordHistory.mockReset()
  mockedRecordHistory.mockResolvedValue({
    id: 'history-1',
    emotionRecordId: null,
    provider: 'RVR1960',
    externalId: 'JHN.3.16',
    title: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  })
})

describe('useEmotionVerse', () => {
  it('se queda en idle si no hay emoción confirmada', () => {
    const { result } = renderHook(() => useEmotionVerse(null, null))

    expect(result.current.status).toBe('idle')
    expect(mockedGetVerse).not.toHaveBeenCalled()
  })

  it('carga el versículo real cuando hay una emoción confirmada', async () => {
    mockedGetVerse.mockResolvedValue(verse)

    const { result } = renderHook(() =>
      useEmotionVerse('HAPPY', 'emotion-1'),
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.verse).toEqual(verse)
    expect(mockedGetVerse).toHaveBeenCalledWith({ emotion: 'HAPPY' })
  });

  it('registra el historial una sola vez por emotionRecordId', async () => {
    mockedGetVerse.mockResolvedValue(verse)

    const { result, rerender } = renderHook(
      ({ emotion, id }: { emotion: string; id: string }) =>
        useEmotionVerse(emotion, id),
      { initialProps: { emotion: 'HAPPY', id: 'emotion-1' } },
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() => expect(mockedRecordHistory).toHaveBeenCalledTimes(1))
    expect(mockedRecordHistory).toHaveBeenCalledWith({
      provider: 'RVR1960',
      externalId: 'JHN.3.16',
      title: 'Juan 3:16 (RVR1960)',
      emotionRecordId: 'emotion-1',
    })

    rerender({ emotion: 'HAPPY', id: 'emotion-1' })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mockedRecordHistory).toHaveBeenCalledTimes(1)
  })

  it('marca not-configured cuando el backend responde SERVICE_NOT_CONFIGURED', async () => {
    mockedGetVerse.mockRejectedValue(
      apiError('Falta BIBLE_API_KEY', 'SERVICE_NOT_CONFIGURED'),
    )

    const { result } = renderHook(() =>
      useEmotionVerse('HAPPY', 'emotion-1'),
    )

    await waitFor(() => expect(result.current.status).toBe('not-configured'))
    expect(mockedRecordHistory).not.toHaveBeenCalled()
  })

  it('marca error genérico ante cualquier otro fallo', async () => {
    mockedGetVerse.mockRejectedValue(new Error('Movie... Meme Service no disponible'))

    const { result } = renderHook(() =>
      useEmotionVerse('HAPPY', 'emotion-1'),
    )

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Movie... Meme Service no disponible')
  })

  it('vuelve a idle si la emoción desaparece (nueva sesión)', async () => {
    mockedGetVerse.mockResolvedValue(verse)

    const { result, rerender } = renderHook(
      ({ emotion, id }: { emotion: string | null; id: string | null }) =>
        useEmotionVerse(emotion, id),
      { initialProps: { emotion: 'HAPPY' as string | null, id: 'emotion-1' as string | null } },
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ emotion: null, id: null })

    expect(result.current.status).toBe('idle')
    expect(result.current.verse).toBeNull()
  })
})
