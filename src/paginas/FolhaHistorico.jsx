import { Folha } from '../componentes/Folha'
import { apagarProducao } from '../dados/repositorio'
import { formatBRL, formatarDataBR } from '../lib/formato'
import './paginas.css'

export function FolhaHistorico({ aberta, producoes, aoFechar, aoGravado }) {
  async function apagar(p) {
    await apagarProducao(p.id)
    await aoGravado()
  }

  return (
    <Folha aberta={aberta} titulo="Histórico" aoFechar={aoFechar}>
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
