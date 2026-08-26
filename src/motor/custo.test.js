import { describe, it, expect } from 'vitest'
import { custoDoItem, custoDaReceita, custoDaProducao } from './custo'

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
})
