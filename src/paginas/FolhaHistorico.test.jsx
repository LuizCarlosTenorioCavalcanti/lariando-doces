import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from '../dados/indexeddb'
import { salvarProducao, listarProducoes } from '../dados/repositorio'
import * as repositorio from '../dados/repositorio'
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

  // Sem `try/catch`, uma falha do IndexedDB (cota, banco fechado pelo navegador) sobe como
  // rejeição não tratada e a tela não muda NADA: a linha continua ali, como se o toque não
  // tivesse acontecido. Ela toca de novo, e de novo. O aviso é o que transforma "o app
  // ignorou meu toque" em "deu erro, e diz qual".
  it('falha ao apagar vira aviso na tela, não silêncio', async () => {
    const salva = await salvarProducao(PRODUCAO)
    const aoGravado = vi.fn()
    const espiao = vi.spyOn(repositorio, 'apagarProducao')
      .mockRejectedValue(new Error('O armazenamento está cheio.'))
    montar([salva], { aoGravado })

    await userEvent.click(screen.getByRole('button', { name: /apagar produção de brigadeiro/i }))

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toMatch(/armazenamento está cheio/i)
    // A produção continua na tela: o aviso não pode conviver com a linha já sumida, senão
    // ela acredita que apagou.
    expect(screen.getByText('Brigadeiro')).toBeTruthy()
    expect(aoGravado).not.toHaveBeenCalled()

    espiao.mockRestore()
  })

  // `naGaveta` rejeita com `tx.error`, e pela spec do IndexedDB esse campo só é preenchido
  // no passo de ABORT — que roda DEPOIS do evento `error`. Ou seja: a rejeição pode chegar
  // aqui como `null`. Fazer `e.message` em cima de `null` é `TypeError` calado, e a tela
  // volta a não dizer nada — exatamente o defeito que o aviso existe para matar.
  it('falha sem mensagem ainda vira aviso, não TypeError calado', async () => {
    const salva = await salvarProducao(PRODUCAO)
    const espiao = vi.spyOn(repositorio, 'apagarProducao').mockRejectedValue(null)
    montar([salva])

    await userEvent.click(screen.getByRole('button', { name: /apagar produção de brigadeiro/i }))

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent.trim().length).toBeGreaterThan(0)
    expect(aviso.textContent).not.toMatch(/undefined|null/i)

    espiao.mockRestore()
  })
})
