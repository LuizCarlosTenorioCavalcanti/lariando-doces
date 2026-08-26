import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampoNumero } from './CampoNumero'
import { CampoMoeda } from './CampoMoeda'

describe('CampoNumero', () => {
  it('mostra o rótulo ligado ao campo', () => {
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={() => {}} />)
    expect(screen.getByLabelText('Quantidade')).toBeTruthy()
  })

  it('abre o teclado numérico no celular', () => {
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={() => {}} />)
    expect(screen.getByLabelText('Quantidade').getAttribute('inputMode')).toBe('decimal')
  })

  it('é campo de texto, não number — senão a vírgula some no meio da digitação', () => {
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={() => {}} />)
    expect(screen.getByLabelText('Quantidade').getAttribute('type')).toBe('text')
  })

  it('avisa a cada tecla, com o texto cru', async () => {
    const aoMudar = vi.fn()
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={aoMudar} />)
    await userEvent.type(screen.getByLabelText('Quantidade'), '8')
    expect(aoMudar).toHaveBeenCalledWith('8')
  })

  it('deixa digitar vírgula sem reclamar', async () => {
    const aoMudar = vi.fn()
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="8" aoMudar={aoMudar} />)
    await userEvent.type(screen.getByLabelText('Quantidade'), ',')
    expect(aoMudar).toHaveBeenCalledWith('8,')
  })

  it('mostra sufixo e dica', () => {
    render(
      <CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={() => {}}
        sufixo="g" dica="quanto entrou na panela" />,
    )
    expect(screen.getByText('g')).toBeTruthy()
    expect(screen.getByText('quanto entrou na panela')).toBeTruthy()
  })
})

describe('CampoMoeda', () => {
  it('mostra R$ na frente', () => {
    render(<CampoMoeda id="preco" rotulo="Preço" valor="" aoMudar={() => {}} />)
    expect(screen.getByText('R$')).toBeTruthy()
    expect(screen.getByLabelText('Preço').getAttribute('inputMode')).toBe('decimal')
  })
})
