import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ParaquedasDeErro } from './ParaquedasDeErro'

function Bomba() {
  throw new Error('quebrou de propósito')
}

describe('ParaquedasDeErro', () => {
  it('mostra saída calma em vez de tela branca quando um filho quebra no render', () => {
    // React (e o próprio ErrorBoundary) barulham no console quando um filho lança — é
    // ruído esperado deste teste, não sinal de suíte suja.
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ParaquedasDeErro>
        <Bomba />
      </ParaquedasDeErro>,
    )

    expect(screen.getByText(/algo deu errado/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeTruthy()

    espiao.mockRestore()
  })

  it('sem erro, mostra o filho normalmente', () => {
    render(
      <ParaquedasDeErro>
        <p>tudo bem</p>
      </ParaquedasDeErro>,
    )
    expect(screen.getByText('tudo bem')).toBeTruthy()
  })
})
