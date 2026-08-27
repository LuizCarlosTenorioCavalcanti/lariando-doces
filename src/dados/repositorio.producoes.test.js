import { describe, it, expect, beforeEach } from 'vitest'
import {
  GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta, naGaveta,
} from './indexeddb'
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

async function base() {
  const { receita } = await cenario()
  return {
    receitaId: receita.id, nomeReceita: receita.nome, receitasFeitas: 1, rendimento: 50,
    custoTotalCent: 3250, custoUnitarioCent: 65, parcial: false,
  }
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

  it('recusa custoTotalCent negativo', async () => {
    await expect(salvarProducao({
      receitaId: 'rec_1', nomeReceita: 'X', receitasFeitas: 1, rendimento: 50,
      custoTotalCent: -100, custoUnitarioCent: 65, parcial: false,
    })).rejects.toThrow(/negativ/i)
  })

  it('recusa custoUnitarioCent negativo', async () => {
    await expect(salvarProducao({
      receitaId: 'rec_1', nomeReceita: 'X', receitasFeitas: 1, rendimento: 50,
      custoTotalCent: 3250, custoUnitarioCent: -1, parcial: false,
    })).rejects.toThrow(/negativ/i)
  })

  // Registro cru, sem passar por `salvarProducao` — é o que um backup malformado que
  // escapasse da validação deixaria na gaveta (`validarBackup` só exige `id` de produção).
  // A listagem não pode quebrar por isso.
  it('ordenação tolera registro sem criadoEm, sem derrubar a listagem', async () => {
    await naGaveta(GAVETA_PRODUCOES, 'readwrite', (g) => g.put({ id: 'prod_cru' }))
    const lista = await listarProducoes()
    expect(lista.some((p) => p.id === 'prod_cru')).toBe(true)
  })

  it('grava as linhas de embalagem junto da produção', async () => {
    const p = await salvarProducao({
      ...(await base()),
      embalagens: [
        { quantidade: 65, precoUnitarioCent: 5 },
        { quantidade: 1, precoUnitarioCent: 250 },
      ],
    })
    expect(p.embalagens).toEqual([
      { quantidade: 65, precoUnitarioCent: 5 },
      { quantidade: 1, precoUnitarioCent: 250 },
    ])
  })

  // Produção da v1 não tem o campo. Ler como `undefined` faria o histórico e a próxima
  // produção quebrarem num `.map` de undefined.
  it('produção sem o campo lê como lista vazia, não como undefined', async () => {
    const p = await salvarProducao({ ...(await base()) })
    expect(p.embalagens).toEqual([])
  })

  it('recusa linha de embalagem com número que não é número', async () => {
    await expect(salvarProducao({
      ...(await base()), embalagens: [{ quantidade: 'abc', precoUnitarioCent: 250 }],
    })).rejects.toThrow(/embalagem/i)
  })

  it('recusa linha de embalagem negativa', async () => {
    const b = await base()
    await expect(salvarProducao({
      ...b, embalagens: [{ quantidade: -1, precoUnitarioCent: 250 }],
    })).rejects.toThrow(/embalagem/i)
    await expect(salvarProducao({
      ...b, embalagens: [{ quantidade: 1, precoUnitarioCent: -250 }],
    })).rejects.toThrow(/embalagem/i)
  })

  it('linha com os dois campos null é descartada', async () => {
    const p = await salvarProducao({
      ...(await base()),
      embalagens: [{ quantidade: null, precoUnitarioCent: null }],
    })
    expect(p.embalagens).toEqual([])
  })

  it('linha com os dois campos vazio é descartada', async () => {
    const p = await salvarProducao({
      ...(await base()),
      embalagens: [{ quantidade: '', precoUnitarioCent: '' }],
    })
    expect(p.embalagens).toEqual([])
  })

  it('linha pela metade recusa — quantidade preenchida mas preço vazio', async () => {
    await expect(salvarProducao({
      ...(await base()),
      embalagens: [{ quantidade: 65, precoUnitarioCent: null }],
    })).rejects.toThrow(/pela metade/i)
  })

  it('linha pela metade recusa — preço preenchido mas quantidade vazia', async () => {
    await expect(salvarProducao({
      ...(await base()),
      embalagens: [{ quantidade: null, precoUnitarioCent: 5 }],
    })).rejects.toThrow(/pela metade/i)
  })

  it('linha em branco misturada com linha boa grava só a boa', async () => {
    const p = await salvarProducao({
      ...(await base()),
      embalagens: [
        { quantidade: null, precoUnitarioCent: null },
        { quantidade: 1, precoUnitarioCent: 250 },
      ],
    })
    expect(p.embalagens).toEqual([{ quantidade: 1, precoUnitarioCent: 250 }])
  })

  // Grava o PREÇO, não a margem, mesmo quando foi a margem que ela digitou. O preço é o
  // fato — o que a cliente pagou. Margem e lucro são leituras dele contra um custo que muda
  // com o tempo; guardar a margem faria o histórico responder "quanto eu cobrava?" com um
  // número que se move.
  it('grava o preço de venda escolhido', async () => {
    const p = await salvarProducao({ ...(await base()), precoVendaCent: 195 })
    expect(p.precoVendaCent).toBe(195)
  })

  it('produção sem preço decidido grava null, não zero', async () => {
    const p = await salvarProducao({ ...(await base()) })
    expect(p.precoVendaCent).toBe(null)
  })

  it('recusa preço de venda negativo', async () => {
    await expect(salvarProducao({ ...(await base()), precoVendaCent: -100 }))
      .rejects.toThrow(/preço/i)
  })
})
