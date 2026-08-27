import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './dados/indexeddb'
import { listarProducoes } from './dados/repositorio'
import App from './App.jsx'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

describe('primeiro uso', () => {
  it('do app vazio ao preço do brigadeiro', async () => {
    render(<App />)

    // 1. Nada cadastrado: o app convida em vez de mostrar formulário mudo.
    await userEvent.click(
      await screen.findByRole('button', { name: /cadastrar meu primeiro doce/i }),
    )

    // 2. O doce. A margem saiu do cadastro na Task 11 — ela decide o preço na calculadora.
    await userEvent.type(screen.getByLabelText('Nome do doce'), 'Brigadeiro')
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '50')

    // 3. Primeiro ingrediente, cadastrado ali mesmo, sem sair da folha.
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Leite condensado')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Leite condensado"/i }))
    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'g')
    await userEvent.type(screen.getByLabelText(/quanto vem na embalagem/i), '395')
    await userEvent.type(screen.getByLabelText(/preço da embalagem/i), '6,50')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))

    await waitFor(() => expect(screen.getByText('(395 g — R$ 6,50)')).toBeTruthy())
    await userEvent.type(screen.getByLabelText('Quantidade 1'), '790')

    // 4. Segundo ingrediente, em unidade e não em grama.
    await userEvent.click(screen.getByRole('button', { name: '+ ingrediente' }))
    await userEvent.type(screen.getByLabelText('Ingrediente 2'), 'Forminha')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Forminha"/i }))
    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'un')
    await userEvent.type(screen.getByLabelText(/quanto vem na embalagem/i), '100')
    await userEvent.type(screen.getByLabelText(/preço da embalagem/i), '5,20')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))

    await waitFor(() => expect(screen.getByText('(100 un — R$ 5,20)')).toBeTruthy())
    await userEvent.type(screen.getByLabelText('Quantidade 2'), '50')

    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))

    // 5. De volta à tela principal, o custo já está lá — ela não digitou rendimento nenhum.
    // R$ 13,00 de leite + R$ 2,60 de forminha = R$ 15,60, dividido por 50.
    await waitFor(() => {
      expect(screen.getByTestId('custo-total').textContent).toBe('R$ 15,60')
    })
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,31')
    // Doce nunca vendido abre sem preço: a margem saiu do cadastro, e ela ainda não disse
    // por quanto vende. É a primeira e única vez que ela digita isso para este doce.
    expect(screen.getByLabelText(/vender a/i).value).toBe('')

    // 5b. Ela decide o preço. Margem e lucro saem sozinhos — é a conta que ela fazia no papel.
    await userEvent.type(screen.getByLabelText(/vender a/i), '0,93')
    expect(screen.getByLabelText(/margem/i).value).toBe('200')
    expect(screen.getByLabelText(/lucro/i).value).toBe('31,00')

    // 6. Hoje rendeu diferente: o total não muda, o preço por unidade muda. O preço que ela
    // digitou fica de pé; quem se move é a margem, que era 200 e agora é maior porque cada
    // doce ficou mais barato de fazer.
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '60')
    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 15,60')
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,26')
    expect(screen.getByLabelText(/vender a/i).value).toBe('0,93')
    expect(screen.getByLabelText(/margem/i).value).toBe('258')
    expect(screen.getByLabelText(/lucro/i).value).toBe('40,20')

    // 7. Salvar a produção grava o custo e o preço congelados.
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produção' }))
    await waitFor(async () => {
      const producoes = await listarProducoes()
      expect(producoes).toHaveLength(1)
      expect(producoes[0].nomeReceita).toBe('Brigadeiro')
      expect(producoes[0].rendimento).toBe(60)
      expect(producoes[0].custoTotalCent).toBe(1560)
      expect(producoes[0].custoUnitarioCent).toBe(26)
      // O preço de venda entra congelado no histórico: é o que ela cobrou naquele dia,
      // e não se move quando o ingrediente subir depois.
      expect(producoes[0].precoVendaCent).toBe(93)
    })

    // 8. E aparece no histórico. A folha sobe por cima, mas a tela principal continua no
    // DOM atrás dela (é assim que a Folha funciona desde as tasks anteriores) — por isso a
    // busca é escopada ao diálogo, senão "Brigadeiro" também bate na opção do seletor de
    // doces que ficou por baixo.
    await userEvent.click(screen.getByRole('button', { name: 'Histórico' }))
    const historico = within(await screen.findByRole('dialog', { name: 'Histórico' }))
    expect(await historico.findByText('Brigadeiro')).toBeTruthy()
    expect(historico.getByText(/rendeu 60/)).toBeTruthy()
  })
})
