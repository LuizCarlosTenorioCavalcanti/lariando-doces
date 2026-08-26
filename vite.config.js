import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/lariando-doces/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testes/preparo.js'],
    // `_scratch/` é andaime: é onde um revisor escreve o caso que PROVA um defeito, e
    // esse caso falha de propósito. Sem esta linha a prova de um agente pinta a suíte de
    // vermelho para todo mundo.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
