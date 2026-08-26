import { describe, it, expect, beforeEach } from 'vitest'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './indexeddb'
import {
  salvarIngrediente, salvarReceita, salvarProducao,
  listarIngredientes, listarReceitas, listarProducoes,
} from './repositorio'
import { exportar, importar, validarBackup, resumo } from './backup'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

async function semear() {
  const toddy = await salvarIngrediente(TODDY)
  const receita = await salvarReceita({
    nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
    itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
  })
  await salvarProducao({
    receitaId: receita.id, nomeReceita: 'Brigadeiro', receitasFeitas: 1, rendimento: 50,
    custoTotalCent: 3250, custoUnitarioCent: 65, parcial: false,
  })
}

describe('exportar', () => {
  it('leva as três gavetas e a versão', async () => {
    await semear()
    const b = await exportar()
    expect(b.versao).toBe(1)
    expect(b.exportadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(b.ingredientes).toHaveLength(1)
    expect(b.receitas).toHaveLength(1)
    expect(b.producoes).toHaveLength(1)
  })

  it('sobrevive a virar texto e voltar — é assim que ele viaja em arquivo', async () => {
    await semear()
    const b = await exportar()
    expect(JSON.parse(JSON.stringify(b))).toEqual(b)
  })
})

describe('validarBackup', () => {
  it('aceita um backup de verdade', async () => {
    await semear()
    expect(validarBackup(await exportar())).toEqual({ ok: true })
  })

  it('recusa o que não é objeto', () => {
    expect(validarBackup(null).ok).toBe(false)
    expect(validarBackup('texto').ok).toBe(false)
    expect(validarBackup([]).ok).toBe(false)
  })

  it('recusa versão que não conhece, dizendo o motivo', () => {
    const r = validarBackup({ versao: 99, ingredientes: [], receitas: [], producoes: [] })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/vers/i)
  })

  it('recusa quando falta uma gaveta', () => {
    const r = validarBackup({ versao: 1, ingredientes: [], receitas: [] })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/produ/i)
  })

  it('recusa quando a gaveta não é lista', () => {
    const r = validarBackup({ versao: 1, ingredientes: {}, receitas: [], producoes: [] })
    expect(r.ok).toBe(false)
  })

  it('recusa registro sem id, dizendo o motivo', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [{ nomeNormalizado: 'toddy' }], receitas: [], producoes: [],
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/id/i)
  })

  it('recusa ingrediente sem nome interno', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [{ id: 'ing_1' }], receitas: [], producoes: [],
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/nome/i)
  })

  it('recusa receita sem nome interno', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [], receitas: [{ id: 'rec_1' }], producoes: [],
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/nome/i)
  })

  // Sem esta checagem, uma receita sem `itens` passa na validação e derruba `FolhaDoces`
  // num `r.itens.length` de `undefined` durante o render — tela branca, sem explicação.
  it('recusa receita sem lista de itens', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [], producoes: [],
      receitas: [{ id: 'rec_1', nomeNormalizado: 'brigadeiro' }],
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/ingrediente/i)
  })

  it('recusa item de receita sem ingredienteId', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [], producoes: [],
      receitas: [{
        id: 'rec_1', nomeNormalizado: 'brigadeiro', itens: [{ quantidade: 80 }],
      }],
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/ingrediente/i)
  })

  it('recusa item de receita com quantidade negativa', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [], producoes: [],
      receitas: [{
        id: 'rec_1', nomeNormalizado: 'brigadeiro',
        itens: [{ ingredienteId: 'ing_1', quantidade: -5 }],
      }],
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/quantidade/i)
  })

  it('recusa item de receita com quantidade não numérica', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [], producoes: [],
      receitas: [{
        id: 'rec_1', nomeNormalizado: 'brigadeiro',
        itens: [{ ingredienteId: 'ing_1', quantidade: 'abc' }],
      }],
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/quantidade/i)
  })
})

describe('resumo', () => {
  it('conta o que o arquivo traz, para a confirmação dizer o tamanho do estrago', () => {
    expect(resumo({ ingredientes: [1, 2], receitas: [1], producoes: [] }))
      .toEqual({ ingredientes: 2, receitas: 1, producoes: 0 })
  })
})

describe('importar', () => {
  it('exportar, apagar tudo e importar devolve o mesmo estado', async () => {
    await semear()
    const antes = await exportar()

    await limparGaveta(GAVETA_INGREDIENTES)
    await limparGaveta(GAVETA_RECEITAS)
    await limparGaveta(GAVETA_PRODUCOES)
    expect(await listarIngredientes()).toEqual([])

    await importar(JSON.parse(JSON.stringify(antes)))

    expect(await listarIngredientes()).toEqual(antes.ingredientes)
    expect(await listarReceitas()).toEqual(antes.receitas)
    expect(await listarProducoes()).toEqual(antes.producoes)
  })

  it('substitui, não mistura — importar não duplica o que já estava lá', async () => {
    await semear()
    const b = await exportar()
    await importar(b)
    expect(await listarIngredientes()).toHaveLength(1)
    expect(await listarReceitas()).toHaveLength(1)
  })

  it('devolve quanto entrou', async () => {
    await semear()
    const b = await exportar()
    expect(await importar(b)).toEqual({ ingredientes: 1, receitas: 1, producoes: 1 })
  })

  it('registro sem id não destrói o que já estava salvo', async () => {
    await semear()
    await expect(importar({
      versao: 1, ingredientes: [{ nomeNormalizado: 'x' }], receitas: [], producoes: [],
    })).rejects.toThrow(/id/i)

    expect(await listarIngredientes()).toHaveLength(1)
    expect(await listarReceitas()).toHaveLength(1)
    expect(await listarProducoes()).toHaveLength(1)
  })

  it('ingrediente sem nome interno não destrói o que já estava salvo', async () => {
    await semear()
    await expect(importar({
      versao: 1, ingredientes: [{ id: 'ing_x' }], receitas: [], producoes: [],
    })).rejects.toThrow(/nome/i)

    expect(await listarIngredientes()).toHaveLength(1)
    expect(await listarReceitas()).toHaveLength(1)
    expect(await listarProducoes()).toHaveLength(1)
  })

  it('receita sem nome interno não destrói o que já estava salvo', async () => {
    await semear()
    await expect(importar({
      versao: 1, ingredientes: [], receitas: [{ id: 'rec_x' }], producoes: [],
    })).rejects.toThrow(/nome/i)

    expect(await listarIngredientes()).toHaveLength(1)
    expect(await listarReceitas()).toHaveLength(1)
    expect(await listarProducoes()).toHaveLength(1)
  })

  it('arquivo inválido não destrói o que já estava salvo', async () => {
    await semear()
    await expect(importar({ versao: 99 })).rejects.toThrow(/vers/i)

    expect(await listarIngredientes()).toHaveLength(1)
    expect(await listarReceitas()).toHaveLength(1)
    expect(await listarProducoes()).toHaveLength(1)
  })

  it('receita sem itens não destrói o que já estava salvo', async () => {
    await semear()
    await expect(importar({
      versao: 1, ingredientes: [], producoes: [],
      receitas: [{ id: 'rec_x', nomeNormalizado: 'x' }],
    })).rejects.toThrow(/ingrediente/i)

    expect(await listarIngredientes()).toHaveLength(1)
    expect(await listarReceitas()).toHaveLength(1)
    expect(await listarProducoes()).toHaveLength(1)
  })

  it('colisão de índice único durante a importação não deixa a gaveta pela metade', async () => {
    await semear()
    await expect(importar({
      versao: 1, receitas: [], producoes: [],
      ingredientes: [
        { id: 'ing_a', nome: 'Fermento', nomeNormalizado: 'fermento', unidade: 'g', embalagemQtd: 100, embalagemPrecoCent: 300 },
        { id: 'ing_b', nome: 'Fermento 2', nomeNormalizado: 'fermento', unidade: 'g', embalagemQtd: 100, embalagemPrecoCent: 300 },
      ],
    })).rejects.toThrow()

    const ingredientes = await listarIngredientes()
    expect(ingredientes).toHaveLength(1)
    expect(ingredientes[0].nome).toBe('Toddy')
    expect(await listarReceitas()).toHaveLength(1)
    expect(await listarProducoes()).toHaveLength(1)
  })
})
