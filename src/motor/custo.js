// Todo o cálculo do sistema mora aqui, em função pura. Não importa `react`, não importa
// nada de `dados/`: dá para provar cada regra sem DOM e sem banco, e é por isso que este
// é o arquivo com mais teste do projeto.
//
// Dinheiro circula em CENTAVOS. Internamente as contas usam float (dividir 790 por 395 não
// dá inteiro), e o arredondamento acontece uma vez só, na saída de `custoDaProducao`.

/** Custo de um item da receita, em centavos.
 *
 *  `null` quando não dá para saber — ingrediente sem preço, ingrediente apagado,
 *  embalagem zerada. Nunca `0`: zero é uma afirmação ("isto é de graça") e some na soma
 *  sem deixar rastro, que é o jeito mais curto de ela precificar abaixo do custo. */
export function custoDoItem(item, ingrediente) {
  if (!ingrediente) return null

  const { embalagemQtd, embalagemPrecoCent } = ingrediente
  if (embalagemPrecoCent === null || embalagemPrecoCent === undefined) return null
  if (!Number.isFinite(embalagemPrecoCent)) return null
  if (!Number.isFinite(embalagemQtd) || embalagemQtd <= 0) return null

  const quantidade = Number(item?.quantidade)
  if (!Number.isFinite(quantidade)) return null

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
export function custoDaProducao({ receita, ingredientesPorId, receitasFeitas, rendimento }) {
  const { totalCent, semPreco } = custoDaReceita(receita, ingredientesPorId)

  const nReceitas = Number(receitasFeitas)
  const temReceitas = Number.isFinite(nReceitas) && nReceitas > 0
  const totalProducao = temReceitas ? totalCent * nReceitas : null

  const rend = Number(rendimento)
  const temRendimento = Number.isFinite(rend) && rend > 0

  return {
    custoTotalCent: totalProducao === null ? null : Math.round(totalProducao),
    // Arredondado AQUI, e é este valor que o preço de venda usa depois. Derivar a venda do
    // valor cheio produziria "cada R$ 0,65, vender a R$ 1,94" na tela, que lê como erro de
    // conta.
    custoUnitarioCent:
      totalProducao !== null && temRendimento ? Math.round(totalProducao / rend) : null,
    parcial: semPreco.length > 0,
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

/** Lucro da fornada inteira. */
export function lucroDaProducao(custoUnitarioCent, precoCent, rendimento) {
  if (custoUnitarioCent === null || precoCent === null) return null
  if (!Number.isFinite(custoUnitarioCent) || !Number.isFinite(precoCent)) return null

  const rend = Number(rendimento)
  if (!Number.isFinite(rend) || rend <= 0) return null

  return Math.round((precoCent - custoUnitarioCent) * rend)
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
