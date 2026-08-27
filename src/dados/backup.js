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
  { chave: 'ingredientes', gaveta: GAVETA_INGREDIENTES, artigo: 'um', singular: 'ingrediente', doisDuas: 'dois', plural: 'ingredientes', precisaNome: true },
  { chave: 'receitas', gaveta: GAVETA_RECEITAS, artigo: 'uma', singular: 'receita', doisDuas: 'duas', plural: 'receitas', precisaNome: true },
  { chave: 'producoes', gaveta: GAVETA_PRODUCOES, artigo: 'uma', singular: 'produção', doisDuas: 'duas', plural: 'produções', precisaNome: false },
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
    // Duas colisões diferentes, e nenhuma delas se anuncia sozinha na hora do `put`:
    // id repetido SOBRESCREVE em silêncio (a importação "dá certo" tendo engolido um
    // registro), e `nomeNormalizado` repetido estoura um `ConstraintError` em inglês do
    // índice único — depois de a usuária já ter autorizado apagar o que tinha. As duas
    // precisam morrer aqui, antes da pergunta destrutiva.
    const idsVistos = new Set()
    const nomesVistos = new Map()

    for (const registro of obj[g.chave]) {
      if (!registro || typeof registro !== 'object' || !textoNaoVazio(registro.id)) {
        return { ok: false, motivo: `O backup tem ${g.artigo} ${g.singular} sem id — o arquivo está corrompido.` }
      }
      if (idsVistos.has(registro.id)) {
        return { ok: false, motivo: `O backup tem ${g.doisDuas} ${g.plural} com o mesmo id — o arquivo está corrompido.` }
      }
      idsVistos.add(registro.id)

      if (g.precisaNome) {
        if (!textoNaoVazio(registro.nomeNormalizado)) {
          return { ok: false, motivo: `O backup tem ${g.artigo} ${g.singular} sem nome interno — o arquivo está corrompido.` }
        }
        if (nomesVistos.has(registro.nomeNormalizado)) {
          return {
            ok: false,
            motivo: `Esse arquivo tem ${g.doisDuas} ${g.plural} com o mesmo nome: ${nomesVistos.get(registro.nomeNormalizado)}.`,
          }
        }
        // Guarda o nome como ela o escreveu, não o normalizado: é por esse que ela procura
        // no arquivo. E guarda o da PRIMEIRA ocorrência — as seguintes são justamente as
        // grafias tortas ("toddy ") que a normalização existe para colapsar. Sem `nome`, o
        // normalizado ainda é melhor que nada.
        nomesVistos.set(
          registro.nomeNormalizado,
          textoNaoVazio(registro.nome) ? registro.nome.trim() : registro.nomeNormalizado,
        )
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
    // Uma margem <= -100% deixaria o preço em zero ou negativo — o mesmo limite de
    // `repositorio.js` — e, sem checagem aqui, o doce entra e não tem mais campo de margem
    // no formulário para ela consertar depois.
    if (registro.margemPct !== null && registro.margemPct !== undefined) {
      const margem = Number(registro.margemPct)
      if (registro.margemPct === '' || !Number.isFinite(margem) || margem <= -100) {
        return { ok: false, motivo: 'O backup tem uma receita com margem inválida.' }
      }
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

  // Produção com embalagem malformada passa nas checagens de cima — elas só olham `id` — e
  // derruba o render do histórico. Recusar aqui é a última chance de dizer o motivo antes
  // de já ter apagado o que estava salvo.
  for (const registro of obj.producoes) {
    // Checagem de preço vem ANTES do `continue` de embalagens ausentes: produção sem
    // embalagem (pote retornável) é o caso comum, e não pode escapar desta validação.
    if (registro.precoVendaCent !== null && registro.precoVendaCent !== undefined) {
      const preco = Number(registro.precoVendaCent)
      if (registro.precoVendaCent === '' || !Number.isFinite(preco) || preco < 0) {
        return { ok: false, motivo: 'O backup tem uma produção com preço de venda inválido.' }
      }
    }

    if (registro.embalagens === null || registro.embalagens === undefined) continue
    if (!Array.isArray(registro.embalagens)) {
      return { ok: false, motivo: 'O backup tem uma produção com a embalagem corrompida.' }
    }
    // Presença é validada ANTES de número, como em `embalagensValidas` no repositorio.js:
    // `Number(null)` é `0` e passa em `Number.isFinite`, deixando uma linha fantasma passar.
    for (const linha of registro.embalagens) {
      const qtdVazia = linha?.quantidade === null || linha?.quantidade === undefined || linha?.quantidade === ''
      const precoVazio = linha?.precoUnitarioCent === null || linha?.precoUnitarioCent === undefined || linha?.precoUnitarioCent === ''
      if (qtdVazia || precoVazio) {
        return { ok: false, motivo: 'O backup tem uma linha de embalagem com número inválido.' }
      }
      const quantidade = Number(linha.quantidade)
      const preco = Number(linha.precoUnitarioCent)
      if (!Number.isFinite(quantidade) || !Number.isFinite(preco) || quantidade < 0 || preco < 0) {
        return { ok: false, motivo: 'O backup tem uma linha de embalagem com número inválido.' }
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
