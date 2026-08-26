import { useCallback, useState } from 'react'
import { useDados } from './dados/useDados'
import { Calculadora } from './paginas/Calculadora'
import { FolhaAjustes } from './paginas/FolhaAjustes'
import { FolhaDoces } from './paginas/FolhaDoces'
import { FolhaEditarDoce } from './paginas/FolhaEditarDoce'
import { FolhaHistorico } from './paginas/FolhaHistorico'
import { FolhaIngredientes } from './paginas/FolhaIngredientes'
import './styles/app.css'

export default function App() {
  const dados = useDados()
  const [folha, setFolha] = useState(null)
  const [receitaEditando, setReceitaEditando] = useState(null)

  const semDoce = !dados.carregando && dados.receitas.length === 0

  const abrirAjustes = useCallback(() => setFolha('ajustes'), [])
  const abrirNovo = useCallback(() => { setReceitaEditando(null); setFolha('novo') }, [])
  const fecharFolha = useCallback(() => setFolha(null), [])
  const escolherReceita = useCallback((r) => { setReceitaEditando(r); setFolha('editar') }, [])
  const abrirDoces = useCallback(() => setFolha('doces'), [])
  const abrirHistorico = useCallback(() => setFolha('historico'), [])

  return (
    <div className="app">
      <header className="app-topo">
        <h1>Lariano Doces</h1>
        <button
          type="button"
          className="app-ajustes"
          aria-label="Ajustes"
          onClick={abrirAjustes}
        >
          ⚙
        </button>
      </header>

      {dados.erro ? <p className="aviso aviso-erro" role="alert">{dados.erro}</p> : null}

      <main className="app-corpo">
        {dados.carregando ? <p className="app-carregando">carregando…</p> : null}

        {semDoce ? (
          <section className="vazio">
            <p>Você ainda não cadastrou nenhum doce.</p>
            <button type="button" className="botao-principal" onClick={abrirNovo}>
              Cadastrar meu primeiro doce
            </button>
          </section>
        ) : null}

        {!dados.carregando && dados.receitas.length > 0 ? (
          <Calculadora
            receitas={dados.receitas}
            ingredientesPorId={dados.ingredientesPorId}
            producoes={dados.producoes}
            aoAbrirDoces={abrirDoces}
            aoAbrirHistorico={abrirHistorico}
            aoGravado={dados.recarregar}
          />
        ) : null}
      </main>

      <FolhaAjustes
        aberta={folha === 'ajustes'}
        aoFechar={fecharFolha}
        aoGravado={dados.recarregar}
      />

      <FolhaDoces
        aberta={folha === 'doces'}
        receitas={dados.receitas}
        aoFechar={fecharFolha}
        aoEscolher={escolherReceita}
        aoNovo={abrirNovo}
      />

      {folha === 'editar' || folha === 'novo' ? (
        <FolhaEditarDoce
          // A chave é o que remonta o formulário ao trocar de doce. Sem ela, abrir o
          // beijinho depois do brigadeiro mostraria os campos do brigadeiro.
          key={receitaEditando?.id ?? 'novo'}
          aberta
          receita={folha === 'novo' ? null : receitaEditando}
          ingredientes={dados.ingredientes}
          aoFechar={fecharFolha}
          aoGravado={dados.recarregar}
        />
      ) : null}

      <FolhaIngredientes
        aberta={folha === 'ingredientes'}
        ingredientes={dados.ingredientes}
        aoFechar={fecharFolha}
        aoGravado={dados.recarregar}
      />

      <FolhaHistorico
        aberta={folha === 'historico'}
        producoes={dados.producoes}
        aoFechar={fecharFolha}
        aoGravado={dados.recarregar}
      />
    </div>
  )
}
