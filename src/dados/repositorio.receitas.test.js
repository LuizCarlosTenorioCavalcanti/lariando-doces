import { describe, it, expect, beforeEach } from 'vitest'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './indexeddb'
import {
  salvarIngrediente, apagarIngrediente,
  listarReceitas, salvarReceita, apagarReceita,
} from './repositorio'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

async function comBrigadeiro() {
  const toddy = await salvarIngrediente(TODDY)
  const receita = await salvarReceita({
    nome: 'Brigadeiro',
    rendimentoBase: 50,
    margemPct: 200,
    itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
  })
  return { toddy, receita }
}

describe('receitas', () => {
  it('salva e lê de volta com os itens', async () => {
    const { toddy, receita } = await comBrigadeiro()
    expect(receita.id).toMatch(/^rec_/)

    const lista = await listarReceitas()
    expect(lista).toHaveLength(1)
    expect(lista[0].nome).toBe('Brigadeiro')
    expect(lista[0].rendimentoBase).toBe(50)
    expect(lista[0].margemPct).toBe(200)
    expect(lista[0].itens).toEqual([{ ingredienteId: toddy.id, quantidade: 80 }])
  })

  it('a receita guarda quantidade, nunca preço', async () => {
    const { receita } = await comBrigadeiro()
    const serializada = JSON.stringify(receita)
    expect(serializada).not.toMatch(/preco/i)
    expect(serializada).not.toMatch(/Cent/)
  })

  it('mudar o preço do ingrediente não toca na receita', async () => {
    const { toddy, receita } = await comBrigadeiro()
    await salvarIngrediente({ ...TODDY, embalagemPrecoCent: 1500 }, toddy.id)
    const depois = (await listarReceitas()).find((r) => r.id === receita.id)
    expect(depois.itens).toEqual([{ ingredienteId: toddy.id, quantidade: 80 }])
  })

  it('recusa nome repetido', async () => {
    await comBrigadeiro()
    await expect(salvarReceita({ nome: 'BRIGADEIRO', rendimentoBase: 50, itens: [] }))
      .rejects.toThrow(/já existe/i)
  })

  it('recusa nome vazio', async () => {
    await expect(salvarReceita({ nome: '  ', rendimentoBase: 50, itens: [] }))
      .rejects.toThrow(/nome/i)
  })

  it('recusa rendimento base zero ou negativo', async () => {
    await expect(salvarReceita({ nome: 'X', rendimentoBase: 0, itens: [] }))
      .rejects.toThrow(/rendimento/i)
    await expect(salvarReceita({ nome: 'Y', rendimentoBase: -5, itens: [] }))
      .rejects.toThrow(/rendimento/i)
  })

  it('recusa item sem ingrediente ou com quantidade que não é número', async () => {
    await expect(salvarReceita({
      nome: 'X', rendimentoBase: 50, itens: [{ ingredienteId: '', quantidade: 10 }],
    })).rejects.toThrow(/ingrediente/i)

    await expect(salvarReceita({
      nome: 'Y', rendimentoBase: 50, itens: [{ ingredienteId: 'ing_1', quantidade: 'abc' }],
    })).rejects.toThrow(/quantidade/i)
  })

  it('recusa item com quantidade negativa', async () => {
    await expect(salvarReceita({
      nome: 'Z', rendimentoBase: 50, itens: [{ ingredienteId: 'ing_1', quantidade: -50 }],
    })).rejects.toThrow(/negativa/i)
  })

  it('aceita margem vazia — nem todo doce tem preço de venda decidido', async () => {
    const r = await salvarReceita({ nome: 'Bolo', rendimentoBase: 12, margemPct: null, itens: [] })
    expect(r.margemPct).toBe(null)
  })

  it('editar mantém o id e o criadoEm', async () => {
    const { receita } = await comBrigadeiro()
    const editada = await salvarReceita(
      { ...receita, nome: 'Brigadeiro gourmet', rendimentoBase: 40 }, receita.id,
    )
    expect(editada.id).toBe(receita.id)
    expect(editada.criadoEm).toBe(receita.criadoEm)
    expect(await listarReceitas()).toHaveLength(1)
  })

  it('apagar ingrediente que está em receita é recusado, e diz onde ele está', async () => {
    const { toddy } = await comBrigadeiro()
    await expect(apagarIngrediente(toddy.id)).rejects.toThrow(/Brigadeiro/)
  })

  it('depois de tirar o ingrediente da receita, dá para apagar', async () => {
    const { toddy, receita } = await comBrigadeiro()
    await salvarReceita({ ...receita, itens: [] }, receita.id)
    await expect(apagarIngrediente(toddy.id)).resolves.toBeUndefined()
  })

  it('apaga a receita', async () => {
    const { receita } = await comBrigadeiro()
    await apagarReceita(receita.id)
    expect(await listarReceitas()).toEqual([])
  })
})
