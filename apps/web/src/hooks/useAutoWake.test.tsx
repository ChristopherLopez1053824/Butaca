// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWakeStatus, triggerWake } from '../services/api'
import type { WakeStatusResponse } from '../services/api'
import { useAutoWake } from './useAutoWake'

vi.mock('../services/api', () => ({
  triggerWake: vi.fn(),
  getWakeStatus: vi.fn(),
}))

const mockedTriggerWake = vi.mocked(triggerWake)
const mockedGetWakeStatus = vi.mocked(getWakeStatus)

function snapshot(onlineCount: number): WakeStatusResponse {
  return {
    status: 'ok',
    data: {
      waking: onlineCount < 6,
      startedAt: '2026-11-10T00:00:00.000Z',
      onlineCount,
      total: 6,
      services: {
        users: { status: 'online', lastCheckedAt: '2026-11-10T00:00:00.000Z' },
        emotions: { status: 'online', lastCheckedAt: '2026-11-10T00:00:00.000Z' },
        movies: { status: 'online', lastCheckedAt: '2026-11-10T00:00:00.000Z' },
        favorites: { status: 'online', lastCheckedAt: '2026-11-10T00:00:00.000Z' },
        dashboard: { status: 'online', lastCheckedAt: '2026-11-10T00:00:00.000Z' },
        memes: { status: 'online', lastCheckedAt: '2026-11-10T00:00:00.000Z' },
      },
    },
  }
}

beforeEach(() => {
  mockedTriggerWake.mockReset()
  mockedGetWakeStatus.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutoWake', () => {
  it('llama a triggerWake una sola vez al montar y no sondea si ya está 6/6', async () => {
    mockedTriggerWake.mockResolvedValue(snapshot(6))

    const { result } = renderHook(() => useAutoWake())

    await waitFor(() => expect(result.current.snapshot?.onlineCount).toBe(6))
    expect(mockedTriggerWake).toHaveBeenCalledTimes(1)
    expect(mockedGetWakeStatus).not.toHaveBeenCalled()
  })

  it('sondea con GET hasta llegar a 6/6', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockedTriggerWake.mockResolvedValue(snapshot(2))
    mockedGetWakeStatus
      .mockResolvedValueOnce(snapshot(4))
      .mockResolvedValueOnce(snapshot(6))

    const { result } = renderHook(() => useAutoWake())

    await waitFor(() => expect(result.current.snapshot?.onlineCount).toBe(2))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await waitFor(() => expect(result.current.snapshot?.onlineCount).toBe(4))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await waitFor(() => expect(result.current.snapshot?.onlineCount).toBe(6))

    expect(mockedGetWakeStatus).toHaveBeenCalledTimes(2)
  });

  it('expone el error si triggerWake falla', async () => {
    mockedTriggerWake.mockRejectedValue(new Error('El Gateway no respondió'))

    const { result } = renderHook(() => useAutoWake())

    await waitFor(() => expect(result.current.error).toBe('El Gateway no respondió'))
  })

  it('retry vuelve a llamar a triggerWake', async () => {
    mockedTriggerWake.mockResolvedValue(snapshot(6))

    const { result } = renderHook(() => useAutoWake())

    await waitFor(() => expect(mockedTriggerWake).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.retry()
    })

    await waitFor(() => expect(mockedTriggerWake).toHaveBeenCalledTimes(2))
  })
})
