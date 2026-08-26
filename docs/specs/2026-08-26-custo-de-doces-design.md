# Lariano Doces — custo de fabricação

Spec de design · 2026-08-26

## O problema

Ela faz doce e não sabe quanto custou. Hoje o preço de venda sai do chute, e quando o
leite condensado sobe ninguém percebe — o lucro encolhe calado.

O app responde uma pergunta só: **fiz X unidades de tal doce; quanto custou?** Ele guarda
as receitas e os preços dos ingredientes para que, da segunda vez em diante, responder
essa pergunta seja escolher o doce e digitar quantas rendeu.

Usuária: uma pessoa, no celular, sem login. Não é ferramenta de gestão — é uma calculadora
que lembra das coisas.

## Decisões

| Decisão | Por quê |
| --- | --- |
| Ingrediente é cadastro **global**, não da receita | Quando o Toddy sobe, ela edita num lugar só e todas as receitas se recalculam. Preço dentro da receita obrigaria a caçar Toddy em brigadeiro, beijinho, bolo... |
| Receita guarda **só quantidade**, nunca preço | Consequência da decisão acima. O preço entra no momento do cálculo. |
| **Dois campos**: nº de receitas e rendimento | "Rendeu 60" é ambíguo: pode ser receita e meia (gastou 1,5× o ingrediente) ou uma receita enrolada menor (gastou 1×). Assumir sempre proporcional erraria o custo total justo nos dias de rendimento alto. |
| Produção guarda o custo **congelado** | Se o leite condensado subir em novembro, a produção de agosto tem que continuar mostrando o custo de agosto. Recalcular apagaria a única informação que o histórico oferece. |
| Preço em **centavos inteiros** | Somar quinze floats produz `32.400000000000006`. A usuária digita reais; o app guarda centavos. |
| Dados no **próprio aparelho** (IndexedDB) | Sem servidor, sem login, sem internet, abre instantâneo. O preço é o risco de perda — coberto por backup em arquivo. |
| Uma tela + **folhas** que sobem de baixo | Preserva a promessa "abriu, escolheu, viu o preço". Acordeão numa rolagem só faria a calculadora sumir pra cima conforme o cadastro cresce. |

## Modelo de dados

Três gavetas no IndexedDB, banco `lariano-doces`.

### `ingredientes`

```js
{
  id: 'ing_a1b2c3',
  nome: 'Toddy',
  unidade: 'g' | 'ml' | 'un',
  embalagemQtd: 400,        // quanto vem no pacote, na unidade acima
  embalagemPrecoCent: 1000, // R$ 10,00
  atualizadoEm: '2026-08-26'
}
```

`embalagemPrecoCent` pode ser `null` — ingrediente cadastrado sem preço ainda. Isso não é
erro; é estado válido, tratado em **Estados de erro**.

Unidade não tem caso especial. Doce de leite é `{ unidade: 'un', embalagemQtd: 1,
embalagemPrecoCent: 850 }` e cai na mesma fórmula. Forminha é `{ unidade: 'un',
embalagemQtd: 100, embalagemPrecoCent: 500 }`.

Índice por nome normalizado (minúsculo, sem acento) para a busca do campo de ingrediente e
para impedir dois "Toddy".

### `receitas`

```js
{
  id: 'rec_x9y8z7',
  nome: 'Brigadeiro',
  rendimentoBase: 50,        // quanto UMA receita rende normalmente
  margemPct: 200,            // null = não calcula preço de venda
  itens: [
    { ingredienteId: 'ing_a1b2c3', quantidade: 80 }   // na unidade do ingrediente
  ],
  criadoEm: '2026-08-26'
}
```

`rendimentoBase` serve para duas coisas: preencher o campo de rendimento como sugestão, e
ser a referência do aviso de rendimento estranho.

### `producoes`

```js
{
  id: 'prod_...',
  receitaId: 'rec_x9y8z7',
  nomeReceita: 'Brigadeiro',   // copiado: a receita pode ser renomeada ou apagada depois
  receitasFeitas: 1,
  rendimento: 50,
  custoTotalCent: 3250,
  custoUnitarioCent: 65,
  parcial: false,              // true se algum ingrediente estava sem preço
  data: '2026-08-26'
}
```

## Regras de cálculo

Tudo em `src/motor/custo.js`: funções puras, sem tocar em banco nem em tela.

```
custo do item = (quantidade usada ÷ embalagemQtd) × embalagemPrecoCent

custo da receita = soma dos itens
custo total      = custo da receita × receitasFeitas
custo unitário   = custo total ÷ rendimento
```

Exemplo, brigadeiro — uma receita, rendimento base 50:

```
Leite condensado  (395 g — R$ 6,50)   ·  790 g → R$ 13,00
Granulado         (500 g — R$ 15,00)  ·  250 g → R$  7,50
Creme de leite    (200 g — R$ 5,00)   ·  200 g → R$  5,00
Manteiga          (500 g — R$ 12,00)  ·  100 g → R$  2,40
Toddy             (400 g — R$ 10,00)  ·   80 g → R$  2,00
Forminha          (100 un — R$ 5,20)  ·   50 un → R$  2,60
                                        receita  R$ 32,50
```

Com preço de venda:

```
preço sugerido = custo unitário × (1 + margemPct ÷ 100)
lucro          = (preço sugerido − custo unitário) × rendimento
```

Arredondamento — a ordem importa. O **custo unitário é arredondado primeiro**, e o preço
de venda e o lucro derivam dele já arredondado. Assim os números da tela fecham entre si:
`0,65 × 3 = 1,95` é conferível a olho. Derivar do valor cheio produziria "cada R$ 0,65,
vender a R$ 1,94", que lê como erro de conta e destrói a confiança dela no app.

O custo total exibido é sempre o valor real da soma, não `cada × rendimento`. Quando a
divisão não é exata os dois divergem por centavos, e a soma é que está certa.

### Aviso de rendimento estranho

Se `rendimento ÷ receitasFeitas` sair mais de **40%** fora de `rendimentoBase`, aparece sob
o resultado um aviso discreto, não bloqueante:

> R$ 3,25 cada, bem acima do R$ 0,65 de sempre — conferiu o rendimento?

Ela ignora se estiver certo. O aviso existe porque precificar em cima de um custo errado é
um estrago que só aparece no fim do mês. Não aparece na primeira produção de um doce — não
há "de sempre" com que comparar.

## A tela

```
Lariano Doces                    ⚙

O que você fez?
[ Brigadeiro                   ▾ ]

Rendeu quantos?
[ 50                            ]
  1 receita  ›                       ← chip; toca e abre o campo

┌──────────────────────────────┐
│  Custou      R$ 32,50        │
│  Cada        R$ 0,65         │
│  ──────────────────────────  │
│  Vender a    R$ 1,95         │
│  Lucro       R$ 65,00        │
└──────────────────────────────┘

ver ingredientes ▾
[      Salvar produção         ]

Meus doces  ·  Histórico
```

O bloco de venda só aparece se a receita tiver `margemPct`.

`ver ingredientes` expande o detalhamento. O formato do parêntese é requisito, não enfeite:
é assim que ela confere de bate-pronto se o preço cadastrado ainda é o do mercado.

```
Leite condensado (395 g — R$ 6,50) · usou 790 g → R$ 13,00
```

O resultado recalcula ao vivo conforme ela digita. `Salvar produção` só grava no histórico
— não é o que faz o preço aparecer.

### As folhas

Sobem de baixo, ocupam quase toda a tela, fecham no botão, no arrastar para baixo e no
voltar do Android.

1. **Meus doces** — lista das receitas + "novo doce". Toque abre a edição.
2. **Editar doce** — nome, rendimento base, margem, linhas de ingrediente, `+ ingrediente`,
   apagar. Cada linha é ingrediente + quantidade, com a unidade vindo do cadastro.
3. **Ingredientes** — lista com preço e data da última atualização, **mais antigos no
   topo**: é assim que ela enxerga o que está desatualizado. Toque edita o preço.
4. **Histórico** — últimas produções: data, doce, rendeu, custou, cada. Produção parcial
   fica marcada. Apagar por deslize.
5. **Ajustes** (⚙) — exportar backup, importar backup.

### Cadastro embutido de ingrediente

Na folha **Editar doce**, ao digitar num campo de ingrediente um nome que não existe, o
cadastro abre ali mesmo — unidade, quantidade da embalagem, preço — e ao confirmar volta
para a linha com o foco na quantidade.

Sem isso, cadastrar o primeiro brigadeiro são sete idas e voltas entre duas telas, e ela
desiste no terceiro ingrediente. Este é o requisito que decide se o app é usado ou não.

### Primeiro uso

Sem receita cadastrada, a tela mostra "Você ainda não cadastrou nenhum doce" e um botão
único: **Cadastrar meu primeiro doce**. Nada de calculadora vazia com campos mudos.

## Estados de erro

| Situação | Comportamento |
| --- | --- |
| Ingrediente sem preço numa receita | O total **não soma zero calado**. Mostra `R$ 30,10 (parcial — falta o preço da manteiga)`, nomeando o ingrediente. A produção salva com `parcial: true`. Um custo silenciosamente menor é o caminho mais curto para ela vender no prejuízo. |
| Apagar ingrediente usado em receita | Recusa e diz em quais receitas ele está. |
| Apagar receita com produções no histórico | Permite. O histórico sobrevive pelo `nomeReceita` copiado. |
| Rendimento 0, vazio ou não numérico | Resultado vira travessão. Nunca `NaN`, nunca divisão por zero. |
| Número com vírgula (`8,50`) | Aceito em todo campo numérico; ponto também. `inputMode="decimal"` para abrir o teclado numérico do celular. |
| Nome de doce ou ingrediente repetido | Recusa, comparando sem acento e sem maiúscula. |
| IndexedDB bloqueado (aba anônima) | Aviso claro dizendo que os dados não serão salvos. Não tela branca. |
| Importar backup inválido | Recusa e diz o motivo, sem tocar no que já está salvo. |

## Backup

Exportar grava um `.json` com as três gavetas e um campo `versao`. Importar **substitui**
tudo, com confirmação explícita dizendo quantos doces e ingredientes serão apagados.

Não há mesclagem — juntar dois bancos sem regra de conflito é a forma mais fácil de
duplicar todos os ingredientes.

## Fora de escopo

Estoque, lista de compras, clientes e encomendas, login, foto do doce, múltiplos usuários,
sincronização entre aparelhos.

Mão de obra, gás e luz também ficam fora **por ora**. Se um dia entrarem, entram como custo
fixo por receita: um campo em `receitas`, uma parcela na soma. Nada do que está acima muda.

## Stack e estrutura

React 19 + Vite + vitest, o mesmo padrão de `costura santa`. Sem biblioteca de UI, sem
gerenciador de estado, sem router — é uma tela.

```
src/
  App.jsx                     tela; monta a calculadora e abre as folhas
  main.jsx
  componentes/
    Folha.jsx                 bottom sheet genérica (foco preso, fecha no voltar)
    CampoNumero.jsx           aceita vírgula, inputMode decimal
    CampoMoeda.jsx            digita reais, guarda centavos
  paginas/
    Calculadora.jsx
    FolhaDoces.jsx
    FolhaEditarDoce.jsx
    FolhaIngredientes.jsx
    FolhaHistorico.jsx
    FolhaAjustes.jsx
  motor/
    custo.js                  puras: custoDoItem, custoDaProducao, precoSugerido,
                              rendimentoSuspeito
  dados/
    indexeddb.js              acesso cru; ninguém fora de repositorio.js importa
    repositorio.js
    useDados.js               hook único que a tela consome
    backup.js                 exportar / importar
  lib/
    numeroBR.js               parse de "8,50"
    formato.js                formatBRL, formatarDataBR
    texto.js                  normalizar nome (sem acento, minúsculo)
```

## Testes

TDD: teste antes do código, em vitest.

- **`motor/custo.test.js`** — o coração. Escala por nº de receitas; unitário por
  rendimento; unidade vs grama; margem; ingrediente sem preço marca parcial e não soma
  zero; rendimento zero; aviso de rendimento estranho dentro e fora do limiar; primeira
  produção não avisa; preço de venda deriva do custo unitário **já arredondado**, de forma
  que `cada × (1 + margem)` fecha com o "vender a" exibido.
- **`lib/numeroBR.test.js`** — vírgula, ponto, vazio, texto, negativo.
- **`lib/texto.test.js`** — "Açúcar" e "acucar" são o mesmo nome.
- **`dados/repositorio.test.js`** (fake-indexeddb) — salvar e ler receita; recusa de apagar
  ingrediente em uso; produção guarda custo congelado e não muda quando o preço do
  ingrediente muda depois.
- **`dados/backup.test.js`** — exportar e importar devolve estado idêntico; arquivo inválido
  não destrói o que estava salvo.
- **`App.test.jsx`** — o caminho da primeira vez, de ponta a ponta: sem doce → cadastra
  brigadeiro com dois ingredientes (um deles cadastrado embutido) → volta → digita 50 → vê
  `R$ 0,65 cada`.

## Publicação

`vite build` → **GitHub Pages**, repositório público, na conta **pessoal**
(`luizctcfilho@gmail.com`). Os dados vivem no aparelho dela; o código não guarda preço
nenhum. HTTPS é requisito do service worker, e o Pages já entrega.

Identidade do git travada **no local do projeto**, não herdada do global:

```
git config --local user.name  "Luiz Carlos"
git config --local user.email "luizctcfilho@gmail.com"
```

Travar local em vez de confiar no global porque os commits do `costura santa` saíram parte
com `infor.ia@grupodeltapb.com.br` — sem trava, o e-mail da empresa escapa para o histórico
público de um projeto pessoal.

O `base` do Vite aponta para o nome do repositório. Sem isso o Pages serve os assets a
partir de `/` e a página abre em branco.

PWA mínimo: `manifest.json` com nome, cor e ícone, e um service worker que faz cache do
shell para abrir sem internet. Ela salva na tela inicial e abre como app.

## Pronto quando

1. Ela cadastra um doce com ingredientes em grama e em unidade, e o custo bate com a conta
   feita na mão.
2. Da segunda vez, escolher o doce e digitar o rendimento mostra o preço sem mais nada.
3. Mudar o preço de um ingrediente muda o custo de todos os doces que o usam, e **não** muda
   nenhuma produção já salva.
4. Um ingrediente sem preço produz aviso visível, nunca um total menor sem explicação.
5. Exportar, apagar tudo e importar devolve o mesmo estado.
6. Abre no celular pelo ícone da tela inicial, sem internet.
7. `npm test` verde.
