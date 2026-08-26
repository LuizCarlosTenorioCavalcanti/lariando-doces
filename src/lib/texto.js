/** Nome comparável: sem acento, sem maiúscula, sem espaço sobrando.
 *  É o que faz "Açúcar" e "acucar" serem o mesmo ingrediente — sem isso ela cadastraria
 *  o mesmo pote duas vezes e o custo sairia dobrado. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
