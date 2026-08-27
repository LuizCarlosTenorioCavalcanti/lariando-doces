import { describe, it, expect } from 'vitest'
import {
  custoDoItem, custoDaReceita, custoDaProducao,
  precoSugerido, lucroDaProducao, rendimentoSuspeito, custoDasEmbalagens,
  margemDoPreco, precoDoLucro,
} from './custo'

const ing = (id, nome, unidade, embalagemQtd, embalagemPrecoCent) =>
  ({ id, nome, unidade, embalagemQtd, embalagemPrecoCent })

// O brigadeiro da spec: uma receita rende 50 e custa R$ 32,50.
const LEITE = ing('ing_leite', 'Leite condensado', 'g', 395, 650)
const GRANULADO = ing('ing_gran', 'Granulado', 'g', 500, 1500)
const CREME = ing('ing_creme', 'Creme de leite', 'g', 200, 500)
const MANTEIGA = ing('ing_mant', 'Manteiga', 'g', 500, 1200)
const TODDY = ing('ing_toddy', 'Toddy', 'g', 400, 1000)
const FORMINHA = ing('ing_form', 'Forminha', 'un', 100, 520)

const PORID = {
  ing_leite: LEITE, ing_gran: GRANULADO, ing_creme: CREME,
  ing_mant: MANTEIGA, ing_toddy: TODDY, ing_form: FORMINHA,
}

const BRIGADEIRO = {
  id: 'rec_brig',
  nome: 'Brigadeiro',
  rendimentoBase: 50,
  margemPct: 200,
  itens: [
    { ingredienteId: 'ing_leite', quantidade: 790 },
    { ingredienteId: 'ing_gran', quantidade: 250 },
    { ingredienteId: 'ing_creme', quantidade: 200 },
    { ingredienteId: 'ing_mant', quantidade: 100 },
    { ingredienteId: 'ing_toddy', quantidade: 80 },
    { ingredienteId: 'ing_form', quantidade: 50 },
  ],
}

describe('custoDoItem', () => {
  it('cobra a fração da embalagem que foi usada', () => {
    // 40 de um pacote de 400 que custa R$ 10,00 → R$ 1,00
    expect(custoDoItem({ quantidade: 40 }, TODDY)).toBe(100)
  })

  it('trata unidade igual a grama, sem caso especial', () => {
    // 50 forminhas de um pacote de 100 que custa R$ 5,20 → R$ 2,60
    expect(custoDoItem({ quantidade: 50 }, FORMINHA)).toBe(260)
  })

  it('cobra mais de uma embalagem quando usou mais que o pacote', () => {
    // 790 g de leite condensado = duas latas de 395 g a R$ 6,50 → R$ 13,00
    expect(custoDoItem({ quantidade: 790 }, LEITE)).toBe(1300)
  })

  it('devolve null quando o ingrediente não tem preço — nunca zero', () => {
    const semPreco = ing('ing_x', 'Chocolate', 'g', 200, null)
    expect(custoDoItem({ quantidade: 100 }, semPreco)).toBe(null)
  })

  it('devolve null quando o ingrediente sumiu do cadastro', () => {
    expect(custoDoItem({ quantidade: 100 }, undefined)).toBe(null)
  })

  it('devolve null quando a embalagem é zero, em vez de dividir por zero', () => {
    const zerado = ing('ing_z', 'Zerado', 'g', 0, 1000)
    expect(custoDoItem({ quantidade: 100 }, zerado)).toBe(null)
  })

  it('devolve null quando a quantidade não é número', () => {
    expect(custoDoItem({ quantidade: 'abc' }, TODDY)).toBe(null)
  })

  it('devolve null para quantidade negativa — dedo errado não pode baratear o doce', () => {
    expect(custoDoItem({ quantidade: -50 }, TODDY)).toBe(null)
  })

  it('quantidade zero é legítima e custa zero de verdade, não null', () => {
    expect(custoDoItem({ quantidade: 0 }, TODDY)).toBe(0)
  })
})

describe('custoDaReceita', () => {
  it('soma o brigadeiro inteiro em R$ 32,50', () => {
    const { totalCent, semPreco } = custoDaReceita(BRIGADEIRO, PORID)
    expect(Math.round(totalCent)).toBe(3250)
    expect(semPreco).toEqual([])
  })

  it('soma o que dá e nomeia o que faltou, sem contar o que falta como zero', () => {
    const porId = { ...PORID, ing_mant: ing('ing_mant', 'Manteiga', 'g', 500, null) }
    const { totalCent, semPreco } = custoDaReceita(BRIGADEIRO, porId)
    // R$ 32,50 menos os R$ 2,40 da manteiga
    expect(Math.round(totalCent)).toBe(3010)
    expect(semPreco).toEqual(['Manteiga'])
  })

  it('receita sem item nenhum custa zero e não é parcial', () => {
    const vazia = { ...BRIGADEIRO, itens: [] }
    expect(custoDaReceita(vazia, PORID)).toEqual({ totalCent: 0, semPreco: [] })
  })
})

describe('custoDaProducao', () => {
  it('uma receita rendendo 50 custa R$ 32,50 e R$ 0,65 cada', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
    })
    expect(r.custoTotalCent).toBe(3250)
    expect(r.custoUnitarioCent).toBe(65)
    expect(r.parcial).toBe(false)
  })

  it('o número de receitas manda no custo total', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 2, rendimento: 100,
    })
    expect(r.custoTotalCent).toBe(6500)
    expect(r.custoUnitarioCent).toBe(65)
  })

  it('o rendimento manda no custo por unidade, e o total não muda', () => {
    // Mesma panela, enrolou menor: saíram 65 em vez de 50.
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 65,
    })
    expect(r.custoTotalCent).toBe(3250)
    expect(r.custoUnitarioCent).toBe(50)
  })

  it('duas receitas rendendo pouco encarecem a unidade', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 2, rendimento: 20,
    })
    expect(r.custoTotalCent).toBe(6500)
    expect(r.custoUnitarioCent).toBe(325)
  })

  it('aceita meia receita', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1.5, rendimento: 75,
    })
    expect(r.custoTotalCent).toBe(4875)
    expect(r.custoUnitarioCent).toBe(65)
  })

  it('marca parcial e diz o que faltou', () => {
    const porId = { ...PORID, ing_mant: ing('ing_mant', 'Manteiga', 'g', 500, null) }
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: porId, receitasFeitas: 1, rendimento: 50,
    })
    expect(r.parcial).toBe(true)
    expect(r.semPreco).toEqual(['Manteiga'])
    expect(r.custoTotalCent).toBe(3010)
  })

  it('rendimento zero não vira NaN nem divisão por zero', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 0,
    })
    expect(r.custoTotalCent).toBe(3250)
    expect(r.custoUnitarioCent).toBe(null)
  })

  it('rendimento vazio ou texto devolve unitário null', () => {
    for (const rendimento of ['', null, undefined, 'abc']) {
      const r = custoDaProducao({
        receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento,
      })
      expect(r.custoUnitarioCent).toBe(null)
    }
  })

  it('número de receitas vazio ou zero devolve total null', () => {
    for (const receitasFeitas of ['', null, 0, 'abc']) {
      const r = custoDaProducao({
        receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas, rendimento: 50,
      })
      expect(r.custoTotalCent).toBe(null)
      expect(r.custoUnitarioCent).toBe(null)
    }
  })

  it('devolve inteiros, nunca centavo quebrado', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 47,
    })
    expect(Number.isInteger(r.custoTotalCent)).toBe(true)
    expect(Number.isInteger(r.custoUnitarioCent)).toBe(true)
  })

  it('a embalagem entra no total e no custo de cada um', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
      embalagens: [{ quantidade: 1, precoUnitarioCent: 250 }],
    })
    expect(r.custoTotalCent).toBe(3500)
    expect(r.custoUnitarioCent).toBe(70)
  })

  // O ponto mais importante da Fase 1. Ingrediente escala com quantas receitas saíram do
  // armário; embalagem não escala com nada, porque ela digitou a quantidade que de fato
  // usou. Multiplicar cobraria 2 caixas de quem usou 1.
  it('a embalagem NÃO é multiplicada por quantas receitas ela fez', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 2, rendimento: 100,
      embalagens: [{ quantidade: 1, precoUnitarioCent: 250 }],
    })
    expect(r.custoTotalCent).toBe(6750)
  })

  it('sem embalagem o total é o de sempre', () => {
    const semCampo = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
    })
    const comListaVazia = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
      embalagens: [],
    })
    expect(semCampo.custoTotalCent).toBe(3250)
    expect(comListaVazia.custoTotalCent).toBe(3250)
  })

  it('embalagem pela metade acende o parcial, como ingrediente sem preço faz', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
      embalagens: [{ quantidade: 1, precoUnitarioCent: null }],
    })
    expect(r.parcial).toBe(true)
    expect(r.custoTotalCent).toBe(3250)
  })
})

describe('precoSugerido', () => {
  it('aplica a margem sobre o custo unitário', () => {
    expect(precoSugerido(65, 200)).toBe(195)
  })

  it('margem zero devolve o próprio custo', () => {
    expect(precoSugerido(65, 0)).toBe(65)
  })

  it('fecha a olho com o que a tela mostra', () => {
    // O teste que existe por causa da usuária, não do código: ela vai conferir 0,65 × 3.
    const cada = 65
    expect(precoSugerido(cada, 200)).toBe(cada * 3)
  })

  it('sem custo ou sem margem, não há preço', () => {
    expect(precoSugerido(null, 200)).toBe(null)
    expect(precoSugerido(65, null)).toBe(null)
    expect(precoSugerido(65, undefined)).toBe(null)
    expect(precoSugerido(65, 'abc')).toBe(null)
  })
})

describe('lucroDaProducao', () => {
  it('multiplica a diferença pelo que rendeu', () => {
    expect(lucroDaProducao(65, 195, 50)).toBe(6500)
  })

  it('sem preço, sem lucro', () => {
    expect(lucroDaProducao(65, null, 50)).toBe(null)
    expect(lucroDaProducao(null, 195, 50)).toBe(null)
  })

  it('rendimento zero devolve null', () => {
    expect(lucroDaProducao(65, 195, 0)).toBe(null)
  })
})

describe('rendimentoSuspeito', () => {
  const base = { rendimentoBase: 50, temProducaoAnterior: true }

  it('rendimento normal não avisa', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: 50 })).toBe(false)
  })

  it('variação pequena não avisa — enrolar maior ou menor é rotina', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: 60 })).toBe(false)
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: 42 })).toBe(false)
  })

  it('avisa quando rende muito acima do normal', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: 80 })).toBe(true)
  })

  it('avisa quando rende muito abaixo do normal', () => {
    // Duas receitas rendendo 20: dez por receita, contra 50 de sempre. Dedo errado.
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 2, rendimento: 20 })).toBe(true)
  })

  it('compara por receita, não no total — 2 receitas rendendo 100 é normal', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 2, rendimento: 100 })).toBe(false)
  })

  it('na primeira produção do doce nunca avisa: não há "de sempre"', () => {
    expect(rendimentoSuspeito({
      rendimentoBase: 50, temProducaoAnterior: false, receitasFeitas: 1, rendimento: 200,
    })).toBe(false)
  })

  it('sem número que dê para comparar, não avisa', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: '' })).toBe(false)
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 0, rendimento: 50 })).toBe(false)
    expect(rendimentoSuspeito({
      rendimentoBase: 0, temProducaoAnterior: true, receitasFeitas: 1, rendimento: 50,
    })).toBe(false)
  })
})

describe('custoDasEmbalagens', () => {
  // Zero aqui é uma AFIRMAÇÃO verdadeira ("mandei em pote retornável"), não um erro. É a
  // única exceção à regra do arquivo de nunca devolver 0 num caso sem informação.
  it('sem embalagem nenhuma custa zero, e isso não é "não sei"', () => {
    expect(custoDasEmbalagens([])).toEqual({ totalCent: 0, incompleta: false })
    expect(custoDasEmbalagens(null)).toEqual({ totalCent: 0, incompleta: false })
    expect(custoDasEmbalagens(undefined)).toEqual({ totalCent: 0, incompleta: false })
  })

  it('multiplica quantos pelo preço de cada um', () => {
    expect(custoDasEmbalagens([{ quantidade: 65, precoUnitarioCent: 5 }]))
      .toEqual({ totalCent: 325, incompleta: false })
  })

  it('soma várias linhas — forminha e caixa na mesma produção', () => {
    const r = custoDasEmbalagens([
      { quantidade: 65, precoUnitarioCent: 5 },
      { quantidade: 1, precoUnitarioCent: 250 },
    ])
    expect(r).toEqual({ totalCent: 575, incompleta: false })
  })

  // A linha que o "+ embalagem" acabou de criar não pode acender alarme.
  it('linha totalmente em branco é ignorada em silêncio', () => {
    expect(custoDasEmbalagens([{ quantidade: null, precoUnitarioCent: null }]))
      .toEqual({ totalCent: 0, incompleta: false })
    expect(custoDasEmbalagens([{ quantidade: '', precoUnitarioCent: '' }]))
      .toEqual({ totalCent: 0, incompleta: false })
  })

  // No meio da digitação ela tem metade preenchida. Contar como zero esconderia custo.
  it('linha pela metade marca incompleta e não entra na soma, nos dois sentidos', () => {
    expect(custoDasEmbalagens([{ quantidade: 65, precoUnitarioCent: null }]))
      .toEqual({ totalCent: 0, incompleta: true })
    expect(custoDasEmbalagens([{ quantidade: null, precoUnitarioCent: 5 }]))
      .toEqual({ totalCent: 0, incompleta: true })
  })

  it('negativo não entra e marca incompleta — dedo errado não barateia o doce', () => {
    expect(custoDasEmbalagens([{ quantidade: -1, precoUnitarioCent: 250 }]))
      .toEqual({ totalCent: 0, incompleta: true })
    expect(custoDasEmbalagens([{ quantidade: 1, precoUnitarioCent: -250 }]))
      .toEqual({ totalCent: 0, incompleta: true })
  })

  // Zero caixas é uma resposta, não uma falta de resposta.
  it('quantidade zero é válida e custa zero, sem marcar incompleta', () => {
    expect(custoDasEmbalagens([{ quantidade: 0, precoUnitarioCent: 250 }]))
      .toEqual({ totalCent: 0, incompleta: false })
  })

  it('uma linha boa e uma pela metade: soma a boa e ainda assim marca incompleta', () => {
    expect(custoDasEmbalagens([
      { quantidade: 1, precoUnitarioCent: 250 },
      { quantidade: 65, precoUnitarioCent: null },
    ])).toEqual({ totalCent: 250, incompleta: true })
  })
})

describe('margemDoPreco', () => {
  it('R$ 0,65 de custo vendido a R$ 1,95 é 200% de margem', () => {
    expect(margemDoPreco(65, 195)).toBe(200)
  })

  it('fecha a ida e a volta: preço → margem → preço devolve o mesmo preço', () => {
    expect(precoSugerido(65, margemDoPreco(65, 195))).toBe(195)
  })

  it('vender abaixo do custo dá margem negativa, que é informação e não erro', () => {
    expect(margemDoPreco(100, 70)).toBe(-30)
  })

  // Divisão por zero. Acontece com doce cujos ingredientes estão todos sem preço.
  it('custo zero não tem margem — travessão, não Infinity', () => {
    expect(margemDoPreco(0, 195)).toBe(null)
  })

  it('sem custo ou sem preço não há margem', () => {
    expect(margemDoPreco(null, 195)).toBe(null)
    expect(margemDoPreco(65, null)).toBe(null)
  })
})

describe('precoDoLucro', () => {
  it('quero R$ 65,00 de lucro em 50 unidades que custam R$ 0,65: vendo a R$ 1,95', () => {
    expect(precoDoLucro(65, 6500, 50)).toBe(195)
  })

  it('fecha a ida e a volta: lucro → preço → lucro devolve o mesmo lucro', () => {
    expect(lucroDaProducao(65, precoDoLucro(65, 6500, 50), 50)).toBe(6500)
  })

  it('lucro zero é vender pelo custo', () => {
    expect(precoDoLucro(65, 0, 50)).toBe(65)
  })

  // Lucro de fornada sem fornada não existe.
  it('sem rendimento não dá para tirar preço do lucro', () => {
    expect(precoDoLucro(65, 6500, 0)).toBe(null)
    expect(precoDoLucro(65, 6500, null)).toBe(null)
  })

  it('sem custo ou sem lucro não há preço', () => {
    expect(precoDoLucro(null, 6500, 50)).toBe(null)
    expect(precoDoLucro(65, null, 50)).toBe(null)
  })
})
