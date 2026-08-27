import { describe, it, expect, beforeEach } from 'vitest'
import {
  GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta, naGaveta,
} from './indexeddb'
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

  // O campo de quantidade na tela guarda texto — em branco é `''`, não `undefined`. E
  // `Number(null)` / `Number('')` são `0`, que passa em `Number.isFinite`: sem checar o
  // vazio antes, a linha salvaria quantidade zero e o ingrediente ficaria de graça.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string vazia', ''],
  ])('recusa item com quantidade em branco (%s)', async (_rotulo, valor) => {
    await expect(salvarReceita({
      nome: 'X', rendimentoBase: 50, itens: [{ ingredienteId: 'ing_1', quantidade: valor }],
    })).rejects.toThrow(/branco/i)
  })

  it('quantidade zero continua válida — numérica e como texto', async () => {
    const receita = await salvarReceita({
      nome: 'Zero',
      rendimentoBase: 50,
      itens: [{ ingredienteId: 'ing_1', quantidade: 0 }, { ingredienteId: 'ing_2', quantidade: '0' }],
    })
    expect(receita.itens).toEqual([
      { ingredienteId: 'ing_1', quantidade: 0 },
      { ingredienteId: 'ing_2', quantidade: 0 },
    ])
  })

  it('aceita margem vazia — nem todo doce tem preço de venda decidido', async () => {
    const r = await salvarReceita({ nome: 'Bolo', rendimentoBase: 12, margemPct: null, itens: [] })
    expect(r.margemPct).toBe(null)
  })

  // Margem de −100% zera o preço; abaixo disso ele fica NEGATIVO na tela, como se o doce
  // pagasse para sair. É dedo errado no campo (um "-" sobrando, ou "-150"), e o lugar de
  // barrar é aqui, na gravação, do mesmo jeito que custo negativo já é barrado — devolver
  // `null` lá no `precoSugerido` trocaria um número gritante por um travessão mudo.
  it('recusa margem de −100% ou menos, que daria preço zero ou negativo', async () => {
    await expect(salvarReceita({ nome: 'A', rendimentoBase: 10, margemPct: -100, itens: [] }))
      .rejects.toThrow(/margem/i)
    await expect(salvarReceita({ nome: 'B', rendimentoBase: 10, margemPct: -150, itens: [] }))
      .rejects.toThrow(/margem/i)
  })

  // Prejuízo de propósito existe: queimar estoque, doce de véspera. O que não existe é
  // preço negativo — por isso a fronteira fica em −100, não em zero.
  it('aceita margem negativa acima de −100%, que é vender com prejuízo', async () => {
    const r = await salvarReceita({ nome: 'C', rendimentoBase: 10, margemPct: -30, itens: [] })
    expect(r.margemPct).toBe(-30)
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

  // Registro cru, sem passar por `salvarReceita` — é o que um backup malformado que
  // escapasse da validação deixaria na gaveta. A listagem não pode quebrar por isso.
  it('ordenação tolera registro sem nomeNormalizado, sem derrubar a listagem', async () => {
    await naGaveta(GAVETA_RECEITAS, 'readwrite', (g) => g.put({ id: 'rec_cru' }))
    const lista = await listarReceitas()
    expect(lista.some((r) => r.id === 'rec_cru')).toBe(true)
  })
})
