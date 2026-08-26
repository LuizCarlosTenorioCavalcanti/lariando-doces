import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Só em produção: em desenvolvimento o service worker serve versão velha e faz o `npm run
// dev` parecer quebrado depois de cada edição.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Sem service worker o app ainda funciona; só não abre offline. Não é motivo para
      // estourar erro na cara dela.
    })
  })
}
