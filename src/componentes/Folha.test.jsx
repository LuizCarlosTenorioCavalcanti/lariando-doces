import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Folha } from './Folha'

describe('Folha', () => {
  it('fechada não desenha nada', () => {
    render(<Folha aberta={false} titulo="Meus doces" aoFechar={() => {}}>conteúdo</Folha>)
    expect(screen.queryByText('conteúdo')).toBe(null)
  })

  it('aberta mostra título e conteúdo', () => {
    render(<Folha aberta titulo="Meus doces" aoFechar={() => {}}>conteúdo</Folha>)
    expect(screen.getByRole('heading', { name: 'Meus doces' })).toBeTruthy()
    expect(screen.getByText('conteúdo')).toBeTruthy()
  })

  it('se anuncia como diálogo para quem usa leitor de tela', () => {
    render(<Folha aberta titulo="Meus doces" aoFechar={() => {}}>conteúdo</Folha>)
    const dialogo = screen.getByRole('dialog')
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
    expect(dialogo.getAttribute('aria-label')).toBe('Meus doces')
  })

  it('o botão fechar avisa', async () => {
    const aoFechar = vi.fn()
    render(<Folha aberta titulo="X" aoFechar={aoFechar}>c</Folha>)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('tocar fora fecha', async () => {
    const aoFechar = vi.fn()
    render(<Folha aberta titulo="X" aoFechar={aoFechar}>c</Folha>)
    await userEvent.click(screen.getByTestId('folha-fundo'))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('tocar DENTRO não fecha — senão preencher um campo fecharia a folha', async () => {
    const aoFechar = vi.fn()
    render(<Folha aberta titulo="X" aoFechar={aoFechar}><span>dentro</span></Folha>)
    await userEvent.click(screen.getByText('dentro'))
    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('Escape fecha', async () => {
    const aoFechar = vi.fn()
    render(<Folha aberta titulo="X" aoFechar={aoFechar}>c</Folha>)
    await userEvent.keyboard('{Escape}')
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })
})
