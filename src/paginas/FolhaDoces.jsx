import { Folha } from '../componentes/Folha'
import './paginas.css'

export function FolhaDoces({ aberta, receitas, aoFechar, aoEscolher, aoNovo }) {
  return (
    <Folha aberta={aberta} titulo="Meus doces" aoFechar={aoFechar}>
      {receitas.length === 0 ? (
        <p className="lista-vazia">Nenhum doce cadastrado ainda.</p>
      ) : (
        <ul className="lista">
          {receitas.map((r) => (
            <li key={r.id}>
              <button type="button" className="lista-item" onClick={() => aoEscolher(r)}>
                <span className="lista-item-nome">{r.nome}</span>
                <span className="lista-item-detalhe">
                  {`rende ${r.rendimentoBase} · ${r.itens.length} ingrediente${r.itens.length === 1 ? '' : 's'}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="botao-principal" onClick={aoNovo}>+ novo doce</button>
    </Folha>
  )
}
