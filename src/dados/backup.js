// Dado que mora só no celular é dado a uma limpeza de navegador de distância do fim. O
// backup em arquivo é o que torna essa escolha de armazenamento defensável.

import {
  GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, naGavetas,
} from './indexeddb'
import { listarIngredientes, listarReceitas, listarProducoes } from './repositorio'
import { hojeLocal } from '../lib/formato'

export const VERSAO_BACKUP = 1

// `precisaNome` marca as gavetas cujo registro precisa de `nomeNormalizado` — é o campo
// que o `.sort()` de `listarIngredientes`/`listarReceitas` lê. Um registro sem ele que
// escape da validação derruba essas listas com `TypeError`, e o app fica sem abrir.
const GAVETAS = [
  { chave: 'ingredientes', gaveta: GAVETA_INGREDIENTES, artigo: 'um', singular: 'ingrediente', precisaNome: true },
  { chave: 'receitas', gaveta: GAVETA_RECEITAS, artigo: 'uma', singular: 'receita', precisaNome: true },
  { chave: 'producoes', gaveta: GAVETA_PRODUCOES, artigo: 'uma', singular: 'produção', precisaNome: false },
]

export async function exportar() {
  return {
    versao: VERSAO_BACKUP,
    exportadoEm: hojeLocal(),
    ingredientes: await listarIngredientes(),
    receitas: await listarReceitas(),
    producoes: await listarProducoes(),
  }
}

function textoNaoVazio(valor) {
  return typeof valor === 'string' && valor.trim() !== ''
}

/** Valida ANTES de encostar no banco. Um import que apaga primeiro e descobre o problema
 *  depois transforma um arquivo errado na perda de tudo.
 *
 *  Vai fundo em cada registro, não só na forma da lista: um registro sem `id` some em
 *  silêncio no `put` ou aborta a gaveta pela metade se colidir com o índice único, e um
 *  ingrediente ou receita sem `nomeNormalizado` derruba a listagem inteira depois. Recusar
 *  aqui é a única chance de dizer o motivo sem já ter apagado o que estava salvo. */
export function validarBackup(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, motivo: 'Este arquivo não é um backup do Lariando Doces.' }
  }
  if (obj.versao !== VERSAO_BACKUP) {
    return { ok: false, motivo: `Este backup é da versão ${obj.versao ?? '?'}, e o app lê a versão ${VERSAO_BACKUP}.` }
  }
  for (const g of GAVETAS) {
    if (!Array.isArray(obj[g.chave])) {
      return { ok: false, motivo: `O backup está sem a lista de ${g.chave}.` }
    }
  }
  for (const g of GAVETAS) {
    for (const registro of obj[g.chave]) {
      if (!registro || typeof registro !== 'object' || !textoNaoVazio(registro.id)) {
        return { ok: false, motivo: `O backup tem ${g.artigo} ${g.singular} sem id — o arquivo está corrompido.` }
      }
      if (g.precisaNome && !textoNaoVazio(registro.nomeNormalizado)) {
        return { ok: false, motivo: `O backup tem ${g.artigo} ${g.singular} sem nome interno — o arquivo está corrompido.` }
      }
    }
  }

  // Receita sem `itens` (ou com item malformado) passa pelas checagens acima — elas só
  // olham `id`/`nomeNormalizado` — e derruba `FolhaDoces` num `.length` de `undefined`
  // durante o render, tela branca sem explicação. Recusar aqui é a única chance de dizer
  // o motivo antes de já ter apagado o que estava salvo.
  for (const registro of obj.receitas) {
    if (!Array.isArray(registro.itens)) {
      return { ok: false, motivo: 'O backup tem uma receita sem lista de ingredientes — o arquivo está corrompido.' }
    }
    for (const item of registro.itens) {
      if (!item || typeof item !== 'object' || typeof item.ingredienteId !== 'string' || !item.ingredienteId) {
        return { ok: false, motivo: 'O backup tem um item de receita sem ingrediente — o arquivo está corrompido.' }
      }
      if (typeof item.quantidade !== 'number' || !Number.isFinite(item.quantidade) || item.quantidade < 0) {
        return { ok: false, motivo: 'O backup tem um item de receita com quantidade inválida — o arquivo está corrompido.' }
      }
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
 *  dois "Toddy" e um custo dobrado — e sem jeito de saber qual dos dois está certo.
 *
 *  As três gavetas entram numa ÚNICA transação: se uma colisão de índice único (ou outro
 *  erro) estourar no meio do caminho, o IndexedDB desfaz sozinho tudo que essa transação
 *  já tinha feito — inclusive os `clear()`. Sem isso, um arquivo malformado no meio do
 *  caminho deixaria as gavetas apagadas pela metade, sem jeito de voltar atrás. */
export async function importar(obj) {
  const valido = validarBackup(obj)
  if (!valido.ok) throw new Error(valido.motivo)

  const gavetas = GAVETAS.map((g) => g.gaveta)
  await naGavetas(gavetas, 'readwrite', (tx) => {
    for (const { chave, gaveta } of GAVETAS) {
      const g = tx.objectStore(gaveta)
      g.clear()
      for (const registro of obj[chave]) g.put(registro)
    }
  })

  return resumo(obj)
}
