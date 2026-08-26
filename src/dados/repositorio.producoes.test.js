import { describe, it, expect, beforeEach } from 'vitest'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './indexeddb'
import {
  salvarIngrediente, salvarReceita, apagarReceita,
  listarProducoes, salvarProducao, apagarProducao,
} from './repositorio'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

async function cenario() {
  const toddy = await salvarIngrediente(TODDY)
  const receita = await salvarReceita({
    nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
    itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
  })
  const producao = await salvarProducao({
    receitaId: receita.id,
    nomeReceita: receita.nome,
    receitasFeitas: 1,
    rendimento: 50,
    custoTotalCent: 3250,
    custoUnitarioCent: 65,
    parcial: false,
  })
  return { toddy, receita, producao }
}

describe('produções', () => {
  it('salva e lê de volta', async () => {
    const { producao } = await cenario()
    expect(producao.id).toMatch(/^prod_/)

    const lista = await listarProducoes()
    expect(lista).toHaveLength(1)
    expect(lista[0].nomeReceita).toBe('Brigadeiro')
    expect(lista[0].custoTotalCent).toBe(3250)
    expect(lista[0].custoUnitarioCent).toBe(65)
  })

  it('carimba a data de hoje', async () => {
    const { producao } = await cenario()
    expect(producao.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('o custo fica CONGELADO: subir o preço do ingrediente não mexe no histórico', async () => {
    const { toddy } = await cenario()
    await salvarIngrediente({ ...TODDY, embalagemPrecoCent: 3000 }, toddy.id)

    const lista = await listarProducoes()
    expect(lista[0].custoTotalCent).toBe(3250)
    expect(lista[0].custoUnitarioCent).toBe(65)
  })

  it('apagar a receita não apaga nem esvazia o histórico', async () => {
    const { receita } = await cenario()
    await apagarReceita(receita.id)

    const lista = await listarProducoes()
    expect(lista).toHaveLength(1)
    expect(lista[0].nomeReceita).toBe('Brigadeiro')
    expect(lista[0].custoTotalCent).toBe(3250)
  })

  it('lista da mais nova para a mais velha', async () => {
    const { receita } = await cenario()
    const base = { receitaId: receita.id, nomeReceita: 'Brigadeiro', receitasFeitas: 1, parcial: false }
    await salvarProducao({ ...base, rendimento: 60, custoTotalCent: 3250, custoUnitarioCent: 54 })
    await salvarProducao({ ...base, rendimento: 70, custoTotalCent: 3250, custoUnitarioCent: 46 })

    const rendimentos = (await listarProducoes()).map((p) => p.rendimento)
    expect(rendimentos).toEqual([70, 60, 50])
  })

  it('guarda que a produção foi parcial', async () => {
    const { receita } = await cenario()
    await salvarProducao({
      receitaId: receita.id, nomeReceita: 'Beijinho', receitasFeitas: 1, rendimento: 30,
      custoTotalCent: 1000, custoUnitarioCent: 33, parcial: true,
    })
    const parciais = (await listarProducoes()).filter((p) => p.parcial)
    expect(parciais).toHaveLength(1)
    expect(parciais[0].nomeReceita).toBe('Beijinho')
  })

  it('recusa salvar produção sem custo — não existe registro de custo desconhecido', async () => {
    await expect(salvarProducao({
      receitaId: 'rec_1', nomeReceita: 'X', receitasFeitas: 1, rendimento: 50,
      custoTotalCent: null, custoUnitarioCent: null, parcial: false,
    })).rejects.toThrow(/custo/i)
  })

  // `Number(null)`, `Number(undefined)` e `Number('')` não se comportam igual —
  // `null` e `''` viram `0` (que passa em `Number.isFinite`), só `undefined` vira `NaN`.
  // Os três têm que ser recusados do mesmo jeito.
  it.each([
    ['undefined', undefined],
    ['string vazia', ''],
  ])('recusa quando custoTotalCent é %s', async (_rotulo, valor) => {
    await expect(salvarProducao({
      receitaId: 'rec_1', nomeReceita: 'X', receitasFeitas: 1, rendimento: 50,
      custoTotalCent: valor, custoUnitarioCent: 65, parcial: false,
    })).rejects.toThrow(/custo/i)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string vazia', ''],
  ])('recusa quando custoUnitarioCent é %s', async (_rotulo, valor) => {
    await expect(salvarProducao({
      receitaId: 'rec_1', nomeReceita: 'X', receitasFeitas: 1, rendimento: 50,
      custoTotalCent: 3250, custoUnitarioCent: valor, parcial: false,
    })).rejects.toThrow(/custo/i)
  })

  it('apaga uma produção', async () => {
    const { producao } = await cenario()
    await apagarProducao(producao.id)
    expect(await listarProducoes()).toEqual([])
  })
})
