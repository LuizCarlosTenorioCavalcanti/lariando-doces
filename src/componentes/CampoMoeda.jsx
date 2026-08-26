import { CampoNumero } from './CampoNumero'

/** Ela digita reais; quem chama converte com `paraCentavos`. O `R$` fixo na frente do
 *  campo é o que evita ela digitar "R$ 10" e o parse recusar. */
export function CampoMoeda(props) {
  return <CampoNumero {...props} prefixo="R$" />
}
