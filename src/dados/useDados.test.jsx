import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './indexeddb'
import { salvarIngrediente } from './repositorio'
import { useDados } from './useDados'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

function Sonda() {
  const { carregando, ingredientes, ingredientesPorId } = useDados()
  if (carregando) return <p>carregando</p>
  return (
    <div>
      <p>total: {ingredientes.length}</p>
      <p>indexado: {Object.keys(ingredientesPorId).length}</p>
      {ingredientes.map((i) => <span key={i.id}>{i.nome}</span>)}
    </div>
  )
}

describe('useDados', () => {
  it('começa carregando e termina com as listas', async () => {
    await salvarIngrediente({ nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 })
    render(<Sonda />)
    expect(screen.getByText('carregando')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('total: 1')).toBeTruthy())
    expect(screen.getByText('Toddy')).toBeTruthy()
  })

  it('monta o índice por id, que é o que o motor consome', async () => {
    await salvarIngrediente({ nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 })
    await salvarIngrediente({ nome: 'Manteiga', unidade: 'g', embalagemQtd: 500, embalagemPrecoCent: 1200 })
    render(<Sonda />)
    await waitFor(() => expect(screen.getByText('indexado: 2')).toBeTruthy())
  })

  it('banco vazio termina de carregar do mesmo jeito', async () => {
    render(<Sonda />)
    await waitFor(() => expect(screen.getByText('total: 0')).toBeTruthy())
  })
})
