// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BibleVerse } from '../services/verses'
import { BibleVerseSection } from './BibleVerseSection'

const verse: BibleVerse = {
  provider: 'api.bible',
  translation: 'RVR1960',
  externalId: 'JHN.3.16',
  reference: 'Juan 3:16',
  theme: 'esperanza',
  text: 'Porque de tal manera amó Dios al mundo...',
  copyright: '© Sociedades Bíblicas Unidas',
}

const noop = () => undefined

afterEach(cleanup)

describe('BibleVerseSection', () => {
  it('muestra una invitación en estado idle', () => {
    render(
      <BibleVerseSection status="idle" verse={null} error={null} onRetry={noop} />,
    )

    expect(
      screen.getByText('Todavía no hay un versículo para mostrar'),
    ).toBeTruthy()
  })

  it('muestra el versículo real, su referencia, traducción y la atribución', () => {
    render(
      <BibleVerseSection
        status="ready"
        verse={verse}
        error={null}
        onRetry={noop}
      />,
    )

    expect(
      screen.getByText('“Porque de tal manera amó Dios al mundo...”'),
    ).toBeTruthy()
    expect(screen.getByText('Juan 3:16 (RVR1960)')).toBeTruthy()
    expect(screen.getByText('© Sociedades Bíblicas Unidas')).toBeTruthy()
  })

  it('muestra un estado amigable cuando el servicio no está configurado', () => {
    render(
      <BibleVerseSection
        status="not-configured"
        verse={null}
        error={null}
        onRetry={noop}
      />,
    )

    expect(
      screen.getByText('Esta función todavía no está disponible'),
    ).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('muestra el error real y permite reintentar', () => {
    const onRetry = vi.fn()

    render(
      <BibleVerseSection
        status="error"
        verse={null}
        error="Meme Service no disponible"
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain(
      'Meme Service no disponible',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
