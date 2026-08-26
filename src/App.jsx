import { useCallback, useState } from 'react'
import { useDados } from './dados/useDados'
import './styles/app.css'

export default function App() {
  const dados = useDados()
  const [folha, setFolha] = useState(null)

  const semDoce = !dados.carregando && dados.receitas.length === 0

  const abrirAjustes = useCallback(() => setFolha('ajustes'), [])
  const abrirNovo = useCallback(() => setFolha('novo'), [])

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
      </main>
    </div>
  )
}
