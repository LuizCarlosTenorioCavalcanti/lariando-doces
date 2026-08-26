import { Component } from 'react'

/** Pega erro de RENDER que nenhum try/catch alcança — ex.: um dado que escapou da
 *  validação do backup e quebra um `.map()` no meio da tela. Sem isto, esse erro é tela
 *  branca sem explicação nenhuma, e ela não tem console para saber o que houve. */
export class ParaquedasDeErro extends Component {
  constructor(props) {
    super(props)
    this.state = { comErro: false }
  }

  static getDerivedStateFromError() {
    return { comErro: true }
  }

  componentDidCatch(erro, info) {
    console.error(erro, info)
  }

  render() {
    if (this.state.comErro) {
      return (
        <div className="vazio" role="alert">
          <p>Algo deu errado. Recarregar deve resolver.</p>
          <button type="button" className="botao-principal" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
