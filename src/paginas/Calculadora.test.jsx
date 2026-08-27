import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from '../dados/indexeddb'
import { Calculadora } from './Calculadora'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

// O brigadeiro da spec: uma receita rende 50 e custa R$ 32,50.
const LEITE = { id: 'i1', nome: 'Leite condensado', unidade: 'g', embalagemQtd: 395, embalagemPrecoCent: 650 }
const GRANULADO = { id: 'i2', nome: 'Granulado', unidade: 'g', embalagemQtd: 500, embalagemPrecoCent: 1500 }
const CREME = { id: 'i3', nome: 'Creme de leite', unidade: 'g', embalagemQtd: 200, embalagemPrecoCent: 500 }
const MANTEIGA = { id: 'i4', nome: 'Manteiga', unidade: 'g', embalagemQtd: 500, embalagemPrecoCent: 1200 }
const TODDY = { id: 'i5', nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }
const FORMINHA = { id: 'i6', nome: 'Forminha', unidade: 'un', embalagemQtd: 100, embalagemPrecoCent: 520 }

const PORID = { i1: LEITE, i2: GRANULADO, i3: CREME, i4: MANTEIGA, i5: TODDY, i6: FORMINHA }

const BRIGADEIRO = {
  id: 'rec_1', nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
  itens: [
    { ingredienteId: 'i1', quantidade: 790 },
    { ingredienteId: 'i2', quantidade: 250 },
    { ingredienteId: 'i3', quantidade: 200 },
    { ingredienteId: 'i4', quantidade: 100 },
    { ingredienteId: 'i5', quantidade: 80 },
    { ingredienteId: 'i6', quantidade: 50 },
  ],
}

const OUTRO_DOCE = { id: 'rec_2', nome: 'Beijinho', rendimentoBase: 40, margemPct: null, itens: [] }

function montar(props = {}) {
  return render(
    <Calculadora
      receitas={[BRIGADEIRO]}
      ingredientesPorId={PORID}
      producoes={[]}
      aoAbrirDoces={() => {}}
      aoAbrirIngredientes={() => {}}
      aoAbrirHistorico={() => {}}
      aoGravado={() => {}}
      {...props}
    />,
  )
}

// A embalagem abre atrás de um chip (item 5) — abrir é sempre o primeiro passo de quem
// vai mexer nela.
async function abrirEmbalagem() {
  await userEvent.click(screen.getByTestId('embalagem-chip'))
}

describe('Calculadora', () => {
  it('escolhido o doce, o preço já aparece sem ela digitar nada', () => {
    montar()
    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 32,50')
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,65')
  })

  it('sugere o rendimento normal do doce no campo', () => {
    montar()
    expect(screen.getByLabelText(/rendeu quantos/i).getAttribute('placeholder')).toBe('50')
  })

  it('mudar o rendimento muda o preço por unidade e não o total', async () => {
    montar()
    const campo = screen.getByLabelText(/rendeu quantos/i)
    await userEvent.type(campo, '65')
    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 32,50')
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,50')
  })

  it('duas receitas dobram o total', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /1 receita/i }))
    const receitas = screen.getByLabelText(/quantas receitas/i)
    await userEvent.clear(receitas)
    await userEvent.type(receitas, '2')
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '100')

    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 65,00')
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,65')
  })

  it('mostra preço de venda e lucro, e a conta fecha a olho', () => {
    montar()
    expect(screen.getByLabelText(/vender a/i).value).toBe('1,95')
    expect(screen.getByLabelText(/lucro/i).value).toBe('65,00')
  })

  // Este mudou de sentido, e o nome tem que mudar junto: o bloco de venda não some mais por
  // falta de margem — ele aparece vazio, esperando ela decidir o preço.
  it('doce sem margem da v1 mostra o bloco de venda vazio, não escondido', () => {
    montar({ receitas: [{ ...BRIGADEIRO, margemPct: null }] })
    expect(screen.getByLabelText(/vender a/i).value).toBe('')
  })

  it('digitar o preço mostra a margem e o lucro daquele preço', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/vender a/i))
    await userEvent.type(screen.getByLabelText(/vender a/i), '1,95')

    expect(screen.getByLabelText(/margem/i).value).toBe('200')
    expect(screen.getByLabelText(/lucro/i).value).toBe('65,00')
  })

  it('digitar a margem mostra o preço e o lucro', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/margem/i))
    await userEvent.type(screen.getByLabelText(/margem/i), '200')

    expect(screen.getByLabelText(/vender a/i).value).toBe('1,95')
    expect(screen.getByLabelText(/lucro/i).value).toBe('65,00')
  })

  it('digitar o lucro que ela quer mostra por quanto vender', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/lucro/i))
    await userEvent.type(screen.getByLabelText(/lucro/i), '65,00')

    expect(screen.getByLabelText(/vender a/i).value).toBe('1,95')
    expect(screen.getByLabelText(/margem/i).value).toBe('200')
  })

  // O teste que mais importa: é o que prova que a tela não pula sob o dedo dela. Se o app
  // reescrevesse o campo digitado com o valor derivado-e-arredondado, "1,9" viraria outra
  // coisa no meio da digitação e o campo viraria uma luta.
  it('o campo que ela está digitando nunca é reescrito pelo app', async () => {
    montar()
    const preco = screen.getByLabelText(/vender a/i)
    await userEvent.clear(preco)
    await userEvent.type(preco, '1,9')

    expect(preco.value).toBe('1,9')
  })

  it('trocar de campo passa a mandar, começando do valor que estava na tela', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/vender a/i))
    await userEvent.type(screen.getByLabelText(/vender a/i), '1,95')
    await userEvent.clear(screen.getByLabelText(/margem/i))
    await userEvent.type(screen.getByLabelText(/margem/i), '300')

    expect(screen.getByLabelText(/vender a/i).value).toBe('2,60')
  })

  it('margem de -100% ou menos avisa em vez de mostrar preço negativo', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/margem/i))
    await userEvent.type(screen.getByLabelText(/margem/i), '-150')

    expect(screen.getByLabelText(/vender a/i).value).toBe('')
    expect(screen.getByText(/deixaria o preço em zero ou negativo/i)).toBeTruthy()
  })

  it('preço negativo digitado avisa em vez de mostrar margem e lucro', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/vender a/i))
    await userEvent.type(screen.getByLabelText(/vender a/i), '-1,00')

    expect(screen.getByLabelText(/margem/i).value).toBe('')
    expect(screen.getByText(/zero ou negativo/i)).toBeTruthy()
  })

  // Custo unitário ZERO (não "sem custo"): todos os ingredientes sem preço. Preço e lucro
  // funcionam; margem é divisão por zero e fica em branco em vez de virar Infinity.
  it('doce com todo ingrediente sem preço mostra preço e lucro, mas margem em branco', async () => {
    montar({ ingredientesPorId: {} })
    await userEvent.clear(screen.getByLabelText(/vender a/i))
    await userEvent.type(screen.getByLabelText(/vender a/i), '1,95')

    expect(screen.getByLabelText(/margem/i).value).toBe('')
    expect(screen.getByLabelText(/lucro/i).value).toBe('97,50')
  })

  // Rendimento zero é o ÚNICO caminho para custo unitário null: sem rendimento não há por
  // quantos dividir, e sem custo por unidade não há o que precificar.
  it('rendimento zerado esconde o bloco de venda inteiro', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/rendeu quantos/i))
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '0')

    expect(screen.queryByLabelText(/vender a/i)).toBe(null)
  })

  // Vírgula recém-digitada não é erro, é meio de caminho.
  it('texto incompleto não acende alarme — ela ainda está digitando', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/vender a/i))
    await userEvent.type(screen.getByLabelText(/vender a/i), '1,')

    expect(screen.queryByText(/zero ou negativo/i)).toBe(null)
  })

  it('o sinal de menos sozinho não acusa margem que ela não digitou', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/margem/i))
    await userEvent.type(screen.getByLabelText(/margem/i), '-')

    expect(screen.queryByText(/-100%|zero ou negativo/i)).toBe(null)
  })

  // Sem os campos na tela, o aviso não tem sobre o que falar.
  it('o aviso some junto com o bloco de venda quando o rendimento zera', async () => {
    montar()
    await userEvent.clear(screen.getByLabelText(/lucro/i))
    await userEvent.type(screen.getByLabelText(/lucro/i), '65,00')
    await userEvent.clear(screen.getByLabelText(/rendeu quantos/i))
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '0')

    expect(screen.queryByLabelText(/vender a/i)).toBe(null)
    expect(screen.queryByText(/zero ou negativo/i)).toBe(null)
  })

  it('detalha os ingredientes no formato do parêntese', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /ver ingredientes/i }))
    expect(screen.getByText(/Toddy \(400 g — R\$ 10,00\) · usou 80 g → R\$ 2,00/)).toBeTruthy()
    expect(screen.getByText(/Forminha \(100 un — R\$ 5,20\) · usou 50 un → R\$ 2,60/)).toBeTruthy()
  })

  it('ingrediente sem preço marca o total como parcial e diz o que falta', () => {
    const porId = { ...PORID, i4: { ...MANTEIGA, embalagemPrecoCent: null } }
    montar({ ingredientesPorId: porId })
    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 30,10')
    expect(screen.getByText(/parcial/i).textContent).toMatch(/Manteiga/)
  })

  it('rendimento zerado não vira NaN', async () => {
    montar()
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '0')
    expect(screen.getByTestId('custo-cada').textContent).toBe('—')
  })

  it('avisa quando o rendimento foge do normal, se já houve produção antes', async () => {
    montar({
      producoes: [{
        id: 'p1', receitaId: 'rec_1', nomeReceita: 'Brigadeiro', receitasFeitas: 1,
        rendimento: 50, custoTotalCent: 3250, custoUnitarioCent: 65, parcial: false,
        data: '2026-08-01', criadoEm: '2026-08-01T10:00:00.000Z',
      }],
    })
    await userEvent.click(screen.getByRole('button', { name: /1 receita/i }))
    const receitas = screen.getByLabelText(/quantas receitas/i)
    await userEvent.clear(receitas)
    await userEvent.type(receitas, '2')
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '20')

    expect(screen.getByTestId('aviso-rendimento').textContent).toMatch(/conferiu o rendimento/i)
  })

  // `conta.custoUnitarioCent` JÁ inclui a embalagem; comparar ele com `custoNormal` (que não
  // inclui) é comparar coisas diferentes — dois números quase iguais rotulados "bem longe".
  // O aviso é sobre o RENDIMENTO, e embalagem escala com unidades, não com rendimento.
  it('o aviso de rendimento compara sem embalagem dos dois lados', async () => {
    montar({
      producoes: [{
        id: 'p1', receitaId: 'rec_1', nomeReceita: 'Brigadeiro', receitasFeitas: 1,
        rendimento: 50, custoTotalCent: 3250, custoUnitarioCent: 65, parcial: false,
        data: '2026-08-01', criadoEm: '2026-08-01T10:00:00.000Z',
      }],
    })
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '71')
    await abrirEmbalagem()
    await userEvent.type(screen.getByLabelText(/quantas embalagens/i), '71')
    await userEvent.type(screen.getByLabelText(/preço de cada embalagem/i), '0,27')

    // Com embalagem: (3250 + 71×27) / 71 = R$ 0,73 — perto do R$ 0,65 de sempre, não "bem
    // longe". Sem embalagem: 3250 / 71 = R$ 0,46, que é o número que fala do rendimento.
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,73')
    expect(screen.getByTestId('aviso-rendimento').textContent).toContain('R$ 0,46')
    expect(screen.getByTestId('aviso-rendimento').textContent).not.toContain('R$ 0,73')
  })

  it('na primeira produção do doce não avisa nada', async () => {
    montar()
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '200')
    expect(screen.queryByTestId('aviso-rendimento')).toBe(null)
  })

  it('sem doce nenhum não desenha calculadora', () => {
    montar({ receitas: [] })
    expect(screen.queryByLabelText(/rendeu quantos/i)).toBe(null)
  })

  it('sem tocar na embalagem, o custo é o de sempre', () => {
    montar()
    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 32,50')
  })

  it('digitar quantos e quanto cada muda o total e o de cada um', async () => {
    montar()
    await abrirEmbalagem()
    await userEvent.type(screen.getByLabelText(/quantas embalagens/i), '1')
    await userEvent.type(screen.getByLabelText(/preço de cada embalagem/i), '2,50')

    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 35,00')
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,70')
  })

  it('só a quantidade preenchida marca parcial e diz o que falta', async () => {
    montar()
    await abrirEmbalagem()
    await userEvent.type(screen.getByLabelText(/quantas embalagens/i), '1')

    expect(screen.getByText(/pela metade/i)).toBeTruthy()
  })

  it('"+ embalagem" abre outra linha, para forminha e caixa na mesma produção', async () => {
    montar()
    await abrirEmbalagem()
    await userEvent.type(screen.getByLabelText(/quantas embalagens/i), '65')
    await userEvent.type(screen.getByLabelText(/preço de cada embalagem/i), '0,05')
    await userEvent.click(screen.getByRole('button', { name: /\+ embalagem/i }))

    const quantidades = screen.getAllByLabelText(/quantas embalagens/i)
    const precos = screen.getAllByLabelText(/preço de cada embalagem/i)
    expect(quantidades).toHaveLength(2)

    await userEvent.type(quantidades[1], '1')
    await userEvent.type(precos[1], '2,50')

    // 3250 + 65×5 + 250 = 3825
    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 38,25')
  })

  it('o "×" tira a linha; sem ele o Salvar ficaria travado por uma embalagem pela metade', async () => {
    montar()
    await abrirEmbalagem()
    // Forminha (65 × 0,05) da última vez, mais uma caixa que hoje ela não usou de novo.
    await userEvent.type(screen.getByLabelText(/quantas embalagens/i), '65')
    await userEvent.type(screen.getByLabelText(/preço de cada embalagem/i), '0,05')
    await userEvent.click(screen.getByRole('button', { name: /\+ embalagem/i }))
    const precos = screen.getAllByLabelText(/preço de cada embalagem/i)
    await userEvent.type(precos[1], '2,50')

    // Ela apaga só a quantidade da caixa — fica "pela metade" — e o app precisa dar um
    // jeito de tirar a linha inteira, não só um dos dois campos.
    expect(screen.getByText(/pela metade/i)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /tirar embalagem 2/i }))

    expect(screen.getAllByLabelText(/quantas embalagens/i)).toHaveLength(1)
    expect(screen.queryByText(/pela metade/i)).toBe(null)
    // 3250 + 65×5 = 3575
    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 35,75')
  })

  it('o "×" não aparece quando só há uma linha — nada para tirar', async () => {
    montar()
    await abrirEmbalagem()
    expect(screen.queryByRole('button', { name: /tirar embalagem/i })).toBe(null)
  })

  it('o detalhamento separa a embalagem dos ingredientes', async () => {
    montar()
    await abrirEmbalagem()
    await userEvent.type(screen.getByLabelText(/quantas embalagens/i), '1')
    await userEvent.type(screen.getByLabelText(/preço de cada embalagem/i), '2,50')
    await userEvent.click(screen.getByRole('button', { name: /ver ingredientes/i }))

    expect(screen.getByText(/embalagem · 1 × R\$ 2,50 → R\$ 2,50/i)).toBeTruthy()
  })

  it('sem embalagem preenchida, o detalhamento não inventa linha', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /ver ingredientes/i }))
    expect(screen.queryByText(/embalagem ·/i)).toBe(null)
  })

  it('o chip fechado resume o que tem preenchido, para ela conferir sem abrir', () => {
    montar({
      producoes: [{
        id: 'prod_1', receitaId: 'rec_1', nomeReceita: 'Brigadeiro', receitasFeitas: 1,
        rendimento: 50, custoTotalCent: 3500, custoUnitarioCent: 70, parcial: false,
        precoVendaCent: 300, embalagens: [{ quantidade: 1, precoUnitarioCent: 250 }],
        data: '2026-08-20', criadoEm: '2026-08-20T10:00:00.000Z',
      }],
    })
    expect(screen.getByTestId('embalagem-chip').textContent).toMatch(/1 embalagem · R\$ 2,50/)
  })

  it('sem nada preenchido, o chip fechado convida a abrir', () => {
    montar()
    expect(screen.getByTestId('embalagem-chip').textContent).toMatch(/\+ embalagem/)
  })

  describe('abre já preenchida com a última vez', () => {
    const PRODUCAO_ANTERIOR = {
      id: 'prod_1', receitaId: 'rec_1', nomeReceita: 'Brigadeiro', receitasFeitas: 1,
      rendimento: 50, custoTotalCent: 3500, custoUnitarioCent: 70, parcial: false,
      precoVendaCent: 300, embalagens: [{ quantidade: 1, precoUnitarioCent: 250 }],
      data: '2026-08-20', criadoEm: '2026-08-20T10:00:00.000Z',
    }

    it('doce já vendido abre com o preço da última venda', () => {
      montar({ producoes: [PRODUCAO_ANTERIOR] })
      expect(screen.getByLabelText(/vender a/i).value).toBe('3,00')
    })

    it('e com a embalagem da última produção, para ela conferir', async () => {
      montar({ producoes: [PRODUCAO_ANTERIOR] })
      await abrirEmbalagem()
      expect(screen.getByLabelText(/quantas embalagens/i).value).toBe('1')
      expect(screen.getByLabelText(/preço de cada embalagem/i).value).toBe('2,50')
    })

    it('entre duas produções, vale a mais recente', () => {
      const maisVelha = { ...PRODUCAO_ANTERIOR, id: 'prod_0', precoVendaCent: 100, criadoEm: '2026-08-01T10:00:00.000Z' }
      montar({ producoes: [maisVelha, PRODUCAO_ANTERIOR] })
      expect(screen.getByLabelText(/vender a/i).value).toBe('3,00')
    })

    // A migração inteira, e ela é invisível: o brigadeiro do fixture tem margemPct 200 da v1,
    // e a tela mostra exatamente o preço que mostrava antes desta mudança.
    it('doce nunca vendido cai na margem da v1 e mostra o mesmo preço de sempre', () => {
      montar()
      expect(screen.getByLabelText(/vender a/i).value).toBe('1,95')
    })

    it('doce sem venda e sem margem da v1 abre com os três campos vazios', () => {
      montar({ receitas: [{ ...BRIGADEIRO, margemPct: null }] })
      expect(screen.getByLabelText(/vender a/i).value).toBe('')
      expect(screen.getByLabelText(/margem/i).value).toBe('')
    })

    // Digitar é simular. Só "Salvar produção" afirma que aconteceu.
    it('simular um preço não muda o que vem preenchido no próximo doce', async () => {
      montar({ producoes: [PRODUCAO_ANTERIOR], receitas: [BRIGADEIRO, OUTRO_DOCE] })
      await userEvent.clear(screen.getByLabelText(/vender a/i))
      await userEvent.type(screen.getByLabelText(/vender a/i), '9,99')

      await userEvent.selectOptions(screen.getByLabelText(/o que você fez/i), 'rec_2')
      await userEvent.selectOptions(screen.getByLabelText(/o que você fez/i), 'rec_1')

      expect(screen.getByLabelText(/vender a/i).value).toBe('3,00')
    })

    // O carimbo (`editado.receitaId === receita?.id`) é o que protege de dano de dado: ela
    // simula um preço, abre "Meus doces", apaga o doce simulado. A calculadora continua
    // montada, `receitas.find(...)` some, e cai em `receitas[0]` — SEM passar pelo <select>,
    // que é o único outro caminho que reseta a simulação. Sem o carimbo, o preço simulado
    // migraria para o doce que sobrou.
    it('apagar o doce simulado (sem tocar no <select>) não migra o preço simulado para o doce que sobrou', async () => {
      const utils = montar({ producoes: [PRODUCAO_ANTERIOR], receitas: [BRIGADEIRO, OUTRO_DOCE] })
      await userEvent.clear(screen.getByLabelText(/vender a/i))
      await userEvent.type(screen.getByLabelText(/vender a/i), '9,99')
      expect(screen.getByLabelText(/vender a/i).value).toBe('9,99')

      // Brigadeiro (rec_1) some da lista — como se tivesse sido apagado em "Meus doces" —
      // e o Beijinho (rec_2) vira `receitas[0]`.
      utils.rerender(
        <Calculadora
          receitas={[OUTRO_DOCE]}
          ingredientesPorId={PORID}
          producoes={[]}
          aoAbrirDoces={() => {}}
          aoAbrirIngredientes={() => {}}
          aoAbrirHistorico={() => {}}
          aoGravado={() => {}}
        />,
      )

      expect(screen.getByLabelText(/o que você fez/i).value).toBe('rec_2')
      expect(screen.getByLabelText(/vender a/i).value).toBe('')
    })
  })
})
