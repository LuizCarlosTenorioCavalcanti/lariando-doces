import { useEffect } from 'react'
import './folha.css'

/** A folha que sobe de baixo. É ela que permite a promessa "abriu, escolheu, viu o preço":
 *  cadastro e histórico existem sem nunca engordar a tela principal. */
export function Folha({ aberta, titulo, aoFechar, children }) {
  useEffect(() => {
    if (!aberta) return

    const aoTeclar = (e) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)

    // Sem travar o corpo, rolar dentro da folha até o fim continua rolando a página atrás
    // dela — no celular a tela principal "escapa" por baixo e ela perde o lugar.
    const rolagemAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = rolagemAnterior
    }
  }, [aberta, aoFechar])

  if (!aberta) return null

  return (
    <div className="folha-fundo" data-testid="folha-fundo" onClick={aoFechar}>
      <div
        className="folha"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="folha-topo">
          <h2>{titulo}</h2>
          <button type="button" className="folha-fechar" onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="folha-corpo">{children}</div>
      </div>
    </div>
  )
}
