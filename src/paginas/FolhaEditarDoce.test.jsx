import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from '../dados/indexeddb'
import { salvarIngrediente, listarReceitas, listarIngredientes } from '../dados/repositorio'
import { FolhaEditarDoce } from './FolhaEditarDoce'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

function montar(props = {}) {
  return render(
    <FolhaEditarDoce
      aberta
      receita={null}
      ingredientes={[]}
      aoFechar={() => {}}
      aoGravado={() => {}}
      {...props}
    />,
  )
}

describe('FolhaEditarDoce — cadastrar', () => {
  it('abre com um campo de ingrediente já em branco, para ela começar a digitar', () => {
    montar()
    expect(screen.getByLabelText('Ingrediente 1')).toBeTruthy()
  })

  it('acrescenta linha de ingrediente', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /ingrediente/i }))
    expect(screen.getByLabelText('Ingrediente 2')).toBeTruthy()
  })

  it('remove linha de ingrediente', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /ingrediente/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Tirar ingrediente 2' }))
    expect(screen.queryByLabelText('Ingrediente 2')).toBe(null)
  })

  it('reconhece ingrediente já cadastrado e mostra a unidade dele', async () => {
    const toddy = await salvarIngrediente(TODDY)
    montar({ ingredientes: [toddy] })

    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'toddy')
    await waitFor(() => expect(screen.getByText('(400 g — R$ 10,00)')).toBeTruthy())
    expect(screen.getByLabelText('Quantidade 1')).toBeTruthy()
    expect(screen.getAllByText('g').length).toBeGreaterThan(0)
  })

  it('grava a receita com nome, rendimento, margem e itens', async () => {
    const toddy = await salvarIngrediente(TODDY)
    const aoGravado = vi.fn()
    montar({ ingredientes: [toddy], aoGravado })

    await userEvent.type(screen.getByLabelText('Nome do doce'), 'Brigadeiro')
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '50')
    await userEvent.type(screen.getByLabelText(/margem/i), '200')
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Toddy')
    await userEvent.type(screen.getByLabelText('Quantidade 1'), '80')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))

    await waitFor(() => expect(aoGravado).toHaveBeenCalled())
    const receitas = await listarReceitas()
    expect(receitas).toHaveLength(1)
    expect(receitas[0].nome).toBe('Brigadeiro')
    expect(receitas[0].rendimentoBase).toBe(50)
    expect(receitas[0].margemPct).toBe(200)
    expect(receitas[0].itens).toEqual([{ ingredienteId: toddy.id, quantidade: 80 }])
  })

  it('aceita quantidade com vírgula', async () => {
    const toddy = await salvarIngrediente(TODDY)
    montar({ ingredientes: [toddy] })

    await userEvent.type(screen.getByLabelText('Nome do doce'), 'Bolo')
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '12')
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Toddy')
    await userEvent.type(screen.getByLabelText('Quantidade 1'), '12,5')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))

    await waitFor(async () => {
      const receitas = await listarReceitas()
      expect(receitas[0]?.itens).toEqual([{ ingredienteId: toddy.id, quantidade: 12.5 }])
    })
  })

  it('ignora linha em branco em vez de reclamar dela', async () => {
    const toddy = await salvarIngrediente(TODDY)
    montar({ ingredientes: [toddy] })

    await userEvent.type(screen.getByLabelText('Nome do doce'), 'Bolo')
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '12')
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Toddy')
    await userEvent.type(screen.getByLabelText('Quantidade 1'), '80')
    await userEvent.click(screen.getByRole('button', { name: /ingrediente/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))

    await waitFor(async () => {
      const receitas = await listarReceitas()
      expect(receitas[0]?.itens).toHaveLength(1)
    })
  })

  it('mostra o erro do repositório em vez de fechar calado', async () => {
    montar()
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '50')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/nome/i))
  })
})

describe('FolhaEditarDoce — cadastro embutido de ingrediente', () => {
  it('nome que não existe oferece cadastrar ali mesmo', async () => {
    montar()
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Chocolate')
    expect(screen.getByRole('button', { name: /cadastrar "Chocolate"/i })).toBeTruthy()
  })

  it('nome que já existe NÃO oferece cadastrar de novo', async () => {
    const toddy = await salvarIngrediente(TODDY)
    montar({ ingredientes: [toddy] })
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Toddy')
    expect(screen.queryByRole('button', { name: /cadastrar "/i })).toBe(null)
  })

  it('cadastra o ingrediente sem sair da folha e já usa ele na linha', async () => {
    montar()
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Chocolate')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Chocolate"/i }))

    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'g')
    await userEvent.type(screen.getByLabelText(/quanto vem na embalagem/i), '200')
    await userEvent.type(screen.getByLabelText(/preço da embalagem/i), '8,00')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))

    await waitFor(() => expect(screen.getByText('(200 g — R$ 8,00)')).toBeTruthy())

    const salvos = await listarIngredientes()
    expect(salvos).toHaveLength(1)
    expect(salvos[0].nome).toBe('Chocolate')
    expect(salvos[0].embalagemPrecoCent).toBe(800)
  })

  it('deixa cadastrar ingrediente sem preço ainda', async () => {
    montar()
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Chocolate')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Chocolate"/i }))
    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'g')
    await userEvent.type(screen.getByLabelText(/quanto vem na embalagem/i), '200')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))

    await waitFor(async () => {
      const salvos = await listarIngredientes()
      expect(salvos[0]?.embalagemPrecoCent).toBe(null)
    })
  })

  it('erro no cadastro embutido aparece dentro do próprio bloco', async () => {
    montar()
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Chocolate')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Chocolate"/i }))
    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'g')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/embalagem/i))
    expect(await listarIngredientes()).toEqual([])
  })

  it('quando a prop chega mais fresca, ela vence o estado local do cadastro embutido', async () => {
    const { rerender } = montar()
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Chocolate')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Chocolate"/i }))
    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'g')
    await userEvent.type(screen.getByLabelText(/quanto vem na embalagem/i), '200')
    await userEvent.type(screen.getByLabelText(/preço da embalagem/i), '8,00')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))

    await waitFor(() => expect(screen.getByText('(200 g — R$ 8,00)')).toBeTruthy())

    const [chocolate] = await listarIngredientes()

    // Não é a gravação de verdade que está em jogo aqui — é a ORDEM do merge. Monta a prop
    // na mão, com o mesmo id/nomeNormalizado mas preço diferente, como se o pai tivesse
    // recarregado e essa fosse agora a verdade vinda do banco.
    rerender(
      <FolhaEditarDoce
        aberta
        receita={null}
        ingredientes={[{ ...chocolate, embalagemPrecoCent: 500 }]}
        aoFechar={() => {}}
        aoGravado={() => {}}
      />,
    )

    expect(screen.getByText('(200 g — R$ 5,00)')).toBeTruthy()
    expect(screen.queryByText('(200 g — R$ 8,00)')).toBe(null)
  })
})

describe('FolhaEditarDoce — editar', () => {
  it('abre com os campos preenchidos', async () => {
    const toddy = await salvarIngrediente(TODDY)
    const receita = {
      id: 'rec_1', nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
      itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
    }
    montar({ receita, ingredientes: [toddy] })

    expect(screen.getByLabelText('Nome do doce').value).toBe('Brigadeiro')
    expect(screen.getByLabelText(/rende quantos/i).value).toBe('50')
    expect(screen.getByLabelText(/margem/i).value).toBe('200')
    expect(screen.getByLabelText('Ingrediente 1').value).toBe('Toddy')
    expect(screen.getByLabelText('Quantidade 1').value).toBe('80')
  })
})
