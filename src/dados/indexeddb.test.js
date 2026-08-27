// A atomicidade da importação é o que impede um arquivo ruim de deixar as gavetas apagadas
// pela metade — e ela não vem de `backup.js`, vem daqui: das três gavetas entrarem numa
// transação só. `backup.test.js` não consegue mais provar isso pelo caminho de cima, porque
// `validarBackup` recusa antes de encostar no banco todo arquivo que colidiria. A garantia
// continua existindo, então é testada na camada que a fornece.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  GAVETA_INGREDIENTES, GAVETA_RECEITAS, limparGaveta, naGaveta, naGavetas,
} from './indexeddb'

const FERMENTO = {
  id: 'ing_a', nome: 'Fermento', nomeNormalizado: 'fermento',
  unidade: 'g', embalagemQtd: 100, embalagemPrecoCent: 300,
}
const CLONE_COLIDINDO = { ...FERMENTO, id: 'ing_b', nome: 'Fermento 2' }
const BRIGADEIRO = {
  id: 'rec_a', nome: 'Brigadeiro', nomeNormalizado: 'brigadeiro',
  rendimentoBase: 50, margemPct: null, itens: [],
}

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
})

function listar(gaveta) {
  return naGaveta(gaveta, 'readonly', (g) => g.getAll())
}

describe('naGavetas', () => {
  it('desfaz o `clear` quando um `put` posterior estoura, em qualquer das gavetas', async () => {
    await naGaveta(GAVETA_INGREDIENTES, 'readwrite', (g) => g.put(FERMENTO))
    await naGaveta(GAVETA_RECEITAS, 'readwrite', (g) => g.put(BRIGADEIRO))

    let erro = null
    try {
      await naGavetas([GAVETA_INGREDIENTES, GAVETA_RECEITAS], 'readwrite', (tx) => {
        const ing = tx.objectStore(GAVETA_INGREDIENTES)
        ing.clear()
        ing.put({ ...FERMENTO, nome: 'Outro' })
        ing.put(CLONE_COLIDINDO) // colide com o índice único de `nomeNormalizado`
        const rec = tx.objectStore(GAVETA_RECEITAS)
        rec.clear()
      })
    } catch (e) {
      erro = e
    }

    // Rejeita de verdade, com mensagem — não com `null`, que viraria `TypeError` calado em
    // quem faz `catch (e) { setErro(e.message) }`.
    expect(erro).toBeTruthy()
    expect(typeof erro.message).toBe('string')
    expect(erro.message.length).toBeGreaterThan(0)

    // O ponto: a gaveta de RECEITAS foi limpa na mesma transação e não tinha nada a ver com
    // a colisão. Se cada gaveta fosse sua própria transação, ela voltaria vazia.
    const ingredientes = await listar(GAVETA_INGREDIENTES)
    expect(ingredientes).toHaveLength(1)
    expect(ingredientes[0].nome).toBe('Fermento')
    expect(await listar(GAVETA_RECEITAS)).toHaveLength(1)
  })
})
