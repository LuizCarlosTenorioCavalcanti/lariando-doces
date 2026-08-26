import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './dados/indexeddb'
import { salvarIngrediente, salvarReceita } from './dados/repositorio'
import App from './App.jsx'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

describe('App', () => {
  it('mostra o nome do app antes mesmo de os dados chegarem', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Lariando Doces', level: 1 })).toBeTruthy()
  })

  it('sem doce cadastrado, convida a cadastrar o primeiro', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/ainda não cadastrou nenhum doce/i)).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: /cadastrar meu primeiro doce/i })).toBeTruthy()
  })

  it('com doce cadastrado, não mostra mais o convite', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    await salvarReceita({
      nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
      itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
    })

    render(<App />)
    await waitFor(() => {
      expect(screen.queryByText(/ainda não cadastrou nenhum doce/i)).toBe(null)
    })
  })

  // Este é o teste que teria pego o bug de "Ingredientes" inalcançável: nada chamava
  // `setFolha('ingredientes')`, e sem um teste ligando cada botão do rodapé à folha certa
  // isso passou despercebido.
  it('cada link do rodapé abre a folha certa', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    await salvarReceita({
      nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
      itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
    })

    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Meus doces' })).toBeTruthy()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Meus doces' }))
    expect(screen.getByRole('heading', { name: 'Meus doces', level: 2 })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Ingredientes' }))
    expect(screen.getByRole('heading', { name: 'Ingredientes', level: 2 })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Histórico' }))
    expect(screen.getByRole('heading', { name: 'Histórico', level: 2 })).toBeTruthy()
  })
})
