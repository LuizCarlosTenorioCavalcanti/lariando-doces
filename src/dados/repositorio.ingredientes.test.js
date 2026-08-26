import { describe, it, expect, beforeEach } from 'vitest'
import {
  GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta, naGaveta,
} from './indexeddb'
import { listarIngredientes, salvarIngrediente, apagarIngrediente } from './repositorio'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

describe('ingredientes', () => {
  it('começa vazio', async () => {
    expect(await listarIngredientes()).toEqual([])
  })

  it('salva e lê de volta', async () => {
    const salvo = await salvarIngrediente(TODDY)
    expect(salvo.id).toMatch(/^ing_/)

    const lista = await listarIngredientes()
    expect(lista).toHaveLength(1)
    expect(lista[0].nome).toBe('Toddy')
    expect(lista[0].embalagemPrecoCent).toBe(1000)
    expect(lista[0].unidade).toBe('g')
  })

  it('guarda o nome normalizado para comparar depois', async () => {
    const salvo = await salvarIngrediente({ ...TODDY, nome: '  Açúcar  Cristal ' })
    expect(salvo.nome).toBe('Açúcar  Cristal')
    expect(salvo.nomeNormalizado).toBe('acucar cristal')
  })

  it('recusa nome repetido, mesmo com acento e maiúscula diferentes', async () => {
    await salvarIngrediente({ ...TODDY, nome: 'Açúcar' })
    await expect(salvarIngrediente({ ...TODDY, nome: 'ACUCAR' }))
      .rejects.toThrow(/já existe/i)
    expect(await listarIngredientes()).toHaveLength(1)
  })

  it('recusa nome vazio', async () => {
    await expect(salvarIngrediente({ ...TODDY, nome: '   ' })).rejects.toThrow(/nome/i)
  })

  it('recusa unidade que não existe', async () => {
    await expect(salvarIngrediente({ ...TODDY, unidade: 'kg' })).rejects.toThrow(/unidade/i)
  })

  it('recusa embalagem zerada — dividir por ela daria infinito', async () => {
    await expect(salvarIngrediente({ ...TODDY, embalagemQtd: 0 })).rejects.toThrow(/embalagem/i)
  })

  it('aceita ingrediente sem preço ainda', async () => {
    const salvo = await salvarIngrediente({ ...TODDY, embalagemPrecoCent: null })
    expect(salvo.embalagemPrecoCent).toBe(null)
  })

  it('editar mantém o id e não cria outro', async () => {
    const salvo = await salvarIngrediente(TODDY)
    const editado = await salvarIngrediente({ ...TODDY, embalagemPrecoCent: 1200 }, salvo.id)
    expect(editado.id).toBe(salvo.id)
    expect(await listarIngredientes()).toHaveLength(1)
    expect((await listarIngredientes())[0].embalagemPrecoCent).toBe(1200)
  })

  it('editar não bate de frente com o próprio nome', async () => {
    const salvo = await salvarIngrediente(TODDY)
    await expect(salvarIngrediente({ ...TODDY, embalagemPrecoCent: 1200 }, salvo.id)).resolves.toBeTruthy()
  })

  it('devolve a lista em ordem de nome', async () => {
    await salvarIngrediente({ ...TODDY, nome: 'Toddy' })
    await salvarIngrediente({ ...TODDY, nome: 'Açúcar' })
    await salvarIngrediente({ ...TODDY, nome: 'Manteiga' })
    const nomes = (await listarIngredientes()).map((i) => i.nome)
    expect(nomes).toEqual(['Açúcar', 'Manteiga', 'Toddy'])
  })

  it('apaga', async () => {
    const salvo = await salvarIngrediente(TODDY)
    await apagarIngrediente(salvo.id)
    expect(await listarIngredientes()).toEqual([])
  })

  // Registro cru, sem passar por `salvarIngrediente` — é o que um backup malformado que
  // escapasse da validação deixaria na gaveta. A listagem não pode quebrar por isso.
  it('ordenação tolera registro sem nomeNormalizado, sem derrubar a listagem', async () => {
    await naGaveta(GAVETA_INGREDIENTES, 'readwrite', (g) => g.put({ id: 'ing_cru' }))
    const lista = await listarIngredientes()
    expect(lista.some((i) => i.id === 'ing_cru')).toBe(true)
  })
})
