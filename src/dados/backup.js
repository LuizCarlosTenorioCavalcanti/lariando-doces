// Dado que mora só no celular é dado a uma limpeza de navegador de distância do fim. O
// backup em arquivo é o que torna essa escolha de armazenamento defensável.

import {
  GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, naGaveta,
} from './indexeddb'
import { listarIngredientes, listarReceitas, listarProducoes } from './repositorio'

export const VERSAO_BACKUP = 1

const GAVETAS = [
  ['ingredientes', GAVETA_INGREDIENTES],
  ['receitas', GAVETA_RECEITAS],
  ['producoes', GAVETA_PRODUCOES],
]

export async function exportar() {
  return {
    versao: VERSAO_BACKUP,
    exportadoEm: new Date().toISOString().slice(0, 10),
    ingredientes: await listarIngredientes(),
    receitas: await listarReceitas(),
    producoes: await listarProducoes(),
  }
}

/** Valida ANTES de encostar no banco. Um import que apaga primeiro e descobre o problema
 *  depois transforma um arquivo errado na perda de tudo. */
export function validarBackup(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, motivo: 'Este arquivo não é um backup do Lariano Doces.' }
  }
  if (obj.versao !== VERSAO_BACKUP) {
    return { ok: false, motivo: `Este backup é da versão ${obj.versao ?? '?'}, e o app lê a versão ${VERSAO_BACKUP}.` }
  }
  for (const [chave] of GAVETAS) {
    if (!Array.isArray(obj[chave])) {
      return { ok: false, motivo: `O backup está sem a lista de ${chave}.` }
    }
  }
  return { ok: true }
}

/** Quantos itens o arquivo traz — é o que a confirmação mostra antes de substituir. */
export function resumo(obj) {
  return {
    ingredientes: obj?.ingredientes?.length ?? 0,
    receitas: obj?.receitas?.length ?? 0,
    producoes: obj?.producoes?.length ?? 0,
  }
}

/** SUBSTITUI tudo. Não mescla.
 *
 *  Mesclar dois bancos sem regra de conflito é o caminho mais curto para ela terminar com
 *  dois "Toddy" e um custo dobrado — e sem jeito de saber qual dos dois está certo. */
export async function importar(obj) {
  const valido = validarBackup(obj)
  if (!valido.ok) throw new Error(valido.motivo)

  for (const [chave, gaveta] of GAVETAS) {
    await naGaveta(gaveta, 'readwrite', (g) => g.clear())
    for (const registro of obj[chave]) {
      await naGaveta(gaveta, 'readwrite', (g) => g.put(registro))
    }
  }

  return resumo(obj)
}
