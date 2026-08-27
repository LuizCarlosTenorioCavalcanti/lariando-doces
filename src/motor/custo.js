// Todo o cálculo do sistema mora aqui, em função pura. Não importa `react`, não importa
// nada de `dados/`: dá para provar cada regra sem DOM e sem banco, e é por isso que este
// é o arquivo com mais teste do projeto.
//
// Dinheiro circula em CENTAVOS. Internamente as contas usam float (dividir 790 por 395 não
// dá inteiro), e o arredondamento acontece uma vez só, na saída de `custoDaProducao`.

/** Custo de um item da receita, em centavos.
 *
 *  `null` quando não dá para saber — ingrediente sem preço, ingrediente apagado,
 *  embalagem zerada, quantidade não numérica ou quantidade negativa. Quantidade negativa
 *  não existe no mundo (não se usa "menos vinte gramas" de manteiga): é dedo errado no
 *  campo, e dedo errado não pode baratear o doce. Nunca `0` num caso de erro: zero é uma
 *  afirmação ("isto é de graça") e some na soma sem deixar rastro, que é o jeito mais curto
 *  de ela precificar abaixo do custo. */
export function custoDoItem(item, ingrediente) {
  if (!ingrediente) return null

  const { embalagemQtd, embalagemPrecoCent } = ingrediente
  if (embalagemPrecoCent === null || embalagemPrecoCent === undefined) return null
  if (!Number.isFinite(embalagemPrecoCent)) return null
  if (!Number.isFinite(embalagemQtd) || embalagemQtd <= 0) return null

  const quantidade = Number(item?.quantidade)
  if (!Number.isFinite(quantidade) || quantidade < 0) return null

  return (quantidade / embalagemQtd) * embalagemPrecoCent
}

/** Soma de UMA receita. Devolve o que deu para somar e o nome do que faltou — as duas
 *  coisas juntas, porque quem chama precisa mostrar as duas juntas. */
export function custoDaReceita(receita, ingredientesPorId) {
  let totalCent = 0
  const semPreco = []

  for (const item of receita?.itens ?? []) {
    const ingrediente = ingredientesPorId?.[item.ingredienteId]
    const custo = custoDoItem(item, ingrediente)
    if (custo === null) {
      semPreco.push(ingrediente?.nome ?? 'ingrediente apagado')
      continue
    }
    totalCent += custo
  }

  return { totalCent, semPreco }
}

/** A conta que a tela mostra.
 *
 *  O número de receitas manda no total (é quanto ingrediente saiu do armário); o
 *  rendimento manda em por quantas unidades esse total se divide. Separar os dois é o que
 *  faz "a mesma panela rendeu 65 hoje" ficar certo — se o app assumisse proporcional,
 *  cobraria 30% a mais de ingrediente que ela não usou. */
export function custoDaProducao({
  receita, ingredientesPorId, receitasFeitas, rendimento, embalagens,
}) {
  const { totalCent, semPreco } = custoDaReceita(receita, ingredientesPorId)
  const embalagem = custoDasEmbalagens(embalagens)

  const nReceitas = Number(receitasFeitas)
  const temReceitas = Number.isFinite(nReceitas) && nReceitas > 0
  // A embalagem entra SOMANDO, fora do `× nReceitas`: ela digitou quantas usou de verdade.
  const totalProducao = temReceitas ? totalCent * nReceitas + embalagem.totalCent : null

  const rend = Number(rendimento)
  const temRendimento = Number.isFinite(rend) && rend > 0

  return {
    custoTotalCent: totalProducao === null ? null : Math.round(totalProducao),
    // Arredondado AQUI, e é este valor que o preço de venda usa depois. Derivar a venda do
    // valor cheio produziria "cada R$ 0,65, vender a R$ 1,94" na tela, que lê como erro de
    // conta.
    custoUnitarioCent:
      totalProducao !== null && temRendimento ? Math.round(totalProducao / rend) : null,
    parcial: semPreco.length > 0 || embalagem.incompleta,
    semPreco,
  }
}

/** Preço de venda a partir do custo unitário JÁ ARREDONDADO.
 *  A ordem importa: é assim que `0,65 × 3 = 1,95` fecha a olho na tela. */
export function precoSugerido(custoUnitarioCent, margemPct) {
  if (custoUnitarioCent === null || custoUnitarioCent === undefined) return null
  if (!Number.isFinite(custoUnitarioCent)) return null

  const margem = Number(margemPct)
  if (margemPct === null || margemPct === undefined || !Number.isFinite(margem)) return null

  return Math.round(custoUnitarioCent * (1 + margem / 100))
}

/** A volta de `precoSugerido`: preço de venda → margem, em porcentagem.
 *
 *  Devolve o número CHEIO, sem arredondar. Quem mostra na tela arredonda para % inteiro; a
 *  conta fica com a precisão toda para a ida e a volta fecharem. Arredondar aqui faria o
 *  preço "pular" sob o dedo dela quando os dois campos estão ligados. */
export function margemDoPreco(custoUnitarioCent, precoCent) {
  if (custoUnitarioCent === null || custoUnitarioCent === undefined) return null
  if (precoCent === null || precoCent === undefined) return null
  if (!Number.isFinite(custoUnitarioCent) || !Number.isFinite(precoCent)) return null
  // Margem é lucro POR custo. Sem custo não há por quê dividir, e `Infinity` na tela é pior
  // que travessão: parece número.
  if (custoUnitarioCent === 0) return null

  return ((precoCent - custoUnitarioCent) / custoUnitarioCent) * 100
}

/** A volta de `lucroDaProducao`: quanto ela quer tirar da fornada → por quanto vender cada um. */
export function precoDoLucro(custoUnitarioCent, lucroCent, rendimento) {
  if (custoUnitarioCent === null || custoUnitarioCent === undefined) return null
  if (lucroCent === null || lucroCent === undefined) return null
  if (!Number.isFinite(custoUnitarioCent) || !Number.isFinite(lucroCent)) return null

  const rend = Number(rendimento)
  if (!Number.isFinite(rend) || rend <= 0) return null

  return Math.round(custoUnitarioCent + lucroCent / rend)
}

/** Lucro da fornada inteira. */
export function lucroDaProducao(custoUnitarioCent, precoCent, rendimento) {
  if (custoUnitarioCent === null || precoCent === null) return null
  if (!Number.isFinite(custoUnitarioCent) || !Number.isFinite(precoCent)) return null

  const rend = Number(rendimento)
  if (!Number.isFinite(rend) || rend <= 0) return null

  return Math.round((precoCent - custoUnitarioCent) * rend)
}

/** Um campo preenchido vira número; vazio, em branco ou ilegível vira `null`.
 *  Distinguir "não preencheu" de "preencheu zero" é o que separa a linha que o
 *  "+ embalagem" acabou de criar da linha que diz "não usei caixa nenhuma". */
function numeroPreenchido(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/** Custo da embalagem de UMA produção, em centavos.
 *
 *  A embalagem não é cadastrada em lugar nenhum: ela digita quantos e quanto custou cada um,
 *  na hora. É o mesmo campo para a forminha (65 × R$ 0,05) e para a caixa (1 × R$ 2,50).
 *
 *  Lista vazia devolve `0`, e aqui isso é DE PROPÓSITO — o contrário da regra de
 *  `custoDoItem`. Ingrediente sem preço é informação que FALTA, e virar zero esconderia
 *  custo. Embalagem sem linha é informação que EXISTE: ela mandou em pote retornável, e
 *  retornável custa zero mesmo. */
export function custoDasEmbalagens(embalagens) {
  let totalCent = 0
  let incompleta = false

  for (const linha of embalagens ?? []) {
    const quantidade = numeroPreenchido(linha?.quantidade)
    const preco = numeroPreenchido(linha?.precoUnitarioCent)

    // Nada preenchido: é a linha recém-criada pelo "+ embalagem". Alarme aqui ensinaria
    // ela a ignorar o alarme.
    if (quantidade === null && preco === null) continue

    // Metade preenchida é o estado de quem está digitando agora. Somar só a metade que dá
    // (tratando a outra como zero) esconderia custo em silêncio, que é o pior desfecho.
    if (quantidade === null || preco === null) {
      incompleta = true
      continue
    }
    if (quantidade < 0 || preco < 0) {
      incompleta = true
      continue
    }

    totalCent += quantidade * preco
  }

  return { totalCent, incompleta }
}

/** Quanto o rendimento pode fugir do normal antes de virar suspeita. Enrolar maior ou
 *  menor muda o rendimento em 10~20% num dia qualquer; 40% já não é a mão, é o dedo. */
export const TOLERANCIA_RENDIMENTO = 0.4

/** `true` quando o rendimento por receita foge demais do normal daquele doce.
 *
 *  Avisa, não bloqueia — ela pode ter feito bolinha de festa infantil, bem menor. O aviso
 *  existe porque precificar em cima de um custo errado só aparece no fim do mês, quando o
 *  doce já foi vendido barato a semana inteira.
 *
 *  Na primeira produção do doce não há com o que comparar, e um alarme sem referência é
 *  ruído que ensina a ignorar o alarme. */
export function rendimentoSuspeito({
  rendimento, receitasFeitas, rendimentoBase, temProducaoAnterior,
}) {
  if (!temProducaoAnterior) return false

  const rend = Number(rendimento)
  const nReceitas = Number(receitasFeitas)
  const base = Number(rendimentoBase)

  if (!Number.isFinite(rend) || rend <= 0) return false
  if (!Number.isFinite(nReceitas) || nReceitas <= 0) return false
  if (!Number.isFinite(base) || base <= 0) return false

  const porReceita = rend / nReceitas
  return Math.abs(porReceita - base) / base > TOLERANCIA_RENDIMENTO
}
