// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmotionDetectionState } from '../hooks/useEmotionDetection'
import { CameraSection } from './CameraSection'

vi.mock('../hooks/useEmotionDetection', () => ({
  useEmotionDetection: vi.fn(),
}))

const { useEmotionDetection } = await import('../hooks/useEmotionDetection')
const mockedUseEmotionDetection = vi.mocked(useEmotionDetection)

const IDLE_DETECTION: EmotionDetectionState = {
  modelStatus: 'ready',
  status: 'detecting',
  detected: null,
  error: null,
}

const DETECTED_HAPPY: EmotionDetectionState = {
  modelStatus: 'ready',
  status: 'detected',
  detected: { emotion: 'happy', expression: 'happy', confidence: 0.87 },
  error: null,
}

function mockCamera() {
  const stream = { getTracks: () => [] } as unknown as MediaStream
  const getUserMedia = vi.fn().mockResolvedValue(stream)

  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })

  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(
    undefined,
  )

  return getUserMedia
}

async function activateCamera() {
  fireEvent.click(screen.getByRole('button', { name: 'Activar cámara' }))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar y activar' }))
  })
}

beforeEach(() => {
  mockedUseEmotionDetection.mockReturnValue(IDLE_DETECTION)
  mockCamera()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CameraSection', () => {
  it('detecta una emoción y, al pulsar "Usar emoción detectada", confirma de inmediato con fuente CAMERA', async () => {
    mockedUseEmotionDetection.mockReturnValue(DETECTED_HAPPY)
    const onEmotionConfirmed = vi.fn()

    render(
      <CameraSection
        onEmotionConfirmed={onEmotionConfirmed}
        saveStatus="idle"
        saveError={null}
      />,
    )

    await activateCamera()

    fireEvent.click(
      screen.getByRole('button', { name: 'Usar emoción detectada' }),
    )

    expect(onEmotionConfirmed).toHaveBeenCalledTimes(1)
    expect(onEmotionConfirmed).toHaveBeenCalledWith({
      emotion: 'happy',
      source: 'CAMERA',
      confidence: 0.87,
    })
    expect(
      screen.getByText('Emoción detectada seleccionada'),
    ).toBeTruthy()
  })

  it('no vuelve a confirmar la emoción de cámara mientras ya se está guardando', async () => {
    mockedUseEmotionDetection.mockReturnValue(DETECTED_HAPPY)
    const onEmotionConfirmed = vi.fn()

    render(
      <CameraSection
        onEmotionConfirmed={onEmotionConfirmed}
        saveStatus="saving"
        saveError={null}
      />,
    )

    await activateCamera()

    fireEvent.click(
      screen.getByRole('button', { name: 'Usar emoción detectada' }),
    )

    expect(onEmotionConfirmed).not.toHaveBeenCalled()
  })

  it('permite seleccionar y confirmar manualmente una emoción con fuente MANUAL', async () => {
    const onEmotionConfirmed = vi.fn()

    render(
      <CameraSection
        onEmotionConfirmed={onEmotionConfirmed}
        saveStatus="idle"
        saveError={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Felicidad' }))

    const confirmButton = screen.getByRole('button', {
      name: 'Confirmar emoción',
    }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(false)

    fireEvent.click(confirmButton)

    expect(onEmotionConfirmed).toHaveBeenCalledTimes(1)
    expect(onEmotionConfirmed).toHaveBeenCalledWith({
      emotion: 'happy',
      source: 'MANUAL',
    })
  })

  it('muestra el error de guardado y permite reintentar la confirmación', async () => {
    mockedUseEmotionDetection.mockReturnValue(DETECTED_HAPPY)
    const onEmotionConfirmed = vi.fn()

    render(
      <CameraSection
        onEmotionConfirmed={onEmotionConfirmed}
        saveStatus="error"
        saveError="No pudimos guardar tu emoción. Inténtalo de nuevo."
      />,
    )

    await activateCamera()

    fireEvent.click(
      screen.getByRole('button', { name: 'Usar emoción detectada' }),
    )

    expect(onEmotionConfirmed).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert').textContent).toContain(
      'No pudimos guardar tu emoción. Inténtalo de nuevo.',
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar emoción' }),
    )

    expect(onEmotionConfirmed).toHaveBeenCalledTimes(2)
  })
})
