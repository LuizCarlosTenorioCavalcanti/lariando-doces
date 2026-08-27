// A fronteira do armazenamento. O resto do sistema só conhece as funções daqui.
//
// Do outro lado, num Postgres, a tabela seria:
//   ingredientes (id text pk, nome text, nome_normalizado text unique, unidade text,
//                 embalagem_qtd numeric, embalagem_preco_cent int, atualizado_em date)

import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, naGaveta } from './indexeddb'
import { normalizar } from '../lib/texto'
import { hojeLocal } from '../lib/formato'

const UNIDADES = ['g', 'ml', 'un']

function novoId(prefixo) {
  return `${prefixo}_${crypto.randomUUID()}`
}

// Defesa em profundidade: `salvarIngrediente`/`salvarReceita` sempre preenchem
// `nomeNormalizado`, mas se um registro sem esse campo escapar por outro caminho (ex.: um
// backup malformado que passou pela validação), `String(... ?? '')` evita que o app inteiro
// pare de abrir por um `TypeError` no `.sort()` — o registro ruim só aparece sem nome.
function porNomeNormalizado(a, b) {
  return String(a.nomeNormalizado ?? '').localeCompare(String(b.nomeNormalizado ?? ''), 'pt-BR')
}

export function listarIngredientes() {
  return naGaveta(GAVETA_INGREDIENTES, 'readonly', (g) => g.getAll())
    .then((linhas) => (linhas || []).sort(porNomeNormalizado))
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
    atualizadoEm: precoMudou ? hojeLocal() : anterior.atualizadoEm,
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
    .then((linhas) => (linhas || []).sort(porNomeNormalizado))
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

  // A margem saiu do cadastro e é decidida na calculadora, mas continua no dado: é dela que
  // sai o preço de um doce nunca vendido (migração da v1). Numa edição, o valor gravado
  // manda — o formulário não fala mais sobre isso, e ler o silêncio dele como `null`
  // apagaria o preço do doce.
  const margem = anterior ? anterior.margemPct : dados?.margemPct
  const margemPct =
    margem === null || margem === undefined || margem === '' ? null : Number(margem)
  if (margemPct !== null && !Number.isFinite(margemPct)) {
    throw new Error('A margem não é um número.')
  }
  if (margemPct !== null && margemPct <= -100) {
    throw new Error('A margem não pode ser -100% ou menos — isso deixaria o preço em zero ou negativo.')
  }

  const registro = {
    id: id ?? novoId('rec'),
    nome,
    nomeNormalizado,
    rendimentoBase,
    margemPct,
    itens,
    criadoEm: anterior?.criadoEm ?? hojeLocal(),
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
    // `String(... ?? '')` pela mesma razão de `porNomeNormalizado`: um registro sem
    // `criadoEm` (alcançável — `validarBackup` só exige `id` de produção) não pode
    // derrubar a listagem inteira com `TypeError`.
    .then((linhas) => (linhas || [])
      .sort((a, b) => String(b.criadoEm ?? '').localeCompare(String(a.criadoEm ?? ''))))
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

/** As linhas de embalagem que a calculadora mandou, limpas e conferidas.
 *
 *  Guarda a lista mesmo quando vazia: uma produção da v1 sem o campo vira `[]`, e assim a
 *  tela nunca faz `.map` em cima de `undefined`. Recusa em vez de consertar em silêncio —
 *  número torto aqui vira custo torto no histórico, que ninguém revisa depois.
 *
 *  Presença é validada ANTES de número: `Number(null)` é `0` e passa em `Number.isFinite`,
 *  deixando linha fantasma na produção. Então: ambos em branco → descarta; um só preenchido →
 *  rejeita; ambos preenchidos → valida. */
function embalagensValidas(valor) {
  if (valor === null || valor === undefined) return []
  if (!Array.isArray(valor)) throw new Error('A embalagem precisa ser uma lista.')

  const resultado = []
  for (const linha of valor) {
    const qtdVazia = linha?.quantidade === null || linha?.quantidade === undefined || linha?.quantidade === ''
    const precoVazio = linha?.precoUnitarioCent === null || linha?.precoUnitarioCent === undefined || linha?.precoUnitarioCent === ''

    // Ambos em branco: descarta a linha em silêncio (linha do botão "+ embalagem" não usada)
    if (qtdVazia && precoVazio) continue

    // Um só preenchido: recusa (custo que desaparece em silêncio é pior que embalagem fantasma)
    if (qtdVazia || precoVazio) {
      throw new Error('Tem uma linha de embalagem pela metade — preencha quantos e quanto cada um, ou deixe os dois em branco.')
    }

    // Ambos preenchidos: valida número e negatividade
    const quantidade = Number(linha.quantidade)
    const precoUnitarioCent = Number(linha.precoUnitarioCent)
    if (!Number.isFinite(quantidade) || !Number.isFinite(precoUnitarioCent)) {
      throw new Error('Tem uma linha de embalagem sem número.')
    }
    if (quantidade < 0 || precoUnitarioCent < 0) {
      throw new Error('A embalagem não pode ter quantidade ou preço negativo.')
    }
    resultado.push({ quantidade, precoUnitarioCent })
  }
  return resultado
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
  if (custoTotalCent < 0 || custoUnitarioCent < 0) {
    throw new Error('O custo da produção não pode ser negativo.')
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
    embalagens: embalagensValidas(dados?.embalagens),
    data: hojeLocal(),
    criadoEm: agora(),
  }

  await naGaveta(GAVETA_PRODUCOES, 'readwrite', (g) => g.put(registro))
  return registro
}

export async function apagarProducao(id) {
  await naGaveta(GAVETA_PRODUCOES, 'readwrite', (g) => g.delete(id))
}
