import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from '../dados/indexeddb'
import { salvarIngrediente, salvarReceita, listarIngredientes } from '../dados/repositorio'
import { FolhaIngredientes } from './FolhaIngredientes'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

function montar(ingredientes, props = {}) {
  return render(
    <FolhaIngredientes
      aberta
      ingredientes={ingredientes}
      aoFechar={() => {}}
      aoGravado={() => {}}
      {...props}
    />,
  )
}

describe('FolhaIngredientes', () => {
  it('lista com o preço cheio da embalagem', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    montar([toddy])
    expect(screen.getByText('Toddy')).toBeTruthy()
    expect(screen.getByText(/400 g — R\$ 10,00/)).toBeTruthy()
  })

  it('mostra os mais desatualizados primeiro — é a pergunta que ela faz aqui', () => {
    const velho = {
      id: 'a', nome: 'Manteiga', unidade: 'g', embalagemQtd: 500,
      embalagemPrecoCent: 1200, atualizadoEm: '2026-01-10',
    }
    const novo = {
      id: 'b', nome: 'Toddy', unidade: 'g', embalagemQtd: 400,
      embalagemPrecoCent: 1000, atualizadoEm: '2026-08-20',
    }
    montar([novo, velho])
    const nomes = screen.getAllByTestId('ingrediente-nome').map((n) => n.textContent)
    expect(nomes).toEqual(['Manteiga', 'Toddy'])
  })

  it('avisa quando falta preço, em vez de mostrar R$ 0,00', async () => {
    const sem = await salvarIngrediente({
      nome: 'Chocolate', unidade: 'g', embalagemQtd: 200, embalagemPrecoCent: null,
    })
    montar([sem])
    expect(screen.getByText(/sem preço/i)).toBeTruthy()
  })

  it('edita o preço e grava', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    const aoGravado = vi.fn()
    montar([toddy], { aoGravado })

    await userEvent.click(screen.getByRole('button', { name: /Toddy/ }))
    const campo = screen.getByLabelText(/preço da embalagem/i)
    await userEvent.clear(campo)
    await userEvent.type(campo, '12,50')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar preço' }))

    await waitFor(() => expect(aoGravado).toHaveBeenCalled())
    const salvos = await listarIngredientes()
    expect(salvos[0].embalagemPrecoCent).toBe(1250)
  })

  it('apaga ingrediente que não está em receita nenhuma', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    montar([toddy])
    await userEvent.click(screen.getByRole('button', { name: /Toddy/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }))

    await waitFor(async () => expect(await listarIngredientes()).toEqual([]))
  })

  it('recusa apagar ingrediente em uso e diz em qual doce ele está', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    await salvarReceita({
      nome: 'Brigadeiro', rendimentoBase: 50, itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
    })
    montar([toddy])

    await userEvent.click(screen.getByRole('button', { name: /Toddy/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent', expect.stringMatching(/Brigadeiro/),
    )
    expect(await listarIngredientes()).toHaveLength(1)
  })
})
