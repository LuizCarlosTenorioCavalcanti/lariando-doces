// O teclado do celular brasileiro manda vírgula; alguns mandam ponto. Ler os dois não é
// gentileza, é requisito: um campo que rejeita "8,50" faz ela desistir na terceira tentativa.

/** Texto do campo → número. `null` quando não dá para ler um número inteiro dali. */
export function paraNumero(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null
  if (texto === null || texto === undefined) return null

  const limpo = String(texto).trim().replace(/\s/g, '')
  if (limpo === '') return null

  // Se tem vírgula, ela é o decimal e o ponto só pode ser milhar ("1.200,50"). Sem
  // vírgula, o ponto é o decimal ("8.50"). Tratar os dois como decimal ao mesmo tempo
  // faria "1.200" virar 1,2 — um erro de mil vezes no preço da embalagem.
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null

  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

/** Reais digitados → centavos inteiros. `"8,50"` → `850`. */
export function paraCentavos(texto) {
  const n = paraNumero(texto)
  if (n === null) return null
  return Math.round(n * 100)
}

/** Centavos → o texto que vai DENTRO de um campo: `195` → `"1,95"`.
 *
 *  É a volta de `paraCentavos`, e existe porque `formatBRL` não serve: aquele põe `R$` e
 *  separador de milhar, e os dois atrapalham quem vai editar o número. Sem valor devolve
 *  vazio, não travessão — travessão é para leitura, campo vazio é para digitação. */
export function centavosParaCampo(centavos) {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return ''
  return (centavos / 100).toFixed(2).replace('.', ',')
}
