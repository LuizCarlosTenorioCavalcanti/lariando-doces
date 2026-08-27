import { useState } from 'react'
import { Folha } from '../componentes/Folha'
import { apagarProducao } from '../dados/repositorio'
import { formatBRL, formatarDataBR } from '../lib/formato'
import './paginas.css'

export function FolhaHistorico({ aberta, producoes, aoFechar, aoGravado }) {
  const [erro, setErro] = useState(null)

  // Sem o `try`, uma falha do IndexedDB sobe como rejeição não tratada e a tela não muda
  // nada — a linha fica onde estava, como se o toque não tivesse acontecido, e ela toca de
  // novo. E `aoGravado` fica DENTRO do `try`: recarregar depois de uma falha só repintaria
  // a mesma lista, dando ar de sucesso ao que não deu certo.
  async function apagar(p) {
    setErro(null)
    try {
      await apagarProducao(p.id)
      await aoGravado()
    } catch (e) {
      // `e?.message` e não `e.message`: `naGaveta` rejeita com `tx.error`, que pela spec do
      // IndexedDB só é preenchido no passo de abort — depois do evento `error`. A rejeição
      // pode chegar `null`, e aí `e.message` é `TypeError` calado: a tela voltaria a não
      // dizer nada, que é o defeito que este aviso existe para matar.
      setErro(e?.message ?? 'Não consegui apagar essa produção. Tente de novo.')
    }
  }

  return (
    <Folha aberta={aberta} titulo="Histórico" aoFechar={aoFechar}>
      {erro ? <p className="aviso aviso-erro" role="alert">{erro}</p> : null}

      {producoes.length === 0 ? (
        <p className="lista-vazia">
          Nenhuma produção salva ainda. Calcule um doce e toque em “Salvar produção”.
        </p>
      ) : null}

      <ul className="lista">
        {producoes.map((p) => (
          <li key={p.id} className="historico-item">
            <div className="historico-texto">
              <span className="lista-item-nome">{p.nomeReceita}</span>
              <span className="lista-item-detalhe">
                {`${formatarDataBR(p.data)} · ${p.receitasFeitas} receita${p.receitasFeitas === 1 ? '' : 's'} · rendeu ${p.rendimento}`}
              </span>
              <span className="lista-item-detalhe">
                {`${formatBRL(p.custoTotalCent)} · ${formatBRL(p.custoUnitarioCent)} cada`}
                {p.parcial ? ' · parcial' : ''}
              </span>
            </div>
            <button
              type="button"
              className="linha-tirar"
              aria-label={`Apagar produção de ${p.nomeReceita}`}
              onClick={() => apagar(p)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </Folha>
  )
}
