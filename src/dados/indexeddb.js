// Acesso cru ao IndexedDB. Ninguém fora de `repositorio.js` importa este arquivo — é essa
// disciplina que torna uma troca por Supabase, um dia, a reescrita de UM arquivo.

const NOME = 'lariano-doces'
const VERSAO = 1

export const GAVETA_INGREDIENTES = 'ingredientes'
export const GAVETA_RECEITAS = 'receitas'
export const GAVETA_PRODUCOES = 'producoes'

/** Aba anônima e navegador com dados de site bloqueados derrubam o IndexedDB. Detectar
 *  antes é o que separa um aviso claro de uma tela branca sem explicação. */
export function disponivel() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

export function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME, VERSAO)
    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains(GAVETA_INGREDIENTES)) {
        const g = db.createObjectStore(GAVETA_INGREDIENTES, { keyPath: 'id' })
        // Índice único como rede de segurança do nome repetido. A checagem amigável
        // acontece no repositório; esta linha é o que impede a duplicata de entrar mesmo
        // se um caminho novo esquecer de checar.
        g.createIndex('nomeNormalizado', 'nomeNormalizado', { unique: true })
      }

      if (!db.objectStoreNames.contains(GAVETA_RECEITAS)) {
        const g = db.createObjectStore(GAVETA_RECEITAS, { keyPath: 'id' })
        g.createIndex('nomeNormalizado', 'nomeNormalizado', { unique: true })
      }

      if (!db.objectStoreNames.contains(GAVETA_PRODUCOES)) {
        const g = db.createObjectStore(GAVETA_PRODUCOES, { keyPath: 'id' })
        g.createIndex('data', 'data', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Envolve uma transação numa promessa. `fn` recebe a gaveta e devolve o request. */
export async function naGaveta(gaveta, modo, fn) {
  const db = await abrir()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(gaveta, modo)
      const req = fn(tx.objectStore(gaveta))
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
      tx.oncomplete = () => resolve(req?.result)
      if (req) req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export function limparGaveta(gaveta) {
  return naGaveta(gaveta, 'readwrite', (g) => g.clear())
}
