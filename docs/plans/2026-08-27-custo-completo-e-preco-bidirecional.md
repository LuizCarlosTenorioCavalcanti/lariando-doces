# Custo completo e preço bidirecional — plano de implementação

> **Para quem executa:** use a skill `superpowers:subagent-driven-development` (recomendado)
> ou `superpowers:executing-plans` para implementar tarefa por tarefa. Os passos usam
> checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** fazer o custo incluir embalagem e transformar o preço de venda em três números
ligados (preço ↔ margem ↔ lucro), que ela digita em qualquer ordem.

**Arquitetura:** toda conta nova entra em `src/motor/custo.js`, que é função pura e sem
React. A `Calculadora` só liga campos ao motor e guarda qual campo ela digitou por último. A
persistência ganha dois campos opcionais na produção (`embalagens`, `precoVendaCent`), sem
migração destrutiva e sem subir a versão do backup.

**Stack:** React 19, Vite 8, Vitest 4, `@testing-library/react`, `fake-indexeddb`.

**Spec:** [`docs/specs/2026-08-27-custo-completo-e-preco-bidirecional.md`](../specs/2026-08-27-custo-completo-e-preco-bidirecional.md)

## Restrições globais

- **Dinheiro circula em centavos.** Float só dentro da conta; arredonda uma vez, na saída.
- **`null` nunca vira `0`.** Zero é uma afirmação ("é de graça"); ausência é `null` e a tela
  mostra travessão. A **única** exceção nova é `custoDasEmbalagens` de lista vazia, que é `0`
  de propósito e precisa do comentário explicando por quê.
- **Import sem extensão** (`from './custo'`): o Vite resolve, Node puro não.
- **Fake timers travam o `fake-indexeddb`** — não usar nos testes de dados.
- **CI roda com `TZ: America/Sao_Paulo`.**
- **Texto de tela em pt-BR**, falado como ela fala. Nada de "inválido", "erro de validação".
- **Um teste por comportamento**, com nome que descreve o comportamento.
- **RED antes de GREEN, sempre.** Rodar o teste e ver falhar pelo motivo certo antes de
  implementar.
- Rodar a suíte com `npx vitest run --no-file-parallelism` ao fechar cada tarefa. A suíte tem
  um flake conhecido em `src/primeiroUso.test.jsx` sob contenção de CPU (herdado, provado em
  HEAD intocado); sob `--no-file-parallelism` ele não aparece.

## Mapa dos arquivos

| Arquivo | Responsabilidade | Fase |
| --- | --- | --- |
| `src/motor/custo.js` | Toda conta: embalagem, e as três voltas do triângulo | 1 e 2 |
| `src/lib/numeroBR.js` | `centavosParaCampo` — o caminho de volta de `paraCentavos` | 2 |
| `src/dados/repositorio.js` | Grava/valida `embalagens` e `precoVendaCent`; preserva `margemPct` | 1 e 2 |
| `src/dados/backup.js` | Valida os campos novos vindos de arquivo | 1 e 2 |
| `src/paginas/Calculadora.jsx` | Liga campos ao motor; guarda qual campo ela digitou | 1 e 2 |
| `src/paginas/FolhaEditarDoce.jsx` | Perde o campo "Margem de lucro" | 2 |

**Nota sobre o fixture dos testes:** `Calculadora.test.jsx` e `custo.test.js` cadastram
"Forminha" como **ingrediente** da receita, 50 por receita. Isso é justamente o erro que a
Fase 1 existe para dar saída (rendeu 65, cobra 50 forminhas). **Não mexa nesse fixture** — ele
prova o comportamento antigo, que continua válido para quem quiser modelar assim. As
embalagens novas entram como dado próprio nos testes novos.

---

# FASE 1 — o custo fica completo

## Task 1: `custoDasEmbalagens` no motor

**Arquivos:**
- Modificar: `src/motor/custo.js` (função nova, no fim do arquivo, antes de `TOLERANCIA_RENDIMENTO`)
- Teste: `src/motor/custo.test.js`

**Interfaces:**
- Produz: `custoDasEmbalagens(embalagens) -> { totalCent: number, incompleta: boolean }`.
  `embalagens` é `Array<{ quantidade, precoUnitarioCent }>`, `null` ou `undefined`.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar em `src/motor/custo.test.js`, e importar `custoDasEmbalagens` no `import` do topo:

```js
describe('custoDasEmbalagens', () => {
  // Zero aqui é uma AFIRMAÇÃO verdadeira ("mandei em pote retornável"), não um erro. É a
  // única exceção à regra do arquivo de nunca devolver 0 num caso sem informação.
  it('sem embalagem nenhuma custa zero, e isso não é "não sei"', () => {
    expect(custoDasEmbalagens([])).toEqual({ totalCent: 0, incompleta: false })
    expect(custoDasEmbalagens(null)).toEqual({ totalCent: 0, incompleta: false })
    expect(custoDasEmbalagens(undefined)).toEqual({ totalCent: 0, incompleta: false })
  })

  it('multiplica quantos pelo preço de cada um', () => {
    expect(custoDasEmbalagens([{ quantidade: 65, precoUnitarioCent: 5 }]))
      .toEqual({ totalCent: 325, incompleta: false })
  })

  it('soma várias linhas — forminha e caixa na mesma produção', () => {
    const r = custoDasEmbalagens([
      { quantidade: 65, precoUnitarioCent: 5 },
      { quantidade: 1, precoUnitarioCent: 250 },
    ])
    expect(r).toEqual({ totalCent: 575, incompleta: false })
  })

  // A linha que o "+ embalagem" acabou de criar não pode acender alarme.
  it('linha totalmente em branco é ignorada em silêncio', () => {
    expect(custoDasEmbalagens([{ quantidade: null, precoUnitarioCent: null }]))
      .toEqual({ totalCent: 0, incompleta: false })
    expect(custoDasEmbalagens([{ quantidade: '', precoUnitarioCent: '' }]))
      .toEqual({ totalCent: 0, incompleta: false })
  })

  // No meio da digitação ela tem metade preenchida. Contar como zero esconderia custo.
  it('linha pela metade marca incompleta e não entra na soma, nos dois sentidos', () => {
    expect(custoDasEmbalagens([{ quantidade: 65, precoUnitarioCent: null }]))
      .toEqual({ totalCent: 0, incompleta: true })
    expect(custoDasEmbalagens([{ quantidade: null, precoUnitarioCent: 5 }]))
      .toEqual({ totalCent: 0, incompleta: true })
  })

  it('negativo não entra e marca incompleta — dedo errado não barateia o doce', () => {
    expect(custoDasEmbalagens([{ quantidade: -1, precoUnitarioCent: 250 }]))
      .toEqual({ totalCent: 0, incompleta: true })
    expect(custoDasEmbalagens([{ quantidade: 1, precoUnitarioCent: -250 }]))
      .toEqual({ totalCent: 0, incompleta: true })
  })

  // Zero caixas é uma resposta, não uma falta de resposta.
  it('quantidade zero é válida e custa zero, sem marcar incompleta', () => {
    expect(custoDasEmbalagens([{ quantidade: 0, precoUnitarioCent: 250 }]))
      .toEqual({ totalCent: 0, incompleta: false })
  })

  it('uma linha boa e uma pela metade: soma a boa e ainda assim marca incompleta', () => {
    expect(custoDasEmbalagens([
      { quantidade: 1, precoUnitarioCent: 250 },
      { quantidade: 65, precoUnitarioCent: null },
    ])).toEqual({ totalCent: 250, incompleta: true })
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/motor/custo.test.js`
Esperado: FALHA com `custoDasEmbalagens is not a function` (ou erro de import).

- [ ] **Passo 3: implementar o mínimo**

Em `src/motor/custo.js`, antes de `export const TOLERANCIA_RENDIMENTO`:

```js
/** Um campo preenchido vira número; vazio, em branco ou ilegível vira `null`.
 *  Distinguir "não preencheu" de "preencheu zero" é o que separa a linha que o
 *  "+ embalagem" acabou de criar da linha que diz "não usei caixa nenhuma". */
function numeroPreenchido(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/** Custo da embalagem de UMA produção, em centavos.
 *
 *  A embalagem não é cadastrada em lugar nenhum: ela digita quantos e quanto custou cada um,
 *  na hora. É o mesmo campo para a forminha (65 × R$ 0,05) e para a caixa (1 × R$ 2,50).
 *
 *  Lista vazia devolve `0`, e aqui isso é DE PROPÓSITO — o contrário da regra de
 *  `custoDoItem`. Ingrediente sem preço é informação que FALTA, e virar zero esconderia
 *  custo. Embalagem sem linha é informação que EXISTE: ela mandou em pote retornável, e
 *  retornável custa zero mesmo. */
export function custoDasEmbalagens(embalagens) {
  let totalCent = 0
  let incompleta = false

  for (const linha of embalagens ?? []) {
    const quantidade = numeroPreenchido(linha?.quantidade)
    const preco = numeroPreenchido(linha?.precoUnitarioCent)

    // Nada preenchido: é a linha recém-criada pelo "+ embalagem". Alarme aqui ensinaria
    // ela a ignorar o alarme.
    if (quantidade === null && preco === null) continue

    // Metade preenchida é o estado de quem está digitando agora. Somar só a metade que dá
    // (tratando a outra como zero) esconderia custo em silêncio, que é o pior desfecho.
    if (quantidade === null || preco === null) {
      incompleta = true
      continue
    }
    if (quantidade < 0 || preco < 0) {
      incompleta = true
      continue
    }

    totalCent += quantidade * preco
  }

  return { totalCent, incompleta }
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/motor/custo.test.js`
Esperado: PASSA, e nenhum teste antigo quebra.

- [ ] **Passo 5: commitar**

```bash
git add src/motor/custo.js src/motor/custo.test.js
git commit -m "feat: custoDasEmbalagens — embalagem digitada na hora, quantos x quanto cada"
```

---

## Task 2: `custoDaProducao` passa a somar a embalagem

**Arquivos:**
- Modificar: `src/motor/custo.js:55-75` (`custoDaProducao`)
- Teste: `src/motor/custo.test.js`

**Interfaces:**
- Consome: `custoDasEmbalagens` da Task 1.
- Produz: `custoDaProducao({ receita, ingredientesPorId, receitasFeitas, rendimento, embalagens })`.
  `embalagens` é opcional; ausente se comporta como `[]`.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar em `src/motor/custo.test.js`, dentro do `describe('custoDaProducao')` que já
existe (o brigadeiro do fixture custa 3250 a receita e rende 50):

```js
  it('a embalagem entra no total e no custo de cada um', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
      embalagens: [{ quantidade: 1, precoUnitarioCent: 250 }],
    })
    expect(r.custoTotalCent).toBe(3500)
    expect(r.custoUnitarioCent).toBe(70)
  })

  // O ponto mais importante da Fase 1. Ingrediente escala com quantas receitas saíram do
  // armário; embalagem não escala com nada, porque ela digitou a quantidade que de fato
  // usou. Multiplicar cobraria 2 caixas de quem usou 1.
  it('a embalagem NÃO é multiplicada por quantas receitas ela fez', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 2, rendimento: 100,
      embalagens: [{ quantidade: 1, precoUnitarioCent: 250 }],
    })
    expect(r.custoTotalCent).toBe(6750)
  })

  it('sem embalagem o total é o de sempre', () => {
    const semCampo = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
    })
    const comListaVazia = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
      embalagens: [],
    })
    expect(semCampo.custoTotalCent).toBe(3250)
    expect(comListaVazia.custoTotalCent).toBe(3250)
  })

  it('embalagem pela metade acende o parcial, como ingrediente sem preço faz', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
      embalagens: [{ quantidade: 1, precoUnitarioCent: null }],
    })
    expect(r.parcial).toBe(true)
    expect(r.custoTotalCent).toBe(3250)
  })
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/motor/custo.test.js`
Esperado: FALHA — `expected 3250 to be 3500`, porque a embalagem ainda é ignorada.

- [ ] **Passo 3: implementar o mínimo**

Substituir `custoDaProducao` em `src/motor/custo.js`:

```js
export function custoDaProducao({
  receita, ingredientesPorId, receitasFeitas, rendimento, embalagens,
}) {
  const { totalCent, semPreco } = custoDaReceita(receita, ingredientesPorId)
  const embalagem = custoDasEmbalagens(embalagens)

  const nReceitas = Number(receitasFeitas)
  const temReceitas = Number.isFinite(nReceitas) && nReceitas > 0
  // A embalagem entra SOMANDO, fora do `× nReceitas`: ela digitou quantas usou de verdade.
  const totalProducao = temReceitas ? totalCent * nReceitas + embalagem.totalCent : null

  const rend = Number(rendimento)
  const temRendimento = Number.isFinite(rend) && rend > 0

  return {
    custoTotalCent: totalProducao === null ? null : Math.round(totalProducao),
    // Arredondado AQUI, e é este valor que o preço de venda usa depois. Derivar a venda do
    // valor cheio produziria "cada R$ 0,65, vender a R$ 1,94" na tela, que lê como erro de
    // conta.
    custoUnitarioCent:
      totalProducao !== null && temRendimento ? Math.round(totalProducao / rend) : null,
    parcial: semPreco.length > 0 || embalagem.incompleta,
    semPreco,
  }
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/motor/custo.test.js`
Esperado: PASSA, incluindo todos os testes antigos de `custoDaProducao`.

- [ ] **Passo 5: commitar**

```bash
git add src/motor/custo.js src/motor/custo.test.js
git commit -m "feat: custoDaProducao soma a embalagem, sem escalar com receitasFeitas"
```

---

## Task 3: a produção grava a embalagem

**Arquivos:**
- Modificar: `src/dados/repositorio.js` (`salvarProducao`)
- Teste: `src/dados/repositorio.producoes.test.js`

**Interfaces:**
- Produz: registro de produção com `embalagens: Array<{quantidade, precoUnitarioCent}>`,
  sempre array (nunca `undefined`).

- [ ] **Passo 1: escrever os testes que falham**

O arquivo já tem um helper `cenario()` que semeia ingrediente, receita e uma produção, e
devolve `{ toddy, receita, producao }`. Acrescentar ao lado dele um helper que devolve só os
campos de uma produção nova, para os testes abaixo não repetirem sete linhas cada:

```js
async function base() {
  const { receita } = await cenario()
  return {
    receitaId: receita.id, nomeReceita: receita.nome, receitasFeitas: 1, rendimento: 50,
    custoTotalCent: 3250, custoUnitarioCent: 65, parcial: false,
  }
}
```

E os testes, dentro do `describe('produções')` existente:

```js
  it('grava as linhas de embalagem junto da produção', async () => {
    const p = await salvarProducao({
      ...(await base()),
      embalagens: [
        { quantidade: 65, precoUnitarioCent: 5 },
        { quantidade: 1, precoUnitarioCent: 250 },
      ],
    })
    expect(p.embalagens).toEqual([
      { quantidade: 65, precoUnitarioCent: 5 },
      { quantidade: 1, precoUnitarioCent: 250 },
    ])
  })

  // Produção da v1 não tem o campo. Ler como `undefined` faria o histórico e a próxima
  // produção quebrarem num `.map` de undefined.
  it('produção sem o campo lê como lista vazia, não como undefined', async () => {
    const p = await salvarProducao({ ...(await base()) })
    expect(p.embalagens).toEqual([])
  })

  it('recusa linha de embalagem com número que não é número', async () => {
    await expect(salvarProducao({
      ...BASE, embalagens: [{ quantidade: 'abc', precoUnitarioCent: 250 }],
    })).rejects.toThrow(/embalagem/i)
  })

  it('recusa linha de embalagem negativa', async () => {
    await expect(salvarProducao({
      ...BASE, embalagens: [{ quantidade: -1, precoUnitarioCent: 250 }],
    })).rejects.toThrow(/embalagem/i)
    await expect(salvarProducao({
      ...BASE, embalagens: [{ quantidade: 1, precoUnitarioCent: -250 }],
    })).rejects.toThrow(/embalagem/i)
  })
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/dados/repositorio.producoes.test.js`
Esperado: FALHA — `expected undefined to equal [...]` no primeiro teste.

- [ ] **Passo 3: implementar o mínimo**

Em `src/dados/repositorio.js`, acrescentar acima de `salvarProducao`:

```js
/** As linhas de embalagem que a calculadora mandou, limpas e conferidas.
 *
 *  Guarda a lista mesmo quando vazia: uma produção da v1 sem o campo vira `[]`, e assim a
 *  tela nunca faz `.map` em cima de `undefined`. Recusa em vez de consertar em silêncio —
 *  número torto aqui vira custo torto no histórico, que ninguém revisa depois. */
function embalagensValidas(valor) {
  if (valor === null || valor === undefined) return []
  if (!Array.isArray(valor)) throw new Error('A embalagem precisa ser uma lista.')

  return valor.map((linha) => {
    const quantidade = Number(linha?.quantidade)
    const precoUnitarioCent = Number(linha?.precoUnitarioCent)
    if (!Number.isFinite(quantidade) || !Number.isFinite(precoUnitarioCent)) {
      throw new Error('Tem uma linha de embalagem sem número.')
    }
    if (quantidade < 0 || precoUnitarioCent < 0) {
      throw new Error('A embalagem não pode ter quantidade ou preço negativo.')
    }
    return { quantidade, precoUnitarioCent }
  })
}
```

E dentro de `salvarProducao`, no objeto `registro`, acrescentar depois de `parcial`:

```js
    embalagens: embalagensValidas(dados?.embalagens),
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/dados/repositorio.producoes.test.js`
Esperado: PASSA.

- [ ] **Passo 5: commitar**

```bash
git add src/dados/repositorio.js src/dados/repositorio.producoes.test.js
git commit -m "feat: producao grava e valida as linhas de embalagem"
```

---

## Task 4: o backup confere a embalagem que vem de arquivo

**Arquivos:**
- Modificar: `src/dados/backup.js` (`validarBackup`)
- Teste: `src/dados/backup.test.js`

**Interfaces:**
- Consome: nada de tarefa anterior.
- Produz: `validarBackup` recusa `embalagens` malformada em qualquer produção.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar em `src/dados/backup.test.js`, dentro de `describe('validarBackup')`:

```js
  // `VERSAO_BACKUP` continua 1 de propósito: subir para 2 faria o app recusar os backups
  // que ela já tem guardados. Os campos novos são todos opcionais.
  it('aceita produção da v1, sem o campo de embalagem', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [], receitas: [],
      producoes: [{ id: 'prod_1', nomeReceita: 'Brigadeiro' }],
    })
    expect(r).toEqual({ ok: true })
  })

  it('aceita produção com embalagem bem formada', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [], receitas: [],
      producoes: [{
        id: 'prod_1', nomeReceita: 'Brigadeiro',
        embalagens: [{ quantidade: 1, precoUnitarioCent: 250 }],
      }],
    })
    expect(r).toEqual({ ok: true })
  })

  // Produção com embalagem torta derruba o render do histórico — mesma tela branca que a
  // validação de `itens` de receita já existe para evitar.
  it('recusa embalagem que não é lista', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [], receitas: [],
      producoes: [{ id: 'prod_1', embalagens: 'nenhuma' }],
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/embalagem/i)
  })

  it('recusa linha de embalagem sem número ou com número negativo', () => {
    const semNumero = validarBackup({
      versao: 1, ingredientes: [], receitas: [],
      producoes: [{ id: 'prod_1', embalagens: [{ quantidade: 'abc', precoUnitarioCent: 250 }] }],
    })
    expect(semNumero.ok).toBe(false)
    expect(semNumero.motivo).toMatch(/embalagem/i)

    const negativo = validarBackup({
      versao: 1, ingredientes: [], receitas: [],
      producoes: [{ id: 'prod_1', embalagens: [{ quantidade: -1, precoUnitarioCent: 250 }] }],
    })
    expect(negativo.ok).toBe(false)
    expect(negativo.motivo).toMatch(/embalagem/i)
  })
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/dados/backup.test.js`
Esperado: FALHA nos dois testes de recusa — `expected true to be false`.

- [ ] **Passo 3: implementar o mínimo**

Em `src/dados/backup.js`, depois do laço que valida `obj.receitas` (o que checa `itens`),
acrescentar:

```js
  // Produção com embalagem malformada passa nas checagens de cima — elas só olham `id` — e
  // derruba o render do histórico. Recusar aqui é a última chance de dizer o motivo antes
  // de já ter apagado o que estava salvo.
  for (const registro of obj.producoes) {
    if (registro.embalagens === null || registro.embalagens === undefined) continue
    if (!Array.isArray(registro.embalagens)) {
      return { ok: false, motivo: 'O backup tem uma produção com a embalagem corrompida.' }
    }
    for (const linha of registro.embalagens) {
      const quantidade = Number(linha?.quantidade)
      const preco = Number(linha?.precoUnitarioCent)
      if (!Number.isFinite(quantidade) || !Number.isFinite(preco) || quantidade < 0 || preco < 0) {
        return { ok: false, motivo: 'O backup tem uma linha de embalagem com número inválido.' }
      }
    }
  }
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/dados/backup.test.js`
Esperado: PASSA.

- [ ] **Passo 5: commitar**

```bash
git add src/dados/backup.js src/dados/backup.test.js
git commit -m "feat: validarBackup confere a embalagem que vem de arquivo"
```

---

## Task 5: o campo de embalagem na calculadora

**Arquivos:**
- Modificar: `src/paginas/Calculadora.jsx`
- Modificar: `src/paginas/calculadora.css` (uma regra para a linha)
- Teste: `src/paginas/Calculadora.test.jsx`

**Interfaces:**
- Consome: `custoDaProducao({..., embalagens})` da Task 2; `embalagensValidas` já roda dentro
  de `salvarProducao` (Task 3).
- Produz: estado `embalagens` na `Calculadora`, mandado para o motor e para `salvarProducao`.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar em `src/paginas/Calculadora.test.jsx`, dentro do `describe` existente:

```js
  it('sem tocar na embalagem, o custo é o de sempre', () => {
    montar()
    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 32,50')
  })

  it('digitar quantos e quanto cada muda o total e o de cada um', async () => {
    montar()
    await userEvent.type(screen.getByLabelText(/quantas embalagens/i), '1')
    await userEvent.type(screen.getByLabelText(/preço de cada embalagem/i), '2,50')

    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 35,00')
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,70')
  })

  it('só a quantidade preenchida marca parcial e diz o que falta', async () => {
    montar()
    await userEvent.type(screen.getByLabelText(/quantas embalagens/i), '1')

    expect(screen.getByText(/falta o preço da embalagem/i)).toBeTruthy()
  })

  it('"+ embalagem" abre outra linha, para forminha e caixa na mesma produção', async () => {
    montar()
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
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/paginas/Calculadora.test.jsx`
Esperado: FALHA — `Unable to find a label with the text of: /quantas embalagens/i`.

- [ ] **Passo 3: implementar o mínimo**

Em `src/paginas/Calculadora.jsx`:

1. No `import` de componentes, acrescentar `CampoMoeda`:

```js
import { CampoMoeda } from '../componentes/CampoMoeda'
```

2. Depois dos `useState` existentes, acrescentar o estado. A `chave` existe porque o React
   precisa de identidade estável na lista — o índice faria a linha de baixo herdar o texto da
   de cima quando uma sumisse:

```js
  // Uma linha por embalagem: 65 forminhas a R$ 0,05, 1 caixa a R$ 2,50. Texto, não número,
  // porque enquanto ela digita "2," o conteúdo não é número válido.
  const [linhasEmbalagem, setLinhasEmbalagem] = useState([
    { chave: 'emb_0', quantidade: '', preco: '' },
  ])
```

3. Depois de `rendimentoEfetivo`, converter para o formato do motor:

```js
  const embalagens = useMemo(
    () => linhasEmbalagem.map((l) => ({
      quantidade: l.quantidade.trim() === '' ? null : paraNumero(l.quantidade),
      precoUnitarioCent: l.preco.trim() === '' ? null : paraCentavos(l.preco),
    })),
    [linhasEmbalagem],
  )
```

E acrescentar `paraCentavos` ao import de `../lib/numeroBR`.

4. Passar para o motor — no `useMemo` de `conta`, acrescentar `embalagens` ao objeto e à lista
   de dependências:

```js
  const conta = useMemo(() => {
    if (!receita) return null
    return custoDaProducao({
      receita,
      ingredientesPorId,
      receitasFeitas: paraNumero(receitasFeitas),
      rendimento: rendimentoEfetivo,
      embalagens,
    })
  }, [receita, ingredientesPorId, receitasFeitas, rendimentoEfetivo, embalagens])
```

5. Os dois manipuladores, junto dos outros `useCallback`:

```js
  const aoMudarLinha = useCallback((chave, campo, valor) => {
    setLinhasEmbalagem((linhas) => linhas.map(
      (l) => (l.chave === chave ? { ...l, [campo]: valor } : l),
    ))
    setSalvo(false)
  }, [])

  const acrescentarLinha = useCallback(() => {
    setLinhasEmbalagem((linhas) => [
      ...linhas,
      { chave: `emb_${linhas.length}`, quantidade: '', preco: '' },
    ])
  }, [])
```

6. O JSX, entre o bloco do chip de receitas e `<div className="resultado">`:

```jsx
      {linhasEmbalagem.map((linha, indice) => (
        <div className="linha-embalagem" key={linha.chave}>
          <CampoNumero
            id={`calc-emb-qtd-${linha.chave}`}
            rotulo="Quantas embalagens?"
            valor={linha.quantidade}
            aoMudar={(v) => aoMudarLinha(linha.chave, 'quantidade', v)}
            dica={indice === 0
              ? 'Saquinho, forminha, caixa. Deixe em branco se foi em pote retornável.'
              : undefined}
          />
          <CampoMoeda
            id={`calc-emb-preco-${linha.chave}`}
            rotulo="Preço de cada embalagem"
            valor={linha.preco}
            aoMudar={(v) => aoMudarLinha(linha.chave, 'preco', v)}
          />
        </div>
      ))}

      <button type="button" className="chip" onClick={acrescentarLinha}>
        + embalagem
      </button>
```

7. O aviso de parcial precisa falar da embalagem também. Substituir o bloco de `conta.parcial`:

```jsx
      {conta.parcial ? (
        <p className="aviso aviso-atencao" role="status">
          {conta.semPreco.length > 0
            ? `Parcial — falta o preço de ${conta.semPreco.join(', ')}.`
            : 'Parcial — falta o preço da embalagem.'}
        </p>
      ) : null}
```

8. Mandar junto ao gravar — dentro de `salvarProducao(...)` em `gravar`, acrescentar
   `embalagens,` ao objeto, e `embalagens` às dependências do `useCallback`.

9. Em `src/paginas/calculadora.css`, acrescentar:

```css
/* Quantos e quanto cada um lado a lado: são uma frase só, e separá-los em duas linhas
   faria parecer dois assuntos. */
.linha-embalagem { display: flex; gap: 0.5rem; align-items: flex-start; }
.linha-embalagem > .campo { flex: 1; }
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/paginas/Calculadora.test.jsx`
Esperado: PASSA, e os testes antigos da calculadora continuam verdes.

- [ ] **Passo 5: escrever o teste do detalhamento, que também falha**

A spec pede que "ver ingredientes" mostre a embalagem separada, para ela enxergar quanto do
custo é massa e quanto é embrulho:

```js
  it('o detalhamento separa a embalagem dos ingredientes', async () => {
    montar()
    await userEvent.type(screen.getByLabelText(/quantas embalagens/i), '1')
    await userEvent.type(screen.getByLabelText(/preço de cada embalagem/i), '2,50')
    await userEvent.click(screen.getByRole('button', { name: /ver ingredientes/i }))

    expect(screen.getByText(/embalagem · 1 × R$ 2,50 → R$ 2,50/i)).toBeTruthy()
  })

  it('sem embalagem preenchida, o detalhamento não inventa linha', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /ver ingredientes/i }))
    expect(screen.queryByText(/embalagem ·/i)).toBe(null)
  })
```

Rodar: `npx vitest run src/paginas/Calculadora.test.jsx`
Esperado: FALHA — `Unable to find an element with the text`.

- [ ] **Passo 6: implementar o detalhamento**

Dentro do `<ul className="detalhe">`, depois do `.map` dos itens da receita:

```jsx
          {embalagens.map((e, indice) => (
            e.quantidade === null && e.precoUnitarioCent === null ? null : (
              // Separado dos ingredientes de propósito: massa e embrulho sobem por motivos
              // diferentes, e juntar os dois esconderia qual deles apertou.
              <li key={`emb-${indice}`} className="detalhe-embalagem">
                {`Embalagem · ${e.quantidade ?? '?'} × ${formatBRL(e.precoUnitarioCent)} → ${formatBRL(
                  e.quantidade === null || e.precoUnitarioCent === null
                    ? null
                    : Math.round(e.quantidade * e.precoUnitarioCent),
                )}`}
              </li>
            )
          ))}
```

E em `src/paginas/calculadora.css`, junto das outras regras de `.detalhe`:

```css
/* A embalagem não é ingrediente. A linha mais apagada é o que deixa isso óbvio de relance. */
.detalhe-embalagem { color: var(--texto-suave); }
```

- [ ] **Passo 7: rodar e ver passar**

Rodar: `npx vitest run src/paginas/Calculadora.test.jsx`
Esperado: PASSA.

- [ ] **Passo 8: rodar a suíte inteira e commitar**

```bash
npx vitest run --no-file-parallelism
git add src/paginas/Calculadora.jsx src/paginas/Calculadora.test.jsx src/paginas/calculadora.css
git commit -m "feat: campo de embalagem na calculadora, com + embalagem para mais linhas"
```

---

# FASE 2 — o preço fica bidirecional

## Task 6: as duas voltas que faltam no motor

**Arquivos:**
- Modificar: `src/motor/custo.js` (duas funções novas, junto de `precoSugerido`)
- Teste: `src/motor/custo.test.js`

**Interfaces:**
- Produz:
  - `margemDoPreco(custoUnitarioCent, precoCent) -> number | null` (% **não arredondado**)
  - `precoDoLucro(custoUnitarioCent, lucroCent, rendimento) -> number | null` (centavos)

- [ ] **Passo 1: escrever os testes que falham**

```js
describe('margemDoPreco', () => {
  it('R$ 0,65 de custo vendido a R$ 1,95 é 200% de margem', () => {
    expect(margemDoPreco(65, 195)).toBe(200)
  })

  it('fecha a ida e a volta: preço → margem → preço devolve o mesmo preço', () => {
    expect(precoSugerido(65, margemDoPreco(65, 195))).toBe(195)
  })

  it('vender abaixo do custo dá margem negativa, que é informação e não erro', () => {
    expect(margemDoPreco(100, 70)).toBe(-30)
  })

  // Divisão por zero. Acontece com doce cujos ingredientes estão todos sem preço.
  it('custo zero não tem margem — travessão, não Infinity', () => {
    expect(margemDoPreco(0, 195)).toBe(null)
  })

  it('sem custo ou sem preço não há margem', () => {
    expect(margemDoPreco(null, 195)).toBe(null)
    expect(margemDoPreco(65, null)).toBe(null)
  })
})

describe('precoDoLucro', () => {
  it('quero R$ 65,00 de lucro em 50 unidades que custam R$ 0,65: vendo a R$ 1,95', () => {
    expect(precoDoLucro(65, 6500, 50)).toBe(195)
  })

  it('fecha a ida e a volta: lucro → preço → lucro devolve o mesmo lucro', () => {
    expect(lucroDaProducao(65, precoDoLucro(65, 6500, 50), 50)).toBe(6500)
  })

  it('lucro zero é vender pelo custo', () => {
    expect(precoDoLucro(65, 0, 50)).toBe(65)
  })

  // Lucro de fornada sem fornada não existe.
  it('sem rendimento não dá para tirar preço do lucro', () => {
    expect(precoDoLucro(65, 6500, 0)).toBe(null)
    expect(precoDoLucro(65, 6500, null)).toBe(null)
  })

  it('sem custo ou sem lucro não há preço', () => {
    expect(precoDoLucro(null, 6500, 50)).toBe(null)
    expect(precoDoLucro(65, null, 50)).toBe(null)
  })
})
```

Acrescentar `margemDoPreco` e `precoDoLucro` ao `import` do topo do arquivo de teste.

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/motor/custo.test.js`
Esperado: FALHA com `margemDoPreco is not a function`.

- [ ] **Passo 3: implementar o mínimo**

Em `src/motor/custo.js`, logo depois de `precoSugerido`:

```js
/** A volta de `precoSugerido`: preço de venda → margem, em porcentagem.
 *
 *  Devolve o número CHEIO, sem arredondar. Quem mostra na tela arredonda para % inteiro; a
 *  conta fica com a precisão toda para a ida e a volta fecharem. Arredondar aqui faria o
 *  preço "pular" sob o dedo dela quando os dois campos estão ligados. */
export function margemDoPreco(custoUnitarioCent, precoCent) {
  if (custoUnitarioCent === null || custoUnitarioCent === undefined) return null
  if (precoCent === null || precoCent === undefined) return null
  if (!Number.isFinite(custoUnitarioCent) || !Number.isFinite(precoCent)) return null
  // Margem é lucro POR custo. Sem custo não há por quê dividir, e `Infinity` na tela é pior
  // que travessão: parece número.
  if (custoUnitarioCent === 0) return null

  return ((precoCent - custoUnitarioCent) / custoUnitarioCent) * 100
}

/** A volta de `lucroDaProducao`: quanto ela quer tirar da fornada → por quanto vender cada um. */
export function precoDoLucro(custoUnitarioCent, lucroCent, rendimento) {
  if (custoUnitarioCent === null || custoUnitarioCent === undefined) return null
  if (lucroCent === null || lucroCent === undefined) return null
  if (!Number.isFinite(custoUnitarioCent) || !Number.isFinite(lucroCent)) return null

  const rend = Number(rendimento)
  if (!Number.isFinite(rend) || rend <= 0) return null

  return Math.round(custoUnitarioCent + lucroCent / rend)
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/motor/custo.test.js`
Esperado: PASSA.

- [ ] **Passo 5: commitar**

```bash
git add src/motor/custo.js src/motor/custo.test.js
git commit -m "feat: margemDoPreco e precoDoLucro — as duas voltas do triangulo"
```

---

## Task 7: `centavosParaCampo`, o caminho de volta

**Arquivos:**
- Modificar: `src/lib/numeroBR.js`
- Teste: `src/lib/numeroBR.test.js`

**Interfaces:**
- Produz: `centavosParaCampo(centavos) -> string`. `195` → `"1,95"`. `null` → `""`.

- [ ] **Passo 1: escrever os testes que falham**

```js
describe('centavosParaCampo', () => {
  it('centavos viram o texto que vai DENTRO do campo, sem R$', () => {
    expect(centavosParaCampo(195)).toBe('1,95')
    expect(centavosParaCampo(6500)).toBe('65,00')
    expect(centavosParaCampo(5)).toBe('0,05')
  })

  it('sem valor o campo fica vazio, não com travessão', () => {
    expect(centavosParaCampo(null)).toBe('')
    expect(centavosParaCampo(undefined)).toBe('')
  })

  it('fecha a ida e a volta com paraCentavos', () => {
    expect(paraCentavos(centavosParaCampo(195))).toBe(195)
  })

  // Milhar com ponto entraria no campo e `paraNumero` leria "1.234,50" certo, mas o campo
  // com separador atrapalha quem edita no meio do número.
  it('não põe separador de milhar', () => {
    expect(centavosParaCampo(123450)).toBe('1234,50')
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/lib/numeroBR.test.js`
Esperado: FALHA com `centavosParaCampo is not a function`.

- [ ] **Passo 3: implementar o mínimo**

```js
/** Centavos → o texto que vai DENTRO de um campo: `195` → `"1,95"`.
 *
 *  É a volta de `paraCentavos`, e existe porque `formatBRL` não serve: aquele põe `R$` e
 *  separador de milhar, e os dois atrapalham quem vai editar o número. Sem valor devolve
 *  vazio, não travessão — travessão é para leitura, campo vazio é para digitação. */
export function centavosParaCampo(centavos) {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return ''
  return (centavos / 100).toFixed(2).replace('.', ',')
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/lib/numeroBR.test.js`
Esperado: PASSA.

- [ ] **Passo 5: commitar**

```bash
git add src/lib/numeroBR.js src/lib/numeroBR.test.js
git commit -m "feat: centavosParaCampo — centavos viram texto de campo editavel"
```

---

## Task 8: os três campos ligados na calculadora

Esta é a tarefa central da Fase 2. Ela **não** persiste nada — digitar é simulação.

**Arquivos:**
- Modificar: `src/paginas/Calculadora.jsx`
- Teste: `src/paginas/Calculadora.test.jsx`

**Interfaces:**
- Consome: `margemDoPreco`, `precoDoLucro` (Task 6); `centavosParaCampo` (Task 7);
  `precoSugerido`, `lucroDaProducao` (já existem).
- Produz: estado `{ fonte, texto }` na `Calculadora`, e `precoCent` disponível para a Task 9.

- [ ] **Passo 1: escrever os testes que falham**

Substituir o teste antigo `'sem margem cadastrada, não mostra bloco de venda'` (ele muda de
sentido: o bloco agora aparece sempre que há custo) e acrescentar:

```js
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
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/paginas/Calculadora.test.jsx`
Esperado: FALHA com `Unable to find a label with the text of: /vender a/i`.

- [ ] **Passo 3: implementar o mínimo**

Em `src/paginas/Calculadora.jsx`:

1. Imports — acrescentar `margemDoPreco, precoDoLucro` ao import do motor e
   `centavosParaCampo` ao de `../lib/numeroBR`.

2. Trocar o `useMemo` de `venda` (linhas 45-49) por este bloco. Substitui também o `useState`
   de nada — o estado novo é `editado`:

```js
  // Qual campo ela digitou por último, e o texto CRU dela. O app recalcula os outros dois e
  // nunca reescreve este — é o que impede o campo de pular sob o dedo enquanto ela digita.
  const [editado, setEditado] = useState({ fonte: null, texto: '' })

  const custoUnitarioCent = conta?.custoUnitarioCent ?? null

  const precoCent = useMemo(() => {
    if (editado.fonte === 'preco') {
      const p = paraCentavos(editado.texto)
      return p === null || p < 0 ? null : p
    }
    if (editado.fonte === 'margem') {
      const m = paraNumero(editado.texto)
      // Em -100% o preço zera; abaixo disso ele fica negativo, como se o doce pagasse para
      // sair. É "-" a mais no campo, não uma decisão de negócio.
      if (m === null || m <= -100) return null
      return precoSugerido(custoUnitarioCent, m)
    }
    if (editado.fonte === 'lucro') {
      const p = precoDoLucro(custoUnitarioCent, paraCentavos(editado.texto), rendimentoEfetivo)
      return p === null || p < 0 ? null : p
    }
    return null
  }, [editado, custoUnitarioCent, rendimentoEfetivo])

  const margemCalculada = margemDoPreco(custoUnitarioCent, precoCent)
  const lucroCent = lucroDaProducao(custoUnitarioCent, precoCent, rendimentoEfetivo)

  // O campo que ela digitou mostra o texto dela; os outros dois mostram o derivado, já
  // arredondado. Quem arredonda é sempre o derivado, nunca o digitado.
  function textoDoCampo(campo) {
    if (editado.fonte === campo) return editado.texto
    if (campo === 'preco') return centavosParaCampo(precoCent)
    if (campo === 'margem') {
      return margemCalculada === null ? '' : String(Math.round(margemCalculada))
    }
    return centavosParaCampo(lucroCent)
  }

  const avisoVenda = precoCent === null && editado.fonte !== null && editado.texto.trim() !== ''
    ? 'Esse número deixaria o preço em zero ou negativo — confira o sinal.'
    : null

  const aoMudarVenda = useCallback((fonte, texto) => {
    setEditado({ fonte, texto })
    setSalvo(false)
  }, [])
```

3. Trocar o bloco JSX de venda (linhas 158-170) por:

```jsx
        {custoUnitarioCent !== null ? (
          <>
            <hr />
            <CampoMoeda
              id="calc-preco"
              rotulo="Vender a"
              valor={textoDoCampo('preco')}
              aoMudar={(v) => aoMudarVenda('preco', v)}
            />
            <CampoNumero
              id="calc-margem"
              rotulo="Margem"
              valor={textoDoCampo('margem')}
              aoMudar={(v) => aoMudarVenda('margem', v)}
              sufixo="%"
            />
            <CampoMoeda
              id="calc-lucro"
              rotulo="Lucro da fornada"
              valor={textoDoCampo('lucro')}
              aoMudar={(v) => aoMudarVenda('lucro', v)}
            />
          </>
        ) : null}
```

4. Logo depois do `</div>` do `resultado`, o aviso:

```jsx
      {avisoVenda ? (
        <p className="aviso aviso-atencao" role="status">{avisoVenda}</p>
      ) : null}
```

Ajustar o texto para casar com o teste: quando `editado.fonte === 'margem'`, a mensagem é
`'Margem de -100% ou menos deixaria o preço em zero ou negativo.'`; nos outros casos,
`'Esse número deixaria o preço em zero ou negativo — confira o sinal.'`

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/paginas/Calculadora.test.jsx`
Esperado: PASSA nos testes novos, e **dois testes antigos quebram** porque liam o preço como
texto e agora ele é campo. Eles não podem ser apagados — provam comportamento que continua
valendo. Reescrever assim:

```js
  // era: expect(screen.getByTestId('preco-venda').textContent).toBe('R$ 1,95')
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
```

Também tirar `data-testid="preco-venda"` e `data-testid="lucro"` do JSX antigo, que deixou de
existir.

- [ ] **Passo 5: rodar a suíte inteira e commitar**

```bash
npx vitest run --no-file-parallelism
git add src/paginas/Calculadora.jsx src/paginas/Calculadora.test.jsx
git commit -m "feat: preco, margem e lucro ligados — digita um, o app calcula os outros dois"
```

---

## Task 9: a produção grava o preço de venda

**Arquivos:**
- Modificar: `src/dados/repositorio.js` (`salvarProducao`)
- Modificar: `src/dados/backup.js` (`validarBackup`)
- Modificar: `src/paginas/Calculadora.jsx` (manda `precoVendaCent` ao gravar)
- Teste: `src/dados/repositorio.producoes.test.js`, `src/dados/backup.test.js`

**Interfaces:**
- Produz: registro de produção com `precoVendaCent: number | null`.

- [ ] **Passo 1: escrever os testes que falham**

Em `src/dados/repositorio.producoes.test.js`:

```js
  // Grava o PREÇO, não a margem, mesmo quando foi a margem que ela digitou. O preço é o
  // fato — o que a cliente pagou. Margem e lucro são leituras dele contra um custo que muda
  // com o tempo; guardar a margem faria o histórico responder "quanto eu cobrava?" com um
  // número que se move.
  it('grava o preço de venda escolhido', async () => {
    const p = await salvarProducao({ ...(await base()), precoVendaCent: 195 })
    expect(p.precoVendaCent).toBe(195)
  })

  it('produção sem preço decidido grava null, não zero', async () => {
    const p = await salvarProducao({ ...(await base()) })
    expect(p.precoVendaCent).toBe(null)
  })

  it('recusa preço de venda negativo', async () => {
    await expect(salvarProducao({ ...(await base()), precoVendaCent: -100 }))
      .rejects.toThrow(/preço/i)
  })
```

Em `src/dados/backup.test.js`, dentro de `describe('validarBackup')`:

```js
  it('recusa produção com preço de venda que não é número', () => {
    const r = validarBackup({
      versao: 1, ingredientes: [], receitas: [],
      producoes: [{ id: 'prod_1', precoVendaCent: 'muito' }],
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/preço/i)
  })
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/dados/repositorio.producoes.test.js src/dados/backup.test.js`
Esperado: FALHA — `expected undefined to be 195`.

- [ ] **Passo 3: implementar o mínimo**

Em `src/dados/repositorio.js`, dentro de `salvarProducao`, antes de montar o `registro`:

```js
  const precoVendaCent = dados?.precoVendaCent === null || dados?.precoVendaCent === undefined
    ? null
    : centavosObrigatorios(dados.precoVendaCent)
  if (precoVendaCent !== null && precoVendaCent < 0) {
    throw new Error('O preço de venda não pode ser negativo.')
  }
```

E no objeto `registro`, depois de `embalagens`:

```js
    precoVendaCent,
```

Em `src/dados/backup.js`, dentro do laço de `obj.producoes` da Task 4, antes da checagem de
`embalagens`:

```js
    if (registro.precoVendaCent !== null && registro.precoVendaCent !== undefined) {
      const preco = Number(registro.precoVendaCent)
      if (!Number.isFinite(preco) || preco < 0) {
        return { ok: false, motivo: 'O backup tem uma produção com preço de venda inválido.' }
      }
    }
```

Em `src/paginas/Calculadora.jsx`, dentro de `gravar`, acrescentar ao objeto de
`salvarProducao`:

```js
        precoVendaCent: precoCent,
```

E `precoCent` às dependências do `useCallback`.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/dados/repositorio.producoes.test.js src/dados/backup.test.js`
Esperado: PASSA.

- [ ] **Passo 5: commitar**

```bash
git add src/dados/repositorio.js src/dados/backup.js src/paginas/Calculadora.jsx src/dados/repositorio.producoes.test.js src/dados/backup.test.js
git commit -m "feat: producao congela o preco de venda escolhido"
```

---

## Task 10: a próxima vez já vem preenchida

**Arquivos:**
- Modificar: `src/paginas/Calculadora.jsx`
- Teste: `src/paginas/Calculadora.test.jsx`

**Interfaces:**
- Consome: `precoVendaCent` e `embalagens` do registro de produção (Tasks 3 e 9).

**Regra de origem** (esclarece a spec): o **preço** vem da última produção daquele doce que
tenha `precoVendaCent`; a **embalagem** vem da última produção daquele doce, com preço ou sem.
São dois "da última vez" diferentes de propósito — ela sempre vê o preço que cobra, e sempre
vê o embrulho que usou.

- [ ] **Passo 1: escrever os testes que falham**

```js
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

  it('e com a embalagem da última produção, para ela conferir', () => {
    montar({ producoes: [PRODUCAO_ANTERIOR] })
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
```

Definir `OUTRO_DOCE` junto do `BRIGADEIRO` no topo do arquivo:

```js
const OUTRO_DOCE = { id: 'rec_2', nome: 'Beijinho', rendimentoBase: 40, margemPct: null, itens: [] }
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/paginas/Calculadora.test.jsx`
Esperado: FALHA — `expected '' to be '3,00'`.

- [ ] **Passo 3: implementar o mínimo**

Em `src/paginas/Calculadora.jsx`. O padrão é **derivar, não sincronizar por efeito** — é a
regra escrita em `Calculadora.jsx:24-26`, e um efeito aqui erraria no caso de ela escolher o
doce antes de os dados chegarem do banco.

1. Trocar o estado `editado` por um que carrega de qual doce ele é:

```js
  const [editado, setEditado] = useState({ receitaId: null, fonte: null, texto: '' })
```

2. Depois de `producoesDoDoce`, calcular as duas origens:

```js
  // Duas leituras diferentes de "da última vez", de propósito: ela sempre vê o preço que
  // cobra (mesmo que a última fornada não tenha tido preço) e sempre vê o embrulho que usou.
  const ordenadas = useMemo(
    () => [...producoesDoDoce].sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))),
    [producoesDoDoce],
  )
  const ultimaProducao = ordenadas[0] ?? null
  const ultimaVenda = ordenadas.find(
    (p) => p.precoVendaCent !== null && p.precoVendaCent !== undefined,
  ) ?? null
```

3. O valor de partida, com a migração da v1 no meio:

```js
  // A ordem é a migração inteira: última venda; senão a margem gravada na v1 (e aí a tela
  // mostra exatamente o preço que mostrava antes); senão vazio. Nenhum dado é reescrito.
  const vendaDePartida = useMemo(() => {
    if (ultimaVenda) {
      return { fonte: 'preco', texto: centavosParaCampo(ultimaVenda.precoVendaCent) }
    }
    const daMargemAntiga = precoSugerido(custoUnitarioCent, receita?.margemPct)
    if (daMargemAntiga !== null) {
      return { fonte: 'preco', texto: centavosParaCampo(daMargemAntiga) }
    }
    return { fonte: null, texto: '' }
  }, [ultimaVenda, custoUnitarioCent, receita])

  // Digitar é simulação e morre ao trocar de doce: o preço só vira "a última venda" quando
  // ela toca em Salvar produção, que é quando ela afirma que aquilo aconteceu.
  const venda = editado.receitaId === receita?.id ? editado : vendaDePartida
```

E trocar todo uso de `editado.fonte` / `editado.texto` nos cálculos por `venda.fonte` /
`venda.texto`.

4. `aoMudarVenda` passa a carimbar o doce:

```js
  const aoMudarVenda = useCallback((fonte, texto) => {
    setEditado({ receitaId: receita?.id ?? null, fonte, texto })
    setSalvo(false)
  }, [receita])
```

5. A embalagem, mesma ideia — trocar o `useState` de `linhasEmbalagem` por um que carrega o
   doce, e derivar a partida:

```js
  const [embalagemEditada, setEmbalagemEditada] = useState({ receitaId: null, linhas: null })

  const embalagemDePartida = useMemo(() => {
    const salvas = ultimaProducao?.embalagens ?? []
    if (salvas.length === 0) return [{ chave: 'emb_0', quantidade: '', preco: '' }]
    // Vem COMO ESTAVA, sem escalar com o rendimento: se da última vez foram 65 forminhas e
    // hoje rendeu 50, o app mostra 65 e espera ela corrigir. Escalar sozinho seria pôr um
    // número que ela não conferiu no campo cujo propósito é ser conferido.
    return salvas.map((l, i) => ({
      chave: `emb_${i}`,
      quantidade: String(l.quantidade),
      preco: centavosParaCampo(l.precoUnitarioCent),
    }))
  }, [ultimaProducao])

  const linhasEmbalagem = embalagemEditada.receitaId === receita?.id
    ? embalagemEditada.linhas
    : embalagemDePartida
```

E `aoMudarLinha` / `acrescentarLinha` passam a escrever
`setEmbalagemEditada({ receitaId: receita?.id ?? null, linhas: ... })`, partindo de
`linhasEmbalagem`.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/paginas/Calculadora.test.jsx`
Esperado: PASSA.

- [ ] **Passo 5: rodar a suíte inteira e commitar**

```bash
npx vitest run --no-file-parallelism
git add src/paginas/Calculadora.jsx src/paginas/Calculadora.test.jsx
git commit -m "feat: calculadora abre com o preco da ultima venda e a embalagem da ultima producao"
```

---

## Task 11: a margem sai do cadastro do doce

**Arquivos:**
- Modificar: `src/paginas/FolhaEditarDoce.jsx` (tirar o campo)
- Modificar: `src/dados/repositorio.js` (`salvarReceita` preserva `margemPct`)
- Teste: `src/paginas/FolhaEditarDoce.test.jsx`, `src/dados/repositorio.receitas.test.js`

**Interfaces:**
- Produz: `salvarReceita(dados, id)` que, ao editar, **ignora** `dados.margemPct` e mantém o
  valor já gravado.

- [ ] **Passo 1: escrever os testes que falham**

Em `src/dados/repositorio.receitas.test.js`:

```js
  // A margem saiu da tela, mas continua no dado: é dela que o passo 2 da migração tira o
  // preço de um doce nunca vendido. Se a edição apagasse o valor, o doce perderia o preço
  // que mostrava na primeira vez que ela mexesse em qualquer outra coisa.
  it('editar o doce preserva a margem gravada, mesmo sem o formulário mandar', async () => {
    const criada = await salvarReceita({
      nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200, itens: [],
    })
    const editada = await salvarReceita(
      { nome: 'Brigadeiro', rendimentoBase: 60, itens: [] },
      criada.id,
    )
    expect(editada.margemPct).toBe(200)
    expect(editada.rendimentoBase).toBe(60)
  })

  it('doce novo sem margem nasce com margem null', async () => {
    const r = await salvarReceita({ nome: 'Beijinho', rendimentoBase: 40, itens: [] })
    expect(r.margemPct).toBe(null)
  })
```

Em `src/paginas/FolhaEditarDoce.test.jsx`:

```js
  it('não pede mais margem de lucro — isso se decide na calculadora agora', () => {
    montar()
    expect(screen.queryByLabelText(/margem de lucro/i)).toBe(null)
  })
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/dados/repositorio.receitas.test.js src/paginas/FolhaEditarDoce.test.jsx`
Esperado: FALHA — `expected null to be 200` no primeiro, e o campo ainda encontrado no
terceiro.

- [ ] **Passo 3: implementar o mínimo**

Em `src/dados/repositorio.js`, `salvarReceita` já lê a receita antiga para preservar
`criadoEm`. Usar a mesma leitura para a margem — substituir o bloco de validação de margem
por:

```js
  // A margem saiu do cadastro e é decidida na calculadora, mas continua no dado: é dela que
  // sai o preço de um doce nunca vendido (migração da v1). Numa edição, o valor gravado
  // manda — o formulário não fala mais sobre isso, e ler o silêncio dele como `null`
  // apagaria o preço do doce.
  const margem = anterior ? anterior.margemPct : dados?.margemPct
  const margemPct =
    margem === null || margem === undefined || margem === '' ? null : Number(margem)
  if (margemPct !== null && !Number.isFinite(margemPct)) {
    throw new Error('A margem não é um número.')
  }
  if (margemPct !== null && margemPct <= -100) {
    throw new Error('A margem não pode ser -100% ou menos — isso deixaria o preço em zero ou negativo.')
  }
```

**Atenção à ordem, e ela importa:** hoje o bloco da margem está em `repositorio.js:109-119`,
e a receita já gravada só é lida em `repositorio.js:149` (`const anterior = id ? ... : null`).
Ou seja, **o bloco tem que descer**: recorte-o de onde está e cole logo depois da linha
`if (id && !anterior) throw new Error('Doce não encontrado.')`, senão `anterior` ainda é
`undefined` quando a margem for lida.

Em `src/paginas/FolhaEditarDoce.jsx`:
- Apagar o `<CampoNumero id="doce-margem" ...>` inteiro (linhas 156-163).
- Apagar o `useState` de `margem` (linhas 35-37).
- Tirar `margemPct: ...` do objeto que vai para `salvarReceita` (linha 102).

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/dados/repositorio.receitas.test.js src/paginas/FolhaEditarDoce.test.jsx`
Esperado: PASSA.

- [ ] **Passo 5: rodar tudo, conferir o build e commitar**

```bash
npx vitest run --no-file-parallelism
npx vite build
git add src/paginas/FolhaEditarDoce.jsx src/dados/repositorio.js src/paginas/FolhaEditarDoce.test.jsx src/dados/repositorio.receitas.test.js
git commit -m "feat: margem sai do cadastro do doce e passa a viver na calculadora"
```

---

## Fechamento

- [ ] Atualizar `docs/v1.1-backlog.md`: o item 1 está feito, e a spec o substituiu.
- [ ] Conferir na tela de verdade (`npm run dev`): escolher um doce, digitar embalagem,
      digitar preço, ver margem e lucro mexerem, salvar produção, voltar e ver preenchido.
- [ ] A guarda de margem ≤ −100% em `salvarReceita` agora só é alcançável por importação de
      backup. Ela fica — é integridade de dado — e a nota de dívida na spec explica por quê.
