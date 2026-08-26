import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from '../dados/indexeddb'
import { salvarProducao, listarProducoes } from '../dados/repositorio'
import { FolhaHistorico } from './FolhaHistorico'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const PRODUCAO = {
  id: 'p1', receitaId: 'rec_1', nomeReceita: 'Brigadeiro', receitasFeitas: 1,
  rendimento: 50, custoTotalCent: 3250, custoUnitarioCent: 65, parcial: false,
  data: '2026-08-26', criadoEm: '2026-08-26T10:00:00.000Z',
}

function montar(producoes, props = {}) {
  return render(
    <FolhaHistorico
      aberta
      producoes={producoes}
      aoFechar={() => {}}
      aoGravado={() => {}}
      {...props}
    />,
  )
}

describe('FolhaHistorico', () => {
  it('vazio explica em vez de mostrar lista em branco', () => {
    montar([])
    expect(screen.getByText(/nenhuma produção salva/i)).toBeTruthy()
  })

  it('mostra data, doce, rendimento e os dois custos', () => {
    montar([PRODUCAO])
    expect(screen.getByText('Brigadeiro')).toBeTruthy()
    expect(screen.getByText(/26\/08\/2026/)).toBeTruthy()
    expect(screen.getByText(/rendeu 50/)).toBeTruthy()
    expect(screen.getByText(/R\$ 32,50/)).toBeTruthy()
    expect(screen.getByText(/R\$ 0,65 cada/)).toBeTruthy()
  })

  it('mostra que a receita foi feita mais de uma vez', () => {
    montar([{ ...PRODUCAO, receitasFeitas: 2, rendimento: 100 }])
    expect(screen.getByText(/2 receitas/)).toBeTruthy()
  })

  it('marca a produção parcial, para o número não ser lido como verdade inteira', () => {
    montar([{ ...PRODUCAO, parcial: true }])
    expect(screen.getByText(/parcial/i)).toBeTruthy()
  })

  it('apaga uma produção', async () => {
    const salva = await salvarProducao(PRODUCAO)
    const aoGravado = vi.fn()
    montar([salva], { aoGravado })

    await userEvent.click(screen.getByRole('button', { name: /apagar produção de brigadeiro/i }))
    await waitFor(() => expect(aoGravado).toHaveBeenCalled())
    expect(await listarProducoes()).toEqual([])
  })
})
