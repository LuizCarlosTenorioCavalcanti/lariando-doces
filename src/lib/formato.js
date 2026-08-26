/** Centavos → `R$ 8,50`. `null` vira travessão, nunca `R$ 0,00`: um zero na tela é uma
 *  afirmação sobre o custo, e "não sei" não é "zero". */
export function formatBRL(centavos) {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return '—'
  return (centavos / 100)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    // O Intl separa `R$` do número com espaço estreito (U+00A0). Trocar por espaço comum
    // é o que deixa o teste comparável e o copiar-e-colar limpo.
    .replace(/ /g, ' ')
}

/** `40, 'g'` → `40 g`. Decimal com vírgula e sem zero pendurado no fim. */
export function formatarQuantidade(valor, unidade) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  const texto = Number.isInteger(valor)
    ? String(valor)
    : valor.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${texto.replace('.', ',')} ${unidade}`
}

/** `'2026-08-26'` → `'26/08/2026'`. Sem data, travessão: a tela nunca mostra vazio mudo. */
export function formatarDataBR(iso) {
  if (!iso) return '—'
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-')
  if (!ano || !mes || !dia || ano.length !== 4) return '—'
  return `${dia}/${mes}/${ano}`
}
