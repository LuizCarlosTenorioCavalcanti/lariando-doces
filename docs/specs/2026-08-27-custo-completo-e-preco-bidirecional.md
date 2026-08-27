# Spec — custo completo e preço bidirecional (v1.1)

Data: 2026-08-27. Origem: item 1 do `docs/v1.1-backlog.md`, ampliado no brainstorm com o
Luiz. Substitui o item 1 do backlog.

## O problema

Hoje a margem de lucro é digitada no cadastro do doce e a calculadora só sabe ir num
sentido: margem → preço. Duas coisas quebram nisso.

A primeira é que o número estável do negócio dela **não é a margem, é o preço**. Ela não
muda o preço do beijinho toda semana; ela descobre que a margem apertou quando o leite
condensado sobe. Guardar a margem e derivar o preço faz o preço subir sozinho na tela — o
oposto do que acontece na vida.

A segunda é que **o custo está incompleto**. Saquinho, forminha e caixa não entram na conta.
Decidir preço em cima de um custo que ignora a embalagem é decidir errado, e errado para
menos: ela acha que tem 300% de margem e tem menos.

Por isso as duas coisas são um trabalho só, nesta ordem: o custo fica completo, depois o
preço fica bidirecional. A ordem não é arbitrária — a metade de cima existe para a metade
de baixo não mentir.

## O que muda para a Lara

Ela escolhe o doce e diz quanto rendeu, como hoje. Se usou embalagem, digita quantas e
quanto custou cada uma; se mandou em pote retornável, deixa em branco e não entra custo
nenhum. O "Custou" e o "Cada" já saem com a embalagem dentro.

Embaixo, três números ligados: **preço de venda**, **margem** e **lucro da fornada**. Ela
digita qualquer um dos três e os outros dois se ajustam. "A cliente quer por R$ 3, dá?" é
preço. "Preciso tirar R$ 80 dessa fornada" é lucro. "Estou ganhando pouco nesse doce?" é
margem.

Da segunda produção de cada doce em diante, o preço e a embalagem da última vez já vêm
preenchidos — ela confere e muda se precisar.

## Fase 1 — o custo fica completo

### Modelo

A embalagem **não é cadastrada em lugar nenhum**. É preenchida na calculadora, na hora, como
uma lista de linhas:

```js
{ quantidade: number, precoUnitarioCent: number }
```

Zero, uma ou várias linhas ("+ embalagem" acrescenta). O mesmo campo resolve os dois casos
que existem, porque nos dois é *quantos* × *quanto cada*: 65 forminhas a R$ 0,05, ou 1 caixa
a R$ 2,50.

Esta decisão foi tomada contra três alternativas mais estruturadas (embalagem como linha da
receita com escala própria; campos de embalagem no cadastro do doce; embalagem apontando
para um ingrediente já cadastrado). Todas foram descartadas pelo mesmo motivo: a embalagem
**nem sempre tem custo** — parte do que ela manda vai em vasilha retornável — e cadastro
obriga a declarar antes o que só se sabe na hora.

### Motor

Função nova em `src/motor/custo.js`:

```js
custoDasEmbalagens(embalagens) -> { totalCent, incompleta }
```

Regras, e cada uma com o seu porquê:

- **Lista vazia ou ausente → `totalCent: 0`.** Aqui zero é uma afirmação verdadeira ("foi em
  pote retornável"), não um erro. Isso é o **contrário** da regra de `custoDoItem`, que nunca
  devolve `0` num caso de erro justamente porque zero some na soma sem deixar rastro. A
  diferença é real e precisa estar comentada no código: ingrediente sem preço é informação
  que falta; embalagem sem linha é informação que existe e vale zero.
- **Linha pela metade → `incompleta: true`**, e a linha não entra na soma. Vale nos dois
  sentidos: quantidade sem preço e preço sem quantidade. Acende o aviso de `parcial` que já
  existe, com o texto "falta o preço da embalagem". É o estado de quem está no meio da
  digitação, e some sozinho quando ela termina.
- **Quantidade ou preço negativo → a linha não entra e marca `incompleta`.** Mesma regra de
  `custoDoItem`: dedo errado não pode baratear o doce.
- **Linha totalmente vazia é ignorada em silêncio**, sem marcar `incompleta`. É a linha que
  o "+ embalagem" acabou de criar.

`custoDaProducao` passa a receber `embalagens` e muda em dois pontos:

```
custoTotalCent   = round(custoDaReceita × receitasFeitas + custoDasEmbalagens)
custoUnitarioCent = round(total não arredondado / rendimento)
```

**A embalagem NÃO é multiplicada por `receitasFeitas`.** Ingrediente escala com quantas
receitas saíram do armário; embalagem não escala com nada, porque ela digitou a quantidade
que de fato usou. Multiplicar seria cobrar 130 forminhas de quem fez duas receitas e usou 65.

`parcial` passa a ser `semPreco.length > 0 || embalagemIncompleta`.

### Persistência

`salvarProducao` grava `embalagens` como está, validando cada linha: números finitos e não
negativos. Uma produção antiga sem o campo lê como `[]`.

O `custoTotalCent` gravado já vem com a embalagem dentro, então o histórico continua
verdadeiro sem precisar recalcular nada.

### Tela

Uma linha de embalagem entra na calculadora, entre o chip de receitas e o bloco de
resultado:

```
Embalagem  [ 1  ] × [ R$ 2,50 ]        + embalagem
```

Vazia por padrão, exceto quando vem preenchida da última produção daquele doce (Fase 2).
Nesse caso ela vem **como estava**, sem escalar com o rendimento: se da última vez foram 65
forminhas e hoje rendeu 50, o app mostra 65 e espera ela corrigir. Escalar sozinho seria o
app inventar um número que ela não conferiu, no campo cujo propósito é justamente ser
conferido.

O detalhamento ("ver ingredientes") ganha as linhas de embalagem no fim,
separadas das de ingrediente, para ela enxergar quanto do custo é massa e quanto é embrulho.

## Fase 2 — o preço fica bidirecional

### O triângulo

Com custo unitário `C` (centavos) e rendimento `R` (unidades), os três números são o mesmo
fato visto de três ângulos:

| Digitou | Preço `P` | Margem `M` (%) | Lucro `L` (centavos, fornada) |
| --- | --- | --- | --- |
| `P` | como digitado | `(P − C) / C × 100` | `round((P − C) × R)` |
| `M` | `round(C × (1 + M/100))` | como digitado | `round((P − C) × R)` |
| `L` | `round(C + L/R)` | `(P − C) / C × 100` | como digitado |

`precoSugerido` e `lucroDaProducao` já existem e já fazem duas dessas contas; o que entra é
a volta (`P → M` e `L → P`).

### A regra que faz a tela não pular

**O campo que ela digitou manda, e o app nunca reescreve o que ela acabou de digitar.** Só
os outros dois são recalculados.

O estado é um par: qual campo é a fonte, e o texto cru dela.

```js
{ fonte: 'preco' | 'margem' | 'lucro' | null, texto: string }
```

Digitar em outro campo troca a fonte, e o campo novo começa com o valor que estava exibido
nele. Sem essa regra, arredondar a margem em `P → M` mexeria no preço em `M → P`, e o preço
"pularia" sozinho sob o dedo dela enquanto digita — o defeito clássico de campo
bidirecional.

Arredondamento é consequência direta da mesma regra: margem em % inteiro, preço e lucro em
centavos, e **quem arredonda é sempre o derivado, nunca o digitado**.

### Bordas

- **`C === null`** (custo não calculável): o bloco de venda inteiro não aparece, como hoje.
- **`C === 0`**: preço e lucro funcionam; a margem é indefinida (divisão por zero) e mostra
  travessão. Não é hipótese de laboratório — acontece com doce cujos ingredientes estão
  todos sem preço.
- **`R` ausente ou zero**: o bloco de venda inteiro some. Esta borda foi **corrigida na
  execução** (2026-08-27): a spec dizia "preço e margem funcionam, o lucro mostra travessão",
  mas isso é inalcançável — sem rendimento não há por quantos dividir, então `C` já é `null`
  e recai na borda de cima. Rendimento zero é, aliás, o único caminho para `C === null`.
- **Margem digitada ≤ −100%**: preço e lucro mostram travessão e aparece o aviso "Margem de
  −100% ou menos deixaria o preço em zero ou negativo." Ela pode ter digitado um "−" a mais.
- **Preço digitado negativo**: mesmo tratamento — travessão nos derivados e aviso.

> Nota de dívida: o commit `3efac83` (fatia A da v1.1) pôs uma guarda de margem ≤ −100% em
> `salvarReceita`. Quando a margem sair do cadastro, essa guarda deixa de ser alcançável pela
> tela e passa a valer só para dado vindo de importação de backup. Ela **fica** — continua
> sendo integridade de dado — mas a guarda viva do fluxo passa a ser a da calculadora, acima.

### De onde vem o preço já preenchido

Na abertura de cada doce, nesta ordem:

1. **Última produção daquele doce que tenha `precoVendaCent`** → é o preço, e a embalagem
   daquela produção vem junto. (`producoesDoDoce` já é calculado hoje em
   `Calculadora.jsx:51`; a busca é pelo `criadoEm` mais recente.)
2. **Senão, o `margemPct` gravado na receita** (dado da v1) → deriva o preço a partir dele, e
   a tela mostra exatamente o mesmo número que mostra hoje.
3. **Senão** → os três campos vazios. Ela digita um, uma vez na vida daquele doce.

O passo 2 é a migração inteira, e ela é **invisível**: nenhum dado é reescrito, nenhuma tela
avisa nada, e a Lara não percebe que mudou coisa alguma.

### Persistência

`salvarProducao` grava `precoVendaCent` (ou `null` se ela não decidiu preço).

**Digitar não grava nada.** Mexer nos três campos é simulação — "e se eu vendesse a R$ 3?" —
e some quando ela troca de doce ou fecha o app. O preço só vira "a última venda" quando ela
toca em **Salvar produção**, que é o momento em que ela afirma que aquilo aconteceu de
verdade. Sem essa separação, uma simulação curiosa viraria o preço do doce em silêncio.

Grava **o preço, não a margem**, mesmo quando foi a margem que ela digitou. O preço é o fato
— é o que a cliente pagou; margem e lucro são leituras dele contra um custo que muda com o
tempo. Guardar a margem faria o histórico responder "quanto eu cobrava?" com um número que
se move.

### Cadastro do doce

O campo "Margem de lucro" sai da `FolhaEditarDoce`.

`margemPct` **continua no registro da receita** — não há migração destrutiva, e backups da v1
continuam importando. `salvarReceita` passa a **preservar o `margemPct` gravado** ao editar,
em vez de lê-lo do formulário. Sem isso, a primeira edição de qualquer doce apagaria o valor
que o passo 2 usa, e o doce perderia o preço que mostrava.

### Tela

As duas linhas de resultado que existem hoje ("Vender a" e "Lucro", só de leitura) viram
campos digitáveis, e a margem entra como terceiro:

```
─────────────────────────────
Vender a   [ R$ 3,00 ]
Margem     [ 285     ] %
Lucro      [ R$ 155,00 ]
```

Os três ficam no mesmo bloco que hoje mostra o resultado, depois do "Custou" e do "Cada" —
a leitura de cima para baixo continua sendo "custou isso, então vendo por aquilo".

## Backup

`VERSAO_BACKUP` **continua 1**, de propósito. A validação é de igualdade estrita
(`obj.versao !== VERSAO_BACKUP`), então subir para 2 faria o app recusar os backups que ela
já tem guardados — o arquivo que existe para salvá-la é o que pararia de funcionar. Os campos
novos são todos opcionais, e um backup da v1 entra sem eles.

`validarBackup` ganha, na mesma disciplina de validação profunda do arquivo: se `embalagens`
estiver presente numa produção, tem que ser array, e cada linha tem que ter `quantidade` e
`precoUnitarioCent` numéricos e não negativos; se `precoVendaCent` estiver presente, tem que
ser número não negativo. Uma produção malformada aqui derruba o render do histórico — o
mesmo tipo de tela branca que a validação de `itens` já existe para evitar.

## Testes

Fase 1:

- `custoDasEmbalagens`: vazia → 0; linha completa; linha só com quantidade → `incompleta`;
  negativos; linha em branco ignorada sem marcar incompleta.
- `custoDaProducao`: embalagem entra no total; **não** multiplica por `receitasFeitas`; entra
  no custo unitário; `parcial` acende por embalagem incompleta.
- `salvarProducao`: grava e valida `embalagens`; produção antiga sem o campo lê como `[]`.
- Calculadora: digitar embalagem muda "Custou" e "Cada"; deixar vazio não muda nada.

Fase 2:

- Motor: as três voltas e os arredondamentos, incluindo ida-e-volta (`P → M → P` fecha).
- Bordas: `C = 0`, `R = 0`, margem ≤ −100, preço negativo.
- Calculadora: digitar preço mexe em margem e lucro; digitar margem mexe em preço e lucro;
  digitar lucro mexe em preço e margem; **o campo digitado nunca é reescrito** — é o teste
  que mais importa, o que prova que a tela não pula sob o dedo dela.
- Preenchimento: com última venda; sem venda mas com `margemPct` da v1 (mostra o mesmo preço
  de hoje); sem nada (vazio).
- `salvarReceita` preserva `margemPct` ao editar; `FolhaEditarDoce` não tem mais o campo.
- Backup: v1 sem os campos novos importa; produção com `embalagens` malformada é recusada.

## Fora de escopo

- Peso por unidade (item 2 do backlog) — segue parqueado.
- Rótulos do cadastro de ingrediente (item 3) — trabalho de tela, para decidir com a usuária
  na frente.
- Margem padrão nos Ajustes — descartada no brainstorm. Resolveria só a primeira produção de
  cada doce, ao preço de um ajuste que ela teria que descobrir que existe.
