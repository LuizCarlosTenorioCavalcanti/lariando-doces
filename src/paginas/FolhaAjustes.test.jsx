import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from '../dados/indexeddb'
import { salvarIngrediente, listarIngredientes } from '../dados/repositorio'
import { FolhaAjustes } from './FolhaAjustes'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

function arquivo(conteudo) {
  return new File([JSON.stringify(conteudo)], 'backup.json', { type: 'application/json' })
}

function montar(props = {}) {
  return render(<FolhaAjustes aberta aoFechar={() => {}} aoGravado={() => {}} {...props} />)
}

describe('FolhaAjustes', () => {
  it('oferece exportar e importar', () => {
    montar()
    expect(screen.getByRole('button', { name: /salvar backup/i })).toBeTruthy()
    expect(screen.getByLabelText(/escolher arquivo de backup/i)).toBeTruthy()
  })

  it('arquivo inválido é recusado com o motivo, sem tocar no que está salvo', async () => {
    await salvarIngrediente({ nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 })
    montar()

    await userEvent.upload(
      screen.getByLabelText(/escolher arquivo de backup/i),
      arquivo({ versao: 99, ingredientes: [], receitas: [], producoes: [] }),
    )

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent', expect.stringMatching(/vers/i),
    )
    expect(await listarIngredientes()).toHaveLength(1)
  })

  // A ficha do brief usava `ingredientes: [1, 2]` — passava pela forma (é lista) mas não
  // sobrevive à validação profunda real de `validarBackup` (cada registro precisa de `id`,
  // e ingrediente/receita de `nomeNormalizado`; ver src/dados/backup.js e backup.test.js).
  // Os registros abaixo satisfazem esse contrato mantendo a intenção do teste: um backup
  // estruturalmente válido mostra a contagem certa antes de perguntar.
  it('arquivo válido pede confirmação dizendo o tamanho do estrago', async () => {
    montar()
    await userEvent.upload(
      screen.getByLabelText(/escolher arquivo de backup/i),
      arquivo({
        versao: 1,
        ingredientes: [
          { id: 'ing_1', nome: 'Toddy', nomeNormalizado: 'toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 },
          { id: 'ing_2', nome: 'Leite', nomeNormalizado: 'leite', unidade: 'ml', embalagemQtd: 1000, embalagemPrecoCent: 450 },
        ],
        receitas: [
          { id: 'rec_1', nome: 'Brigadeiro', nomeNormalizado: 'brigadeiro', rendimentoBase: 50, margemPct: 200, itens: [] },
        ],
        producoes: [],
      }),
    )
    expect(await screen.findByText(/2 ingredientes/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /substituir tudo/i })).toBeTruthy()
  })

  it('confirmar importa e substitui', async () => {
    await salvarIngrediente({ nome: 'Antigo', unidade: 'g', embalagemQtd: 100, embalagemPrecoCent: 500 })
    const aoGravado = vi.fn()
    montar({ aoGravado })

    const novo = {
      versao: 1,
      ingredientes: [{
        id: 'ing_novo', nome: 'Toddy', nomeNormalizado: 'toddy', unidade: 'g',
        embalagemQtd: 400, embalagemPrecoCent: 1000, atualizadoEm: '2026-08-26',
      }],
      receitas: [], producoes: [],
    }

    await userEvent.upload(screen.getByLabelText(/escolher arquivo de backup/i), arquivo(novo))
    await userEvent.click(await screen.findByRole('button', { name: /substituir tudo/i }))

    await waitFor(() => expect(aoGravado).toHaveBeenCalled())
    const salvos = await listarIngredientes()
    expect(salvos).toHaveLength(1)
    expect(salvos[0].nome).toBe('Toddy')
  })

  it('cancelar não importa nada', async () => {
    await salvarIngrediente({ nome: 'Antigo', unidade: 'g', embalagemQtd: 100, embalagemPrecoCent: 500 })
    montar()

    await userEvent.upload(
      screen.getByLabelText(/escolher arquivo de backup/i),
      arquivo({ versao: 1, ingredientes: [], receitas: [], producoes: [] }),
    )
    await userEvent.click(await screen.findByRole('button', { name: /cancelar/i }))

    expect(await listarIngredientes()).toHaveLength(1)
  })
})
