// A fronteira do armazenamento. O resto do sistema só conhece as funções daqui.
//
// Do outro lado, num Postgres, a tabela seria:
//   ingredientes (id text pk, nome text, nome_normalizado text unique, unidade text,
//                 embalagem_qtd numeric, embalagem_preco_cent int, atualizado_em date)

import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, naGaveta } from './indexeddb'
import { normalizar } from '../lib/texto'

const UNIDADES = ['g', 'ml', 'un']

function novoId(prefixo) {
  return `${prefixo}_${crypto.randomUUID()}`
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

export function listarIngredientes() {
  return naGaveta(GAVETA_INGREDIENTES, 'readonly', (g) => g.getAll())
    .then((linhas) => (linhas || [])
      .sort((a, b) => a.nomeNormalizado.localeCompare(b.nomeNormalizado, 'pt-BR')))
}

/** Sem `id`, cria. Com `id`, edita.
 *
 *  `atualizadoEm` só anda quando o PREÇO muda — é ele que ordena a lista de ingredientes
 *  por "mais desatualizado primeiro". Se corrigir um acento no nome empurrasse o
 *  ingrediente para o fim da fila, a lista pararia de responder à única pergunta que ela
 *  faz ali: qual preço está velho? */
export async function salvarIngrediente(dados, id) {
  const nome = String(dados?.nome ?? '').trim()
  if (!nome) throw new Error('O ingrediente precisa de um nome.')

  if (!UNIDADES.includes(dados?.unidade)) {
    throw new Error('A unidade precisa ser g, ml ou un.')
  }

  const embalagemQtd = Number(dados?.embalagemQtd)
  if (!Number.isFinite(embalagemQtd) || embalagemQtd <= 0) {
    throw new Error('A quantidade da embalagem precisa ser maior que zero.')
  }

  const preco = dados?.embalagemPrecoCent
  const embalagemPrecoCent =
    preco === null || preco === undefined || preco === '' ? null : Math.round(Number(preco))
  if (embalagemPrecoCent !== null && !Number.isFinite(embalagemPrecoCent)) {
    throw new Error('O preço da embalagem não é um número.')
  }

  const nomeNormalizado = normalizar(nome)
  const existentes = await listarIngredientes()

  const conflito = existentes.find((i) => i.nomeNormalizado === nomeNormalizado && i.id !== id)
  if (conflito) throw new Error(`Já existe um ingrediente chamado "${conflito.nome}".`)

  const anterior = id ? existentes.find((i) => i.id === id) : null
  if (id && !anterior) throw new Error('Ingrediente não encontrado.')

  const precoMudou = !anterior || anterior.embalagemPrecoCent !== embalagemPrecoCent

  const registro = {
    id: id ?? novoId('ing'),
    nome,
    nomeNormalizado,
    unidade: dados.unidade,
    embalagemQtd,
    embalagemPrecoCent,
    atualizadoEm: precoMudou ? hoje() : anterior.atualizadoEm,
  }

  await naGaveta(GAVETA_INGREDIENTES, 'readwrite', (g) => g.put(registro))
  return registro
}

export async function apagarIngrediente(id) {
  const receitas = await listarReceitas()
  const usando = receitas.filter((r) => (r.itens ?? []).some((i) => i.ingredienteId === id))
  if (usando.length) {
    const nomes = usando.map((r) => r.nome).join(', ')
    throw new Error(`Este ingrediente está em ${nomes}. Tire ele da receita primeiro.`)
  }
  await naGaveta(GAVETA_INGREDIENTES, 'readwrite', (g) => g.delete(id))
}

export function listarReceitas() {
  return naGaveta(GAVETA_RECEITAS, 'readonly', (g) => g.getAll())
    .then((linhas) => (linhas || [])
      .sort((a, b) => a.nomeNormalizado.localeCompare(b.nomeNormalizado, 'pt-BR')))
}
