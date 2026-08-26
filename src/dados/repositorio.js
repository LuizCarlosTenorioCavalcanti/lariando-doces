// A fronteira do armazenamento. O resto do sistema só conhece as funções daqui.
//
// Do outro lado, num Postgres, a tabela seria:
//   ingredientes (id text pk, nome text, nome_normalizado text unique, unidade text,
//                 embalagem_qtd numeric, embalagem_preco_cent int, atualizado_em date)

import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, naGaveta } from './indexeddb'
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

/** Sem `id`, cria. Com `id`, edita preservando `criadoEm`.
 *
 *  A receita guarda `ingredienteId` e `quantidade`, e nada mais. Nenhum preço encosta
 *  aqui: é isso que faz "o leite condensado subiu" ser uma edição num lugar só. */
export async function salvarReceita(dados, id) {
  const nome = String(dados?.nome ?? '').trim()
  if (!nome) throw new Error('O doce precisa de um nome.')

  const rendimentoBase = Number(dados?.rendimentoBase)
  if (!Number.isFinite(rendimentoBase) || rendimentoBase <= 0) {
    throw new Error('O rendimento da receita precisa ser maior que zero.')
  }

  const margem = dados?.margemPct
  const margemPct =
    margem === null || margem === undefined || margem === '' ? null : Number(margem)
  if (margemPct !== null && !Number.isFinite(margemPct)) {
    throw new Error('A margem não é um número.')
  }

  const itens = (dados?.itens ?? []).map((item) => {
    if (!item?.ingredienteId) throw new Error('Tem uma linha sem ingrediente escolhido.')
    // `Number(null)` e `Number('')` são `0`, e `0` passa em `Number.isFinite`. Sem esta
    // guarda, deixar o campo em branco na tela (que guarda texto, então em branco é `''`)
    // salvaria quantidade zero — o ingrediente ficaria de graça na receita.
    if (item.quantidade === null || item.quantidade === undefined || item.quantidade === '') {
      throw new Error('Tem uma linha com quantidade em branco.')
    }
    const quantidade = Number(item.quantidade)
    if (!Number.isFinite(quantidade)) {
      throw new Error('Tem uma linha com quantidade em branco.')
    }
    if (quantidade < 0) {
      throw new Error('Tem uma linha com quantidade negativa.')
    }
    // Só estes dois campos atravessam. Se a tela mandar o ingrediente inteiro junto (e
    // vai, porque é cômodo), o preço iria de carona para dentro da receita e congelaria
    // ali — exatamente o que este modelo existe para evitar.
    return { ingredienteId: item.ingredienteId, quantidade }
  })

  const nomeNormalizado = normalizar(nome)
  const existentes = await listarReceitas()

  const conflito = existentes.find((r) => r.nomeNormalizado === nomeNormalizado && r.id !== id)
  if (conflito) throw new Error(`Já existe um doce chamado "${conflito.nome}".`)

  const anterior = id ? existentes.find((r) => r.id === id) : null
  if (id && !anterior) throw new Error('Doce não encontrado.')

  const registro = {
    id: id ?? novoId('rec'),
    nome,
    nomeNormalizado,
    rendimentoBase,
    margemPct,
    itens,
    criadoEm: anterior?.criadoEm ?? hoje(),
  }

  await naGaveta(GAVETA_RECEITAS, 'readwrite', (g) => g.put(registro))
  return registro
}

/** Apagar receita é permitido mesmo com produção no histórico: a produção copiou o nome
 *  do doce quando foi salva, então o histórico continua legível sem ela. */
export async function apagarReceita(id) {
  await naGaveta(GAVETA_RECEITAS, 'readwrite', (g) => g.delete(id))
}

// `Date.now()` tem resolução de milissegundo, e salvar duas produções em sequência rápida
// (um teste, um toque duplo) pode gerar o MESMO instante. Como a listagem ordena por este
// campo, um empate embaralha as duas — e "a última que salvei" é justamente a que ela
// procura. Cada chamada aqui é garantida estritamente maior que a anterior.
let ultimoAgoraMs = 0
function agora() {
  const t = Date.now()
  ultimoAgoraMs = t > ultimoAgoraMs ? t : ultimoAgoraMs + 1
  return new Date(ultimoAgoraMs).toISOString()
}

/** Da mais nova para a mais velha: é essa a ordem em que ela procura. */
export function listarProducoes() {
  return naGaveta(GAVETA_PRODUCOES, 'readonly', (g) => g.getAll())
    .then((linhas) => (linhas || []).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)))
}

/** `Number(null)` e `Number('')` são `0`, e `0` passa em `Number.isFinite`. Sem esta
 *  guarda, uma produção sem custo calculado entraria no histórico valendo R$ 0,00 — a
 *  mentira mais cara que este app pode contar, porque é em cima do histórico que ela
 *  decide reajustar o preço. */
function centavosObrigatorios(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? Math.round(n) : null
}

/** Grava o custo JÁ CALCULADO, e nunca recalcula na leitura.
 *
 *  É a decisão que dá sentido ao histórico: quando o leite condensado subir em novembro, a
 *  produção de agosto tem que continuar dizendo o que custou em agosto. Recalcular apagaria
 *  a única informação que essa lista oferece — a variação do custo ao longo do tempo.
 *
 *  Por isso `nomeReceita` também é copiado, e não lido da receita: apagar o doce não pode
 *  transformar o histórico em linhas sem nome. */
export async function salvarProducao(dados) {
  const custoTotalCent = centavosObrigatorios(dados?.custoTotalCent)
  const custoUnitarioCent = centavosObrigatorios(dados?.custoUnitarioCent)
  if (custoTotalCent === null || custoUnitarioCent === null) {
    throw new Error('Não dá para salvar uma produção sem custo calculado.')
  }

  const registro = {
    id: novoId('prod'),
    receitaId: dados.receitaId,
    nomeReceita: String(dados.nomeReceita ?? '').trim(),
    receitasFeitas: Number(dados.receitasFeitas),
    rendimento: Number(dados.rendimento),
    custoTotalCent,
    custoUnitarioCent,
    parcial: Boolean(dados.parcial),
    data: hoje(),
    criadoEm: agora(),
  }

  await naGaveta(GAVETA_PRODUCOES, 'readwrite', (g) => g.put(registro))
  return registro
}

export async function apagarProducao(id) {
  await naGaveta(GAVETA_PRODUCOES, 'readwrite', (g) => g.delete(id))
}
