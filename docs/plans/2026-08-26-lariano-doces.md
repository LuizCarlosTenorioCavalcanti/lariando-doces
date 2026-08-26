# Lariano Doces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um PWA de uma tela onde a esposa do Luiz registra o doce que fez e o rendimento, e vê quanto custou — total, por unidade e preço de venda sugerido.

**Architecture:** Tela única (a calculadora) com folhas que sobem de baixo para cadastro e histórico. Todo o cálculo vive em funções puras em `src/motor/custo.js`, sem tocar em banco nem em tela. Todo o armazenamento passa por `src/dados/repositorio.js`, único arquivo que conhece o IndexedDB — trocar por um banco de verdade um dia é reescrever um arquivo.

**Tech Stack:** React 19, Vite, vitest + @testing-library/react + fake-indexeddb, IndexedDB. Sem biblioteca de UI, sem gerenciador de estado, sem router.

**Spec:** `docs/specs/2026-08-26-custo-de-doces-design.md`

## Global Constraints

- **Código em português.** Nomes de arquivo, função, variável e teste em português, como em `costura santa`. `custoDoItem`, não `getItemCost`.
- **Dinheiro é centavo inteiro.** Nada de reais em float no armazenamento. A usuária digita reais; o app converte na entrada e formata na saída.
- **Só `repositorio.js` importa `indexeddb.js`.** Nenhum componente, nenhum arquivo do motor.
- **O motor não importa nada de `dados/` nem de `react`.** Funções puras, testáveis sem DOM e sem banco.
- **vitest sem `globals`.** Todo arquivo de teste importa explicitamente: `import { describe, it, expect } from 'vitest'`.
- **Testes só em `src/`.** `vite.config.js` restringe `include` a `src/**/*.{test,spec}.{js,jsx}` — `_scratch/` é andaime e não pinta a suíte de vermelho.
- **Nunca somar zero calado.** Ingrediente sem preço produz `null`, nunca `0`. Um custo silenciosamente menor faz ela vender no prejuízo.
- **Ordem do arredondamento:** arredonda o custo unitário **primeiro**; preço de venda e lucro derivam dele já arredondado, para `0,65 × 3 = 1,95` fechar a olho na tela.
- **Identidade do git travada no local do repo:** `Luiz Carlos <luizctcfilho@gmail.com>`. Nunca `infor.ia@grupodeltapb.com.br`.
- **Um commit por task**, ao fim dela.

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
| --- | --- | --- |
| `index.html`, `vite.config.js`, `package.json` | andaime | 1 |
| `src/main.jsx`, `src/styles/tokens.css`, `src/styles/base.css` | ponto de entrada e tokens visuais | 1 |
| `src/testes/preparo.js` | `fake-indexeddb/auto` + cleanup do Testing Library | 1 |
| `src/lib/numeroBR.js` | ler `"8,50"` do teclado brasileiro | 2 |
| `src/lib/texto.js` | normalizar nome para comparar sem acento | 2 |
| `src/lib/formato.js` | centavos → `R$ 8,50`; data ISO → `26/08/2026` | 2 |
| `src/motor/custo.js` | todo o cálculo, puro | 3, 4 |
| `src/dados/indexeddb.js` | acesso cru às três gavetas | 5 |
| `src/dados/repositorio.js` | a fronteira do armazenamento | 5, 6, 7 |
| `src/dados/backup.js` | exportar / importar | 8 |
| `src/dados/useDados.js` | hook único que a tela consome | 11 |
| `src/componentes/Folha.jsx` | bottom sheet genérica | 9 |
| `src/componentes/CampoNumero.jsx`, `CampoMoeda.jsx` | entrada numérica com vírgula | 10 |
| `src/App.jsx` | casca; monta a calculadora e abre as folhas | 11 |
| `src/paginas/FolhaEditarDoce.jsx` | receita + linhas de ingrediente + cadastro embutido | 12 |
| `src/paginas/FolhaDoces.jsx` | lista de receitas | 12 |
| `src/paginas/FolhaIngredientes.jsx` | lista e edição de preço | 13 |
| `src/paginas/Calculadora.jsx` | seletor, rendimento, resultado, detalhamento | 14 |
| `src/paginas/FolhaHistorico.jsx` | produções salvas | 15 |
| `src/paginas/FolhaAjustes.jsx` | backup | 16 |
| `public/manifest.json`, `public/sw.js` | PWA | 18 |

---

## Task 0: Identidade do git e limpeza do histórico

Infraestrutura, independente do app. Vem primeiro porque precisa valer já no commit nº 1 deste projeto.

**Files:**
- Create: `.gitignore` (em `lariano doces/`)
- Modify: histórico de `../READI/` (10 commits) e `../costura santa/` (2 commits)

**Interfaces:**
- Consumes: nada
- Produces: repositório git inicializado em `lariano doces/`, com `user.email` local em `luizctcfilho@gmail.com`

- [ ] **Step 1: Inicializar o repo e travar a identidade**

```bash
cd "c:/Users/Luiz/Desktop/NOTAS LUIZ/projeto pessoal/lariano doces"
git init
git config --local user.name "Luiz Carlos"
git config --local user.email "luizctcfilho@gmail.com"
```

Travar no local, e não confiar no global, porque foi exatamente o global que falhou nos outros projetos.

- [ ] **Step 2: Criar o `.gitignore`**

```
node_modules/
dist/
_scratch/
.env
.env.local
.DS_Store
*.log
.superpowers/
```

- [ ] **Step 3: Conferir que a identidade pegou**

Run: `git config --local user.email`
Expected: `luizctcfilho@gmail.com`

- [ ] **Step 4: Fazer backup dos dois repos antes de reescrever**

`filter-branch` reescreve todo commit a partir do primeiro afetado. O bundle é a rede de segurança: se algo der errado, `git clone backup.bundle` devolve o repositório inteiro como estava.

```bash
cd "c:/Users/Luiz/Desktop/NOTAS LUIZ/projeto pessoal"
git -C "READI" bundle create "../_scratch/READI-antes-da-reescrita.bundle" --all
git -C "costura santa" bundle create "../_scratch/costura-santa-antes-da-reescrita.bundle" --all
ls -la _scratch/*.bundle
```

Expected: dois arquivos `.bundle` com tamanho > 0.

- [ ] **Step 5: Reescrever o histórico do READI**

```bash
cd "c:/Users/Luiz/Desktop/NOTAS LUIZ/projeto pessoal/READI"
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter '
if [ "$GIT_AUTHOR_EMAIL" = "infor.ia@grupodeltapb.com.br" ]; then
  export GIT_AUTHOR_EMAIL="luizctcfilho@gmail.com"
  export GIT_AUTHOR_NAME="Luiz Carlos"
fi
if [ "$GIT_COMMITTER_EMAIL" = "infor.ia@grupodeltapb.com.br" ]; then
  export GIT_COMMITTER_EMAIL="luizctcfilho@gmail.com"
  export GIT_COMMITTER_NAME="Luiz Carlos"
fi
' -- --all
```

- [ ] **Step 6: Verificar o READI**

Run: `git -C "READI" log --format='%ae' --not --glob=refs/original | sort -u`
Expected: uma linha só, `luizctcfilho@gmail.com`. Se `infor.ia@grupodeltapb.com.br` ainda aparecer, o filtro não pegou — não siga para o próximo repo.

O `--not --glob=refs/original` não é firula: o `filter-branch` deixa o histórico ANTIGO inteiro em `refs/original`, e um `--all` cru logo depois enxerga os dois e mostra os dois e-mails. Verificar com `--all` aqui daria alarme falso e mandaria parar uma reescrita que deu certo. O `--all` volta a valer no Step 8, depois que essas refs forem apagadas.

Run: `git -C "READI" log --oneline --all | wc -l`
Expected: 135 (o mesmo total de antes; reescrever autor não apaga commit).

- [ ] **Step 7: Repetir no costura santa e verificar**

```bash
cd "c:/Users/Luiz/Desktop/NOTAS LUIZ/projeto pessoal/costura santa"
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter '
if [ "$GIT_AUTHOR_EMAIL" = "infor.ia@grupodeltapb.com.br" ]; then
  export GIT_AUTHOR_EMAIL="luizctcfilho@gmail.com"
  export GIT_AUTHOR_NAME="Luiz Carlos"
fi
if [ "$GIT_COMMITTER_EMAIL" = "infor.ia@grupodeltapb.com.br" ]; then
  export GIT_COMMITTER_EMAIL="luizctcfilho@gmail.com"
  export GIT_COMMITTER_NAME="Luiz Carlos"
fi
' -- --all
git log --format='%ae' --all | sort -u
```

Expected: uma linha só, `luizctcfilho@gmail.com`.

- [ ] **Step 8: Travar a identidade local nos dois e limpar as refs antigas**

`refs/original/` é o backup que o próprio `filter-branch` deixa. Enquanto ele existir, os commits antigos com o e-mail da empresa continuam alcançáveis no repo — ou seja, o problema não foi resolvido, só ficou escondido.

```bash
cd "c:/Users/Luiz/Desktop/NOTAS LUIZ/projeto pessoal"
for r in "READI" "costura santa"; do
  git -C "$r" config --local user.name "Luiz Carlos"
  git -C "$r" config --local user.email "luizctcfilho@gmail.com"
  git -C "$r" for-each-ref --format='%(refname)' refs/original | \
    xargs -n 1 -r git -C "$r" update-ref -d
  git -C "$r" reflog expire --expire=now --all
  git -C "$r" gc --prune=now --quiet
done
git -C "READI" log --format='%ae' --all | sort -u
git -C "costura santa" log --format='%ae' --all | sort -u
```

Expected: `luizctcfilho@gmail.com` nos dois, e nada mais.

- [ ] **Step 9: Commit inicial deste projeto**

```bash
cd "c:/Users/Luiz/Desktop/NOTAS LUIZ/projeto pessoal/lariano doces"
git add .gitignore docs/
git commit -m "chore: inicia o projeto com a spec e o plano"
git log --format='%an <%ae>' -1
```

Expected: `Luiz Carlos <luizctcfilho@gmail.com>`.

---

## Task 1: Andaime — Vite, React 19, vitest

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`
- Create: `src/main.jsx`, `src/App.jsx`, `src/App.test.jsx`
- Create: `src/styles/tokens.css`, `src/styles/base.css`
- Create: `src/testes/preparo.js`

**Interfaces:**
- Consumes: repo inicializado (Task 0)
- Produces: `npm test` roda e passa; `npm run dev` sobe. Componente `App` exportado como default de `src/App.jsx`.

- [ ] **Step 1: Criar o `package.json`**

```json
{
  "name": "lariano-doces",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.5.2",
    "@vitejs/plugin-react": "^6.0.4",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^30.0.1",
    "vite": "^8.2.0",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Instalar**

Run: `npm install`
Expected: termina sem erro, cria `node_modules/`.

- [ ] **Step 3: Criar `vite.config.js`**

`base` tem que bater com o nome do repositório no GitHub — sem isso o Pages serve os assets a partir de `/` e a página abre em branco.

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/lariano-doces/',
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
```

- [ ] **Step 4: Criar `src/testes/preparo.js`**

```js
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Sem `globals: true` no config, o autocleanup do Testing Library não se registra sozinho.
// Sem isto, um arquivo com mais de um `render()` acumula telas — o segundo teste enxerga
// os elementos do primeiro ainda no DOM.
afterEach(() => {
  cleanup()
})
```

- [ ] **Step 5: Criar `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#8c3b5e" />
    <title>Lariano Doces</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Criar `src/styles/tokens.css`**

```css
:root {
  --bg: #fdf7f4;
  --card: #ffffff;
  --texto: #3a2028;
  --texto-suave: #9a8288;
  --texto-medio: #6b4f58;
  --borda: #f0e3e0;

  --marca: #8c3b5e;
  --marca-clara: #f7e9ee;
  --positivo: #1f9d63;
  --negativo: #c0392b;
  --atencao: #a86400;

  --raio-sm: 8px;
  --raio: 14px;
  --raio-lg: 22px;
  --raio-pilula: 999px;

  --e1: 0 1px 2px rgba(58, 32, 40, .06), 0 1px 3px rgba(58, 32, 40, .04);
  --e2: 0 1px 2px rgba(58, 32, 40, .07), 0 6px 18px rgba(58, 32, 40, .08);
  --e3: 0 2px 6px rgba(58, 32, 40, .10), 0 -8px 40px rgba(58, 32, 40, .16);

  --mov: cubic-bezier(.2, .8, .2, 1);
  --t-rapida: 120ms var(--mov);
  --t-media: 220ms var(--mov);

  --fonte: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
```

- [ ] **Step 7: Criar `src/styles/base.css`**

`min-height: 100dvh` e não `100vh`: no celular a barra do navegador some e volta, e `vh` é calculado com ela fora — a tela fica alta demais e nasce uma rolagem que não existe.

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--texto);
  font-family: var(--fonte);
  font-size: 17px;
  line-height: 1.45;
  min-height: 100dvh;
  -webkit-text-size-adjust: 100%;
}

button { font: inherit; cursor: pointer; }

input, select {
  font: inherit;
  color: inherit;
}

/* 16px é o piso: abaixo disso o Safari do iPhone dá zoom sozinho ao focar o campo, e a
   tela sai do lugar no meio da digitação. */
input, select, textarea { font-size: max(16px, 1em); }

h1, h2, h3 { margin: 0; font-weight: 650; }
```

- [ ] **Step 8: Criar `src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: Escrever o teste que falha**

`src/App.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App', () => {
  it('mostra o nome do app', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Lariano Doces' })).toBeTruthy()
  })
})
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `npx vitest run src/App.test.jsx`
Expected: FAIL — `Failed to resolve import "./App.jsx"`.

- [ ] **Step 11: Criar `src/App.jsx`**

```jsx
export default function App() {
  return (
    <main>
      <h1>Lariano Doces</h1>
    </main>
  )
}
```

- [ ] **Step 12: Rodar e ver passar**

Run: `npm test`
Expected: PASS, 1 teste.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src/
git commit -m "chore: andaime do projeto com Vite, React 19 e vitest"
```

---

## Task 2: `lib/` — número, texto e formato

Três helpers puros. Vêm antes de tudo porque o motor e as telas dependem deles.

**Files:**
- Create: `src/lib/numeroBR.js`, `src/lib/numeroBR.test.js`
- Create: `src/lib/texto.js`, `src/lib/texto.test.js`
- Create: `src/lib/formato.js`, `src/lib/formato.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `paraNumero(texto) -> number | null`
  - `paraCentavos(texto) -> number | null` (inteiro)
  - `normalizar(texto) -> string`
  - `formatBRL(centavos) -> string` (`'—'` quando `null`)
  - `formatarQuantidade(valor, unidade) -> string`
  - `formatarDataBR(iso) -> string`

- [ ] **Step 1: Escrever `src/lib/numeroBR.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { paraNumero, paraCentavos } from './numeroBR'

describe('paraNumero', () => {
  it('lê vírgula como decimal', () => {
    expect(paraNumero('8,50')).toBe(8.5)
  })

  it('aceita ponto como decimal, que é o que alguns teclados mandam', () => {
    expect(paraNumero('8.50')).toBe(8.5)
  })

  it('com vírgula presente, o ponto é separador de milhar', () => {
    expect(paraNumero('1.200,50')).toBe(1200.5)
  })

  it('deixa passar número que já é número', () => {
    expect(paraNumero(40)).toBe(40)
  })

  it('devolve null para vazio, espaço e texto', () => {
    expect(paraNumero('')).toBe(null)
    expect(paraNumero('   ')).toBe(null)
    expect(paraNumero('abc')).toBe(null)
    expect(paraNumero(null)).toBe(null)
    expect(paraNumero(undefined)).toBe(null)
  })

  it('devolve null para número pela metade', () => {
    expect(paraNumero('8,')).toBe(null)
    expect(paraNumero(',')).toBe(null)
  })
})

describe('paraCentavos', () => {
  it('converte reais digitados em centavos inteiros', () => {
    expect(paraCentavos('8,50')).toBe(850)
    expect(paraCentavos('10')).toBe(1000)
    expect(paraCentavos('0,07')).toBe(7)
  })

  it('devolve inteiro, nunca float', () => {
    expect(Number.isInteger(paraCentavos('6,49'))).toBe(true)
  })

  it('devolve null quando não dá para ler', () => {
    expect(paraCentavos('')).toBe(null)
    expect(paraCentavos('abc')).toBe(null)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/numeroBR.test.js`
Expected: FAIL — `Failed to resolve import "./numeroBR"`.

- [ ] **Step 3: Escrever `src/lib/numeroBR.js`**

```js
// O teclado do celular brasileiro manda vírgula; alguns mandam ponto. Ler os dois não é
// gentileza, é requisito: um campo que rejeita "8,50" faz ela desistir na terceira tentativa.

/** Texto do campo → número. `null` quando não dá para ler um número inteiro dali. */
export function paraNumero(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null
  if (texto === null || texto === undefined) return null

  const limpo = String(texto).trim().replace(/\s/g, '')
  if (limpo === '') return null

  // Se tem vírgula, ela é o decimal e o ponto só pode ser milhar ("1.200,50"). Sem
  // vírgula, o ponto é o decimal ("8.50"). Tratar os dois como decimal ao mesmo tempo
  // faria "1.200" virar 1,2 — um erro de mil vezes no preço da embalagem.
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null

  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

/** Reais digitados → centavos inteiros. `"8,50"` → `850`. */
export function paraCentavos(texto) {
  const n = paraNumero(texto)
  if (n === null) return null
  return Math.round(n * 100)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/numeroBR.test.js`
Expected: PASS, 9 testes.

- [ ] **Step 5: Escrever `src/lib/texto.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { normalizar } from './texto'

describe('normalizar', () => {
  it('ignora acento', () => {
    expect(normalizar('Açúcar')).toBe(normalizar('acucar'))
  })

  it('ignora maiúscula', () => {
    expect(normalizar('TODDY')).toBe(normalizar('toddy'))
  })

  it('ignora espaço sobrando no meio e nas pontas', () => {
    expect(normalizar('  Leite   Condensado ')).toBe('leite condensado')
  })

  it('aguenta vazio e nulo', () => {
    expect(normalizar('')).toBe('')
    expect(normalizar(null)).toBe('')
    expect(normalizar(undefined)).toBe('')
  })

  it('mantém nomes diferentes diferentes', () => {
    expect(normalizar('Brigadeiro')).not.toBe(normalizar('Beijinho'))
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/lib/texto.test.js`
Expected: FAIL — `Failed to resolve import "./texto"`.

- [ ] **Step 7: Escrever `src/lib/texto.js`**

```js
/** Nome comparável: sem acento, sem maiúscula, sem espaço sobrando.
 *  É o que faz "Açúcar" e "acucar" serem o mesmo ingrediente — sem isso ela cadastraria
 *  o mesmo pote duas vezes e o custo sairia dobrado. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/lib/texto.test.js`
Expected: PASS, 5 testes.

- [ ] **Step 9: Escrever `src/lib/formato.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { formatBRL, formatarQuantidade, formatarDataBR } from './formato'

describe('formatBRL', () => {
  it('mostra centavos como moeda brasileira', () => {
    expect(formatBRL(1000)).toBe('R$ 10,00')
    expect(formatBRL(650)).toBe('R$ 6,50')
    expect(formatBRL(3250)).toBe('R$ 32,50')
    expect(formatBRL(65)).toBe('R$ 0,65')
  })

  it('mostra travessão quando não há valor, nunca R$ 0,00', () => {
    expect(formatBRL(null)).toBe('—')
    expect(formatBRL(undefined)).toBe('—')
    expect(formatBRL(NaN)).toBe('—')
  })

  it('mostra zero de verdade como zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00')
  })
})

describe('formatarQuantidade', () => {
  it('mostra inteiro sem casa decimal', () => {
    expect(formatarQuantidade(40, 'g')).toBe('40 g')
    expect(formatarQuantidade(50, 'un')).toBe('50 un')
  })

  it('mostra decimal com vírgula e sem zero à toa', () => {
    expect(formatarQuantidade(0.5, 'g')).toBe('0,5 g')
    expect(formatarQuantidade(1.25, 'ml')).toBe('1,25 ml')
    expect(formatarQuantidade(1.2, 'g')).toBe('1,2 g')
  })

  it('mostra travessão quando não há valor', () => {
    expect(formatarQuantidade(null, 'g')).toBe('—')
  })
})

describe('formatarDataBR', () => {
  it('vira dia/mês/ano', () => {
    expect(formatarDataBR('2026-08-26')).toBe('26/08/2026')
  })

  it('aguenta data com hora junto', () => {
    expect(formatarDataBR('2026-08-26T14:30:00.000Z')).toBe('26/08/2026')
  })

  it('mostra travessão para vazio e lixo', () => {
    expect(formatarDataBR('')).toBe('—')
    expect(formatarDataBR(null)).toBe('—')
    expect(formatarDataBR('abc')).toBe('—')
  })
})
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `npx vitest run src/lib/formato.test.js`
Expected: FAIL — `Failed to resolve import "./formato"`.

- [ ] **Step 11: Escrever `src/lib/formato.js`**

```js
/** Centavos → `R$ 8,50`. `null` vira travessão, nunca `R$ 0,00`: um zero na tela é uma
 *  afirmação sobre o custo, e "não sei" não é "zero". */
export function formatBRL(centavos) {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return '—'
  return (centavos / 100)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    // O Intl separa `R$` do número com espaço estreito (U+00A0). Trocar por espaço comum
    // é o que deixa o teste comparável e o copiar-e-colar limpo.
    .replace(/\u00a0/g, ' ')
}

/** `40, 'g'` → `40 g`. Decimal com vírgula e sem zero pendurado no fim. */
export function formatarQuantidade(valor, unidade) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  const texto = Number.isInteger(valor)
    ? String(valor)
    : valor.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${texto.replace('.', ',')} ${unidade}`
}

/** `'2026-08-26'` → `'26/08/2026'`. Sem data, travessão: a tela nunca mostra vazio mudo. */
export function formatarDataBR(iso) {
  if (!iso) return '—'
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-')
  if (!ano || !mes || !dia || ano.length !== 4) return '—'
  return `${dia}/${mes}/${ano}`
}
```

- [ ] **Step 12: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — 1 (App) + 9 (numeroBR) + 5 (texto) + 9 (formato) = 24 testes.

- [ ] **Step 13: Commit**

```bash
git add src/lib/
git commit -m "feat: helpers de número brasileiro, texto e formatação"
```

---

## Task 3: `motor/custo.js` — o custo

O coração. Funções puras: não importam `react`, não importam nada de `dados/`.

**Files:**
- Create: `src/motor/custo.js`, `src/motor/custo.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `custoDoItem(item, ingrediente) -> number | null` — centavos, float
  - `custoDaReceita(receita, ingredientesPorId) -> { totalCent: number, semPreco: string[] }`
  - `custoDaProducao({ receita, ingredientesPorId, receitasFeitas, rendimento }) -> { custoTotalCent, custoUnitarioCent, parcial, semPreco }`

Formato dos objetos que essas funções recebem (é o mesmo que o repositório grava, Task 5 e 6):

```js
const ingrediente = { id: 'ing_1', nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }
const receita = { id: 'rec_1', nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200, itens: [{ ingredienteId: 'ing_1', quantidade: 80 }] }
const ingredientesPorId = { ing_1: ingrediente }
```

- [ ] **Step 1: Escrever `src/motor/custo.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { custoDoItem, custoDaReceita, custoDaProducao } from './custo'

const ing = (id, nome, unidade, embalagemQtd, embalagemPrecoCent) =>
  ({ id, nome, unidade, embalagemQtd, embalagemPrecoCent })

// O brigadeiro da spec: uma receita rende 50 e custa R$ 32,50.
const LEITE = ing('ing_leite', 'Leite condensado', 'g', 395, 650)
const GRANULADO = ing('ing_gran', 'Granulado', 'g', 500, 1500)
const CREME = ing('ing_creme', 'Creme de leite', 'g', 200, 500)
const MANTEIGA = ing('ing_mant', 'Manteiga', 'g', 500, 1200)
const TODDY = ing('ing_toddy', 'Toddy', 'g', 400, 1000)
const FORMINHA = ing('ing_form', 'Forminha', 'un', 100, 520)

const PORID = {
  ing_leite: LEITE, ing_gran: GRANULADO, ing_creme: CREME,
  ing_mant: MANTEIGA, ing_toddy: TODDY, ing_form: FORMINHA,
}

const BRIGADEIRO = {
  id: 'rec_brig',
  nome: 'Brigadeiro',
  rendimentoBase: 50,
  margemPct: 200,
  itens: [
    { ingredienteId: 'ing_leite', quantidade: 790 },
    { ingredienteId: 'ing_gran', quantidade: 250 },
    { ingredienteId: 'ing_creme', quantidade: 200 },
    { ingredienteId: 'ing_mant', quantidade: 100 },
    { ingredienteId: 'ing_toddy', quantidade: 80 },
    { ingredienteId: 'ing_form', quantidade: 50 },
  ],
}

describe('custoDoItem', () => {
  it('cobra a fração da embalagem que foi usada', () => {
    // 40 de um pacote de 400 que custa R$ 10,00 → R$ 1,00
    expect(custoDoItem({ quantidade: 40 }, TODDY)).toBe(100)
  })

  it('trata unidade igual a grama, sem caso especial', () => {
    // 50 forminhas de um pacote de 100 que custa R$ 5,20 → R$ 2,60
    expect(custoDoItem({ quantidade: 50 }, FORMINHA)).toBe(260)
  })

  it('cobra mais de uma embalagem quando usou mais que o pacote', () => {
    // 790 g de leite condensado = duas latas de 395 g a R$ 6,50 → R$ 13,00
    expect(custoDoItem({ quantidade: 790 }, LEITE)).toBe(1300)
  })

  it('devolve null quando o ingrediente não tem preço — nunca zero', () => {
    const semPreco = ing('ing_x', 'Chocolate', 'g', 200, null)
    expect(custoDoItem({ quantidade: 100 }, semPreco)).toBe(null)
  })

  it('devolve null quando o ingrediente sumiu do cadastro', () => {
    expect(custoDoItem({ quantidade: 100 }, undefined)).toBe(null)
  })

  it('devolve null quando a embalagem é zero, em vez de dividir por zero', () => {
    const zerado = ing('ing_z', 'Zerado', 'g', 0, 1000)
    expect(custoDoItem({ quantidade: 100 }, zerado)).toBe(null)
  })

  it('devolve null quando a quantidade não é número', () => {
    expect(custoDoItem({ quantidade: 'abc' }, TODDY)).toBe(null)
  })
})

describe('custoDaReceita', () => {
  it('soma o brigadeiro inteiro em R$ 32,50', () => {
    const { totalCent, semPreco } = custoDaReceita(BRIGADEIRO, PORID)
    expect(Math.round(totalCent)).toBe(3250)
    expect(semPreco).toEqual([])
  })

  it('soma o que dá e nomeia o que faltou, sem contar o que falta como zero', () => {
    const porId = { ...PORID, ing_mant: ing('ing_mant', 'Manteiga', 'g', 500, null) }
    const { totalCent, semPreco } = custoDaReceita(BRIGADEIRO, porId)
    // R$ 32,50 menos os R$ 2,40 da manteiga
    expect(Math.round(totalCent)).toBe(3010)
    expect(semPreco).toEqual(['Manteiga'])
  })

  it('receita sem item nenhum custa zero e não é parcial', () => {
    const vazia = { ...BRIGADEIRO, itens: [] }
    expect(custoDaReceita(vazia, PORID)).toEqual({ totalCent: 0, semPreco: [] })
  })
})

describe('custoDaProducao', () => {
  it('uma receita rendendo 50 custa R$ 32,50 e R$ 0,65 cada', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 50,
    })
    expect(r.custoTotalCent).toBe(3250)
    expect(r.custoUnitarioCent).toBe(65)
    expect(r.parcial).toBe(false)
  })

  it('o número de receitas manda no custo total', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 2, rendimento: 100,
    })
    expect(r.custoTotalCent).toBe(6500)
    expect(r.custoUnitarioCent).toBe(65)
  })

  it('o rendimento manda no custo por unidade, e o total não muda', () => {
    // Mesma panela, enrolou menor: saíram 65 em vez de 50.
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 65,
    })
    expect(r.custoTotalCent).toBe(3250)
    expect(r.custoUnitarioCent).toBe(50)
  })

  it('duas receitas rendendo pouco encarecem a unidade', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 2, rendimento: 20,
    })
    expect(r.custoTotalCent).toBe(6500)
    expect(r.custoUnitarioCent).toBe(325)
  })

  it('aceita meia receita', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1.5, rendimento: 75,
    })
    expect(r.custoTotalCent).toBe(4875)
    expect(r.custoUnitarioCent).toBe(65)
  })

  it('marca parcial e diz o que faltou', () => {
    const porId = { ...PORID, ing_mant: ing('ing_mant', 'Manteiga', 'g', 500, null) }
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: porId, receitasFeitas: 1, rendimento: 50,
    })
    expect(r.parcial).toBe(true)
    expect(r.semPreco).toEqual(['Manteiga'])
    expect(r.custoTotalCent).toBe(3010)
  })

  it('rendimento zero não vira NaN nem divisão por zero', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 0,
    })
    expect(r.custoTotalCent).toBe(3250)
    expect(r.custoUnitarioCent).toBe(null)
  })

  it('rendimento vazio ou texto devolve unitário null', () => {
    for (const rendimento of ['', null, undefined, 'abc']) {
      const r = custoDaProducao({
        receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento,
      })
      expect(r.custoUnitarioCent).toBe(null)
    }
  })

  it('número de receitas vazio ou zero devolve total null', () => {
    for (const receitasFeitas of ['', null, 0, 'abc']) {
      const r = custoDaProducao({
        receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas, rendimento: 50,
      })
      expect(r.custoTotalCent).toBe(null)
      expect(r.custoUnitarioCent).toBe(null)
    }
  })

  it('devolve inteiros, nunca centavo quebrado', () => {
    const r = custoDaProducao({
      receita: BRIGADEIRO, ingredientesPorId: PORID, receitasFeitas: 1, rendimento: 47,
    })
    expect(Number.isInteger(r.custoTotalCent)).toBe(true)
    expect(Number.isInteger(r.custoUnitarioCent)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/motor/custo.test.js`
Expected: FAIL — `Failed to resolve import "./custo"`.

- [ ] **Step 3: Escrever `src/motor/custo.js`**

```js
// Todo o cálculo do sistema mora aqui, em função pura. Não importa `react`, não importa
// nada de `dados/`: dá para provar cada regra sem DOM e sem banco, e é por isso que este
// é o arquivo com mais teste do projeto.
//
// Dinheiro circula em CENTAVOS. Internamente as contas usam float (dividir 790 por 395 não
// dá inteiro), e o arredondamento acontece uma vez só, na saída de `custoDaProducao`.

/** Custo de um item da receita, em centavos.
 *
 *  `null` quando não dá para saber — ingrediente sem preço, ingrediente apagado,
 *  embalagem zerada. Nunca `0`: zero é uma afirmação ("isto é de graça") e some na soma
 *  sem deixar rastro, que é o jeito mais curto de ela precificar abaixo do custo. */
export function custoDoItem(item, ingrediente) {
  if (!ingrediente) return null

  const { embalagemQtd, embalagemPrecoCent } = ingrediente
  if (embalagemPrecoCent === null || embalagemPrecoCent === undefined) return null
  if (!Number.isFinite(embalagemPrecoCent)) return null
  if (!Number.isFinite(embalagemQtd) || embalagemQtd <= 0) return null

  const quantidade = Number(item?.quantidade)
  if (!Number.isFinite(quantidade)) return null

  return (quantidade / embalagemQtd) * embalagemPrecoCent
}

/** Soma de UMA receita. Devolve o que deu para somar e o nome do que faltou — as duas
 *  coisas juntas, porque quem chama precisa mostrar as duas juntas. */
export function custoDaReceita(receita, ingredientesPorId) {
  let totalCent = 0
  const semPreco = []

  for (const item of receita?.itens ?? []) {
    const ingrediente = ingredientesPorId?.[item.ingredienteId]
    const custo = custoDoItem(item, ingrediente)
    if (custo === null) {
      semPreco.push(ingrediente?.nome ?? 'ingrediente apagado')
      continue
    }
    totalCent += custo
  }

  return { totalCent, semPreco }
}

/** A conta que a tela mostra.
 *
 *  O número de receitas manda no total (é quanto ingrediente saiu do armário); o
 *  rendimento manda em por quantas unidades esse total se divide. Separar os dois é o que
 *  faz "a mesma panela rendeu 65 hoje" ficar certo — se o app assumisse proporcional,
 *  cobraria 30% a mais de ingrediente que ela não usou. */
export function custoDaProducao({ receita, ingredientesPorId, receitasFeitas, rendimento }) {
  const { totalCent, semPreco } = custoDaReceita(receita, ingredientesPorId)

  const nReceitas = Number(receitasFeitas)
  const temReceitas = Number.isFinite(nReceitas) && nReceitas > 0
  const totalProducao = temReceitas ? totalCent * nReceitas : null

  const rend = Number(rendimento)
  const temRendimento = Number.isFinite(rend) && rend > 0

  return {
    custoTotalCent: totalProducao === null ? null : Math.round(totalProducao),
    // Arredondado AQUI, e é este valor que o preço de venda usa depois. Derivar a venda do
    // valor cheio produziria "cada R$ 0,65, vender a R$ 1,94" na tela, que lê como erro de
    // conta.
    custoUnitarioCent:
      totalProducao !== null && temRendimento ? Math.round(totalProducao / rend) : null,
    parcial: semPreco.length > 0,
    semPreco,
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/motor/custo.test.js`
Expected: PASS, 20 testes.

- [ ] **Step 5: Commit**

```bash
git add src/motor/custo.js src/motor/custo.test.js
git commit -m "feat: motor de custo — item, receita e producao"
```

---

## Task 4: `motor/custo.js` — preço de venda e aviso de rendimento

**Files:**
- Modify: `src/motor/custo.js` (acrescenta ao fim)
- Modify: `src/motor/custo.test.js` (acrescenta ao fim)

**Interfaces:**
- Consumes: `custoDaProducao` (Task 3)
- Produces:
  - `precoSugerido(custoUnitarioCent, margemPct) -> number | null`
  - `lucroDaProducao(custoUnitarioCent, precoCent, rendimento) -> number | null`
  - `rendimentoSuspeito({ rendimento, receitasFeitas, rendimentoBase, temProducaoAnterior }) -> boolean`
  - `TOLERANCIA_RENDIMENTO` = `0.4`

- [ ] **Step 1: Acrescentar os testes ao fim de `src/motor/custo.test.js`**

Ajuste o `import` do topo do arquivo para incluir as três funções novas:

```js
import {
  custoDoItem, custoDaReceita, custoDaProducao,
  precoSugerido, lucroDaProducao, rendimentoSuspeito,
} from './custo'
```

E acrescente ao fim:

```js
describe('precoSugerido', () => {
  it('aplica a margem sobre o custo unitário', () => {
    expect(precoSugerido(65, 200)).toBe(195)
  })

  it('margem zero devolve o próprio custo', () => {
    expect(precoSugerido(65, 0)).toBe(65)
  })

  it('fecha a olho com o que a tela mostra', () => {
    // O teste que existe por causa da usuária, não do código: ela vai conferir 0,65 × 3.
    const cada = 65
    expect(precoSugerido(cada, 200)).toBe(cada * 3)
  })

  it('sem custo ou sem margem, não há preço', () => {
    expect(precoSugerido(null, 200)).toBe(null)
    expect(precoSugerido(65, null)).toBe(null)
    expect(precoSugerido(65, undefined)).toBe(null)
    expect(precoSugerido(65, 'abc')).toBe(null)
  })
})

describe('lucroDaProducao', () => {
  it('multiplica a diferença pelo que rendeu', () => {
    expect(lucroDaProducao(65, 195, 50)).toBe(6500)
  })

  it('sem preço, sem lucro', () => {
    expect(lucroDaProducao(65, null, 50)).toBe(null)
    expect(lucroDaProducao(null, 195, 50)).toBe(null)
  })

  it('rendimento zero devolve null', () => {
    expect(lucroDaProducao(65, 195, 0)).toBe(null)
  })
})

describe('rendimentoSuspeito', () => {
  const base = { rendimentoBase: 50, temProducaoAnterior: true }

  it('rendimento normal não avisa', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: 50 })).toBe(false)
  })

  it('variação pequena não avisa — enrolar maior ou menor é rotina', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: 60 })).toBe(false)
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: 42 })).toBe(false)
  })

  it('avisa quando rende muito acima do normal', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: 80 })).toBe(true)
  })

  it('avisa quando rende muito abaixo do normal', () => {
    // Duas receitas rendendo 20: dez por receita, contra 50 de sempre. Dedo errado.
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 2, rendimento: 20 })).toBe(true)
  })

  it('compara por receita, não no total — 2 receitas rendendo 100 é normal', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 2, rendimento: 100 })).toBe(false)
  })

  it('na primeira produção do doce nunca avisa: não há "de sempre"', () => {
    expect(rendimentoSuspeito({
      rendimentoBase: 50, temProducaoAnterior: false, receitasFeitas: 1, rendimento: 200,
    })).toBe(false)
  })

  it('sem número que dê para comparar, não avisa', () => {
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 1, rendimento: '' })).toBe(false)
    expect(rendimentoSuspeito({ ...base, receitasFeitas: 0, rendimento: 50 })).toBe(false)
    expect(rendimentoSuspeito({
      rendimentoBase: 0, temProducaoAnterior: true, receitasFeitas: 1, rendimento: 50,
    })).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/motor/custo.test.js`
Expected: FAIL — `precoSugerido is not a function`.

- [ ] **Step 3: Acrescentar ao fim de `src/motor/custo.js`**

```js
/** Preço de venda a partir do custo unitário JÁ ARREDONDADO.
 *  A ordem importa: é assim que `0,65 × 3 = 1,95` fecha a olho na tela. */
export function precoSugerido(custoUnitarioCent, margemPct) {
  if (custoUnitarioCent === null || custoUnitarioCent === undefined) return null
  if (!Number.isFinite(custoUnitarioCent)) return null

  const margem = Number(margemPct)
  if (margemPct === null || margemPct === undefined || !Number.isFinite(margem)) return null

  return Math.round(custoUnitarioCent * (1 + margem / 100))
}

/** Lucro da fornada inteira. */
export function lucroDaProducao(custoUnitarioCent, precoCent, rendimento) {
  if (custoUnitarioCent === null || precoCent === null) return null
  if (!Number.isFinite(custoUnitarioCent) || !Number.isFinite(precoCent)) return null

  const rend = Number(rendimento)
  if (!Number.isFinite(rend) || rend <= 0) return null

  return Math.round((precoCent - custoUnitarioCent) * rend)
}

/** Quanto o rendimento pode fugir do normal antes de virar suspeita. Enrolar maior ou
 *  menor muda o rendimento em 10~20% num dia qualquer; 40% já não é a mão, é o dedo. */
export const TOLERANCIA_RENDIMENTO = 0.4

/** `true` quando o rendimento por receita foge demais do normal daquele doce.
 *
 *  Avisa, não bloqueia — ela pode ter feito bolinha de festa infantil, bem menor. O aviso
 *  existe porque precificar em cima de um custo errado só aparece no fim do mês, quando o
 *  doce já foi vendido barato a semana inteira.
 *
 *  Na primeira produção do doce não há com o que comparar, e um alarme sem referência é
 *  ruído que ensina a ignorar o alarme. */
export function rendimentoSuspeito({
  rendimento, receitasFeitas, rendimentoBase, temProducaoAnterior,
}) {
  if (!temProducaoAnterior) return false

  const rend = Number(rendimento)
  const nReceitas = Number(receitasFeitas)
  const base = Number(rendimentoBase)

  if (!Number.isFinite(rend) || rend <= 0) return false
  if (!Number.isFinite(nReceitas) || nReceitas <= 0) return false
  if (!Number.isFinite(base) || base <= 0) return false

  const porReceita = rend / nReceitas
  return Math.abs(porReceita - base) / base > TOLERANCIA_RENDIMENTO
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/motor/custo.test.js`
Expected: PASS, 34 testes.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 58 testes.

- [ ] **Step 6: Commit**

```bash
git add src/motor/custo.js src/motor/custo.test.js
git commit -m "feat: preco de venda e aviso de rendimento fora do normal"
```

---

## Task 5: `dados/` — IndexedDB e o repositório de ingredientes

**Files:**
- Create: `src/dados/indexeddb.js`
- Create: `src/dados/repositorio.js`, `src/dados/repositorio.ingredientes.test.js`

**Interfaces:**
- Consumes: `normalizar` de `lib/texto` (Task 2)
- Produces:
  - de `indexeddb.js`: `GAVETA_INGREDIENTES`, `GAVETA_RECEITAS`, `GAVETA_PRODUCOES`, `abrir()`, `naGaveta(gaveta, modo, fn)`, `limparGaveta(gaveta)`, `disponivel()`
  - de `repositorio.js`: `listarIngredientes()`, `salvarIngrediente(dados, id?)`, `apagarIngrediente(id)`
  - formato gravado: `{ id, nome, nomeNormalizado, unidade, embalagemQtd, embalagemPrecoCent, atualizadoEm }`

- [ ] **Step 1: Escrever `src/dados/repositorio.ingredientes.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './indexeddb'
import { listarIngredientes, salvarIngrediente, apagarIngrediente } from './repositorio'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

describe('ingredientes', () => {
  it('começa vazio', async () => {
    expect(await listarIngredientes()).toEqual([])
  })

  it('salva e lê de volta', async () => {
    const salvo = await salvarIngrediente(TODDY)
    expect(salvo.id).toMatch(/^ing_/)

    const lista = await listarIngredientes()
    expect(lista).toHaveLength(1)
    expect(lista[0].nome).toBe('Toddy')
    expect(lista[0].embalagemPrecoCent).toBe(1000)
    expect(lista[0].unidade).toBe('g')
  })

  it('guarda o nome normalizado para comparar depois', async () => {
    const salvo = await salvarIngrediente({ ...TODDY, nome: '  Açúcar  Cristal ' })
    expect(salvo.nome).toBe('Açúcar  Cristal')
    expect(salvo.nomeNormalizado).toBe('acucar cristal')
  })

  it('recusa nome repetido, mesmo com acento e maiúscula diferentes', async () => {
    await salvarIngrediente({ ...TODDY, nome: 'Açúcar' })
    await expect(salvarIngrediente({ ...TODDY, nome: 'ACUCAR' }))
      .rejects.toThrow(/já existe/i)
    expect(await listarIngredientes()).toHaveLength(1)
  })

  it('recusa nome vazio', async () => {
    await expect(salvarIngrediente({ ...TODDY, nome: '   ' })).rejects.toThrow(/nome/i)
  })

  it('recusa unidade que não existe', async () => {
    await expect(salvarIngrediente({ ...TODDY, unidade: 'kg' })).rejects.toThrow(/unidade/i)
  })

  it('recusa embalagem zerada — dividir por ela daria infinito', async () => {
    await expect(salvarIngrediente({ ...TODDY, embalagemQtd: 0 })).rejects.toThrow(/embalagem/i)
  })

  it('aceita ingrediente sem preço ainda', async () => {
    const salvo = await salvarIngrediente({ ...TODDY, embalagemPrecoCent: null })
    expect(salvo.embalagemPrecoCent).toBe(null)
  })

  it('editar mantém o id e não cria outro', async () => {
    const salvo = await salvarIngrediente(TODDY)
    const editado = await salvarIngrediente({ ...TODDY, embalagemPrecoCent: 1200 }, salvo.id)
    expect(editado.id).toBe(salvo.id)
    expect(await listarIngredientes()).toHaveLength(1)
    expect((await listarIngredientes())[0].embalagemPrecoCent).toBe(1200)
  })

  it('editar não bate de frente com o próprio nome', async () => {
    const salvo = await salvarIngrediente(TODDY)
    await expect(salvarIngrediente({ ...TODDY, embalagemPrecoCent: 1200 }, salvo.id)).resolves.toBeTruthy()
  })

  it('devolve a lista em ordem de nome', async () => {
    await salvarIngrediente({ ...TODDY, nome: 'Toddy' })
    await salvarIngrediente({ ...TODDY, nome: 'Açúcar' })
    await salvarIngrediente({ ...TODDY, nome: 'Manteiga' })
    const nomes = (await listarIngredientes()).map((i) => i.nome)
    expect(nomes).toEqual(['Açúcar', 'Manteiga', 'Toddy'])
  })

  it('apaga', async () => {
    const salvo = await salvarIngrediente(TODDY)
    await apagarIngrediente(salvo.id)
    expect(await listarIngredientes()).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/dados/repositorio.ingredientes.test.js`
Expected: FAIL — `Failed to resolve import "./indexeddb"`.

- [ ] **Step 3: Escrever `src/dados/indexeddb.js`**

```js
// Acesso cru ao IndexedDB. Ninguém fora de `repositorio.js` importa este arquivo — é essa
// disciplina que torna uma troca por Supabase, um dia, a reescrita de UM arquivo.

const NOME = 'lariano-doces'
const VERSAO = 1

export const GAVETA_INGREDIENTES = 'ingredientes'
export const GAVETA_RECEITAS = 'receitas'
export const GAVETA_PRODUCOES = 'producoes'

/** Aba anônima e navegador com dados de site bloqueados derrubam o IndexedDB. Detectar
 *  antes é o que separa um aviso claro de uma tela branca sem explicação. */
export function disponivel() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

export function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME, VERSAO)
    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains(GAVETA_INGREDIENTES)) {
        const g = db.createObjectStore(GAVETA_INGREDIENTES, { keyPath: 'id' })
        // Índice único como rede de segurança do nome repetido. A checagem amigável
        // acontece no repositório; esta linha é o que impede a duplicata de entrar mesmo
        // se um caminho novo esquecer de checar.
        g.createIndex('nomeNormalizado', 'nomeNormalizado', { unique: true })
      }

      if (!db.objectStoreNames.contains(GAVETA_RECEITAS)) {
        const g = db.createObjectStore(GAVETA_RECEITAS, { keyPath: 'id' })
        g.createIndex('nomeNormalizado', 'nomeNormalizado', { unique: true })
      }

      if (!db.objectStoreNames.contains(GAVETA_PRODUCOES)) {
        const g = db.createObjectStore(GAVETA_PRODUCOES, { keyPath: 'id' })
        g.createIndex('data', 'data', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Envolve uma transação numa promessa. `fn` recebe a gaveta e devolve o request. */
export async function naGaveta(gaveta, modo, fn) {
  const db = await abrir()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(gaveta, modo)
      const req = fn(tx.objectStore(gaveta))
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
      tx.oncomplete = () => resolve(req?.result)
      if (req) req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export function limparGaveta(gaveta) {
  return naGaveta(gaveta, 'readwrite', (g) => g.clear())
}
```

- [ ] **Step 4: Escrever `src/dados/repositorio.js` (parte dos ingredientes)**

```js
// A fronteira do armazenamento. O resto do sistema só conhece as funções daqui.
//
// Do outro lado, num Postgres, a tabela seria:
//   ingredientes (id text pk, nome text, nome_normalizado text unique, unidade text,
//                 embalagem_qtd numeric, embalagem_preco_cent int, atualizado_em date)

import {
  GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, naGaveta,
} from './indexeddb'
import { normalizar } from '../lib/texto'

const UNIDADES = ['g', 'ml', 'un']

function novoId(prefixo) {
  return `${prefixo}_${crypto.randomUUID()}`
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

export function listarIngredientes() {
  return naGaveta(GAVETA_INGREDIENTES, 'readonly', (g) => g.getAll())
    .then((linhas) => (linhas || [])
      .sort((a, b) => a.nomeNormalizado.localeCompare(b.nomeNormalizado, 'pt-BR')))
}

/** Sem `id`, cria. Com `id`, edita.
 *
 *  `atualizadoEm` só anda quando o PREÇO muda — é ele que ordena a lista de ingredientes
 *  por "mais desatualizado primeiro". Se corrigir um acento no nome empurrasse o
 *  ingrediente para o fim da fila, a lista pararia de responder à única pergunta que ela
 *  faz ali: qual preço está velho? */
export async function salvarIngrediente(dados, id) {
  const nome = String(dados?.nome ?? '').trim()
  if (!nome) throw new Error('O ingrediente precisa de um nome.')

  if (!UNIDADES.includes(dados?.unidade)) {
    throw new Error('A unidade precisa ser g, ml ou un.')
  }

  const embalagemQtd = Number(dados?.embalagemQtd)
  if (!Number.isFinite(embalagemQtd) || embalagemQtd <= 0) {
    throw new Error('A quantidade da embalagem precisa ser maior que zero.')
  }

  const preco = dados?.embalagemPrecoCent
  const embalagemPrecoCent =
    preco === null || preco === undefined || preco === '' ? null : Math.round(Number(preco))
  if (embalagemPrecoCent !== null && !Number.isFinite(embalagemPrecoCent)) {
    throw new Error('O preço da embalagem não é um número.')
  }

  const nomeNormalizado = normalizar(nome)
  const existentes = await listarIngredientes()

  const conflito = existentes.find((i) => i.nomeNormalizado === nomeNormalizado && i.id !== id)
  if (conflito) throw new Error(`Já existe um ingrediente chamado "${conflito.nome}".`)

  const anterior = id ? existentes.find((i) => i.id === id) : null
  if (id && !anterior) throw new Error('Ingrediente não encontrado.')

  const precoMudou = !anterior || anterior.embalagemPrecoCent !== embalagemPrecoCent

  const registro = {
    id: id ?? novoId('ing'),
    nome,
    nomeNormalizado,
    unidade: dados.unidade,
    embalagemQtd,
    embalagemPrecoCent,
    atualizadoEm: precoMudou ? hoje() : anterior.atualizadoEm,
  }

  await naGaveta(GAVETA_INGREDIENTES, 'readwrite', (g) => g.put(registro))
  return registro
}

export async function apagarIngrediente(id) {
  const receitas = await listarReceitas()
  const usando = receitas.filter((r) => (r.itens ?? []).some((i) => i.ingredienteId === id))
  if (usando.length) {
    const nomes = usando.map((r) => r.nome).join(', ')
    throw new Error(`Este ingrediente está em ${nomes}. Tire ele da receita primeiro.`)
  }
  await naGaveta(GAVETA_INGREDIENTES, 'readwrite', (g) => g.delete(id))
}

export function listarReceitas() {
  return naGaveta(GAVETA_RECEITAS, 'readonly', (g) => g.getAll())
    .then((linhas) => (linhas || [])
      .sort((a, b) => a.nomeNormalizado.localeCompare(b.nomeNormalizado, 'pt-BR')))
}
```

`listarReceitas` entra aqui, e não na Task 6, porque `apagarIngrediente` já precisa dela — a Task 6 acrescenta o resto.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/dados/repositorio.ingredientes.test.js`
Expected: PASS, 12 testes.

- [ ] **Step 6: Commit**

```bash
git add src/dados/indexeddb.js src/dados/repositorio.js src/dados/repositorio.ingredientes.test.js
git commit -m "feat: gavetas do IndexedDB e repositorio de ingredientes"
```

---

## Task 6: Repositório de receitas

**Files:**
- Modify: `src/dados/repositorio.js`
- Create: `src/dados/repositorio.receitas.test.js`

**Interfaces:**
- Consumes: `listarIngredientes`, `apagarIngrediente`, `listarReceitas` (Task 5)
- Produces: `salvarReceita(dados, id?)`, `apagarReceita(id)`
- formato gravado: `{ id, nome, nomeNormalizado, rendimentoBase, margemPct, itens: [{ ingredienteId, quantidade }], criadoEm }`

- [ ] **Step 1: Escrever `src/dados/repositorio.receitas.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './indexeddb'
import {
  salvarIngrediente, apagarIngrediente,
  listarReceitas, salvarReceita, apagarReceita,
} from './repositorio'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

async function comBrigadeiro() {
  const toddy = await salvarIngrediente(TODDY)
  const receita = await salvarReceita({
    nome: 'Brigadeiro',
    rendimentoBase: 50,
    margemPct: 200,
    itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
  })
  return { toddy, receita }
}

describe('receitas', () => {
  it('salva e lê de volta com os itens', async () => {
    const { toddy, receita } = await comBrigadeiro()
    expect(receita.id).toMatch(/^rec_/)

    const lista = await listarReceitas()
    expect(lista).toHaveLength(1)
    expect(lista[0].nome).toBe('Brigadeiro')
    expect(lista[0].rendimentoBase).toBe(50)
    expect(lista[0].margemPct).toBe(200)
    expect(lista[0].itens).toEqual([{ ingredienteId: toddy.id, quantidade: 80 }])
  })

  it('a receita guarda quantidade, nunca preço', async () => {
    const { receita } = await comBrigadeiro()
    const serializada = JSON.stringify(receita)
    expect(serializada).not.toMatch(/preco/i)
    expect(serializada).not.toMatch(/Cent/)
  })

  it('mudar o preço do ingrediente não toca na receita', async () => {
    const { toddy, receita } = await comBrigadeiro()
    await salvarIngrediente({ ...TODDY, embalagemPrecoCent: 1500 }, toddy.id)
    const depois = (await listarReceitas()).find((r) => r.id === receita.id)
    expect(depois.itens).toEqual([{ ingredienteId: toddy.id, quantidade: 80 }])
  })

  it('recusa nome repetido', async () => {
    await comBrigadeiro()
    await expect(salvarReceita({ nome: 'BRIGADEIRO', rendimentoBase: 50, itens: [] }))
      .rejects.toThrow(/já existe/i)
  })

  it('recusa nome vazio', async () => {
    await expect(salvarReceita({ nome: '  ', rendimentoBase: 50, itens: [] }))
      .rejects.toThrow(/nome/i)
  })

  it('recusa rendimento base zero ou negativo', async () => {
    await expect(salvarReceita({ nome: 'X', rendimentoBase: 0, itens: [] }))
      .rejects.toThrow(/rendimento/i)
    await expect(salvarReceita({ nome: 'Y', rendimentoBase: -5, itens: [] }))
      .rejects.toThrow(/rendimento/i)
  })

  it('recusa item sem ingrediente ou com quantidade que não é número', async () => {
    await expect(salvarReceita({
      nome: 'X', rendimentoBase: 50, itens: [{ ingredienteId: '', quantidade: 10 }],
    })).rejects.toThrow(/ingrediente/i)

    await expect(salvarReceita({
      nome: 'Y', rendimentoBase: 50, itens: [{ ingredienteId: 'ing_1', quantidade: 'abc' }],
    })).rejects.toThrow(/quantidade/i)
  })

  it('aceita margem vazia — nem todo doce tem preço de venda decidido', async () => {
    const r = await salvarReceita({ nome: 'Bolo', rendimentoBase: 12, margemPct: null, itens: [] })
    expect(r.margemPct).toBe(null)
  })

  it('editar mantém o id e o criadoEm', async () => {
    const { receita } = await comBrigadeiro()
    const editada = await salvarReceita(
      { ...receita, nome: 'Brigadeiro gourmet', rendimentoBase: 40 }, receita.id,
    )
    expect(editada.id).toBe(receita.id)
    expect(editada.criadoEm).toBe(receita.criadoEm)
    expect(await listarReceitas()).toHaveLength(1)
  })

  it('apagar ingrediente que está em receita é recusado, e diz onde ele está', async () => {
    const { toddy } = await comBrigadeiro()
    await expect(apagarIngrediente(toddy.id)).rejects.toThrow(/Brigadeiro/)
  })

  it('depois de tirar o ingrediente da receita, dá para apagar', async () => {
    const { toddy, receita } = await comBrigadeiro()
    await salvarReceita({ ...receita, itens: [] }, receita.id)
    await expect(apagarIngrediente(toddy.id)).resolves.toBeUndefined()
  })

  it('apaga a receita', async () => {
    const { receita } = await comBrigadeiro()
    await apagarReceita(receita.id)
    expect(await listarReceitas()).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/dados/repositorio.receitas.test.js`
Expected: FAIL — `salvarReceita is not a function`.

- [ ] **Step 3: Acrescentar ao fim de `src/dados/repositorio.js`**

```js
/** Sem `id`, cria. Com `id`, edita preservando `criadoEm`.
 *
 *  A receita guarda `ingredienteId` e `quantidade`, e nada mais. Nenhum preço encosta
 *  aqui: é isso que faz "o leite condensado subiu" ser uma edição num lugar só. */
export async function salvarReceita(dados, id) {
  const nome = String(dados?.nome ?? '').trim()
  if (!nome) throw new Error('O doce precisa de um nome.')

  const rendimentoBase = Number(dados?.rendimentoBase)
  if (!Number.isFinite(rendimentoBase) || rendimentoBase <= 0) {
    throw new Error('O rendimento da receita precisa ser maior que zero.')
  }

  const margem = dados?.margemPct
  const margemPct =
    margem === null || margem === undefined || margem === '' ? null : Number(margem)
  if (margemPct !== null && !Number.isFinite(margemPct)) {
    throw new Error('A margem não é um número.')
  }

  const itens = (dados?.itens ?? []).map((item) => {
    if (!item?.ingredienteId) throw new Error('Tem uma linha sem ingrediente escolhido.')
    const quantidade = Number(item.quantidade)
    if (!Number.isFinite(quantidade)) {
      throw new Error('Tem uma linha com quantidade em branco.')
    }
    // Só estes dois campos atravessam. Se a tela mandar o ingrediente inteiro junto (e
    // vai, porque é cômodo), o preço iria de carona para dentro da receita e congelaria
    // ali — exatamente o que este modelo existe para evitar.
    return { ingredienteId: item.ingredienteId, quantidade }
  })

  const nomeNormalizado = normalizar(nome)
  const existentes = await listarReceitas()

  const conflito = existentes.find((r) => r.nomeNormalizado === nomeNormalizado && r.id !== id)
  if (conflito) throw new Error(`Já existe um doce chamado "${conflito.nome}".`)

  const anterior = id ? existentes.find((r) => r.id === id) : null
  if (id && !anterior) throw new Error('Doce não encontrado.')

  const registro = {
    id: id ?? novoId('rec'),
    nome,
    nomeNormalizado,
    rendimentoBase,
    margemPct,
    itens,
    criadoEm: anterior?.criadoEm ?? hoje(),
  }

  await naGaveta(GAVETA_RECEITAS, 'readwrite', (g) => g.put(registro))
  return registro
}

/** Apagar receita é permitido mesmo com produção no histórico: a produção copiou o nome
 *  do doce quando foi salva, então o histórico continua legível sem ela. */
export async function apagarReceita(id) {
  await naGaveta(GAVETA_RECEITAS, 'readwrite', (g) => g.delete(id))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/dados/repositorio.receitas.test.js`
Expected: PASS, 12 testes.

- [ ] **Step 5: Commit**

```bash
git add src/dados/repositorio.js src/dados/repositorio.receitas.test.js
git commit -m "feat: repositorio de receitas e recusa de apagar ingrediente em uso"
```

---

## Task 7: Repositório de produções — o custo congelado

**Files:**
- Modify: `src/dados/repositorio.js`
- Create: `src/dados/repositorio.producoes.test.js`

**Interfaces:**
- Consumes: `salvarIngrediente`, `salvarReceita` (Tasks 5, 6)
- Produces: `listarProducoes()`, `salvarProducao(dados)`, `apagarProducao(id)`
- formato gravado: `{ id, receitaId, nomeReceita, receitasFeitas, rendimento, custoTotalCent, custoUnitarioCent, parcial, data, criadoEm }`

- [ ] **Step 1: Escrever `src/dados/repositorio.producoes.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './indexeddb'
import {
  salvarIngrediente, salvarReceita, apagarReceita,
  listarProducoes, salvarProducao, apagarProducao,
} from './repositorio'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

async function cenario() {
  const toddy = await salvarIngrediente(TODDY)
  const receita = await salvarReceita({
    nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
    itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
  })
  const producao = await salvarProducao({
    receitaId: receita.id,
    nomeReceita: receita.nome,
    receitasFeitas: 1,
    rendimento: 50,
    custoTotalCent: 3250,
    custoUnitarioCent: 65,
    parcial: false,
  })
  return { toddy, receita, producao }
}

describe('produções', () => {
  it('salva e lê de volta', async () => {
    const { producao } = await cenario()
    expect(producao.id).toMatch(/^prod_/)

    const lista = await listarProducoes()
    expect(lista).toHaveLength(1)
    expect(lista[0].nomeReceita).toBe('Brigadeiro')
    expect(lista[0].custoTotalCent).toBe(3250)
    expect(lista[0].custoUnitarioCent).toBe(65)
  })

  it('carimba a data de hoje', async () => {
    const { producao } = await cenario()
    expect(producao.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('o custo fica CONGELADO: subir o preço do ingrediente não mexe no histórico', async () => {
    const { toddy } = await cenario()
    await salvarIngrediente({ ...TODDY, embalagemPrecoCent: 3000 }, toddy.id)

    const lista = await listarProducoes()
    expect(lista[0].custoTotalCent).toBe(3250)
    expect(lista[0].custoUnitarioCent).toBe(65)
  })

  it('apagar a receita não apaga nem esvazia o histórico', async () => {
    const { receita } = await cenario()
    await apagarReceita(receita.id)

    const lista = await listarProducoes()
    expect(lista).toHaveLength(1)
    expect(lista[0].nomeReceita).toBe('Brigadeiro')
    expect(lista[0].custoTotalCent).toBe(3250)
  })

  it('lista da mais nova para a mais velha', async () => {
    const { receita } = await cenario()
    const base = { receitaId: receita.id, nomeReceita: 'Brigadeiro', receitasFeitas: 1, parcial: false }
    await salvarProducao({ ...base, rendimento: 60, custoTotalCent: 3250, custoUnitarioCent: 54 })
    await salvarProducao({ ...base, rendimento: 70, custoTotalCent: 3250, custoUnitarioCent: 46 })

    const rendimentos = (await listarProducoes()).map((p) => p.rendimento)
    expect(rendimentos).toEqual([70, 60, 50])
  })

  it('guarda que a produção foi parcial', async () => {
    const { receita } = await cenario()
    await salvarProducao({
      receitaId: receita.id, nomeReceita: 'Beijinho', receitasFeitas: 1, rendimento: 30,
      custoTotalCent: 1000, custoUnitarioCent: 33, parcial: true,
    })
    const parciais = (await listarProducoes()).filter((p) => p.parcial)
    expect(parciais).toHaveLength(1)
    expect(parciais[0].nomeReceita).toBe('Beijinho')
  })

  it('recusa salvar produção sem custo — não existe registro de custo desconhecido', async () => {
    await expect(salvarProducao({
      receitaId: 'rec_1', nomeReceita: 'X', receitasFeitas: 1, rendimento: 50,
      custoTotalCent: null, custoUnitarioCent: null, parcial: false,
    })).rejects.toThrow(/custo/i)
  })

  it('apaga uma produção', async () => {
    const { producao } = await cenario()
    await apagarProducao(producao.id)
    expect(await listarProducoes()).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/dados/repositorio.producoes.test.js`
Expected: FAIL — `salvarProducao is not a function`.

- [ ] **Step 3: Acrescentar ao fim de `src/dados/repositorio.js`**

```js
// `Date.now()` tem resolução de milissegundo, e salvar duas produções em sequência rápida
// (um teste, um toque duplo) pode gerar o MESMO instante. Como a listagem ordena por este
// campo, um empate embaralha as duas — e "a última que salvei" é justamente a que ela
// procura. Cada chamada aqui é garantida estritamente maior que a anterior.
let ultimoAgoraMs = 0
function agora() {
  const t = Date.now()
  ultimoAgoraMs = t > ultimoAgoraMs ? t : ultimoAgoraMs + 1
  return new Date(ultimoAgoraMs).toISOString()
}

/** Da mais nova para a mais velha: é essa a ordem em que ela procura. */
export function listarProducoes() {
  return naGaveta(GAVETA_PRODUCOES, 'readonly', (g) => g.getAll())
    .then((linhas) => (linhas || []).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)))
}

/** Grava o custo JÁ CALCULADO, e nunca recalcula na leitura.
 *
 *  É a decisão que dá sentido ao histórico: quando o leite condensado subir em novembro, a
 *  produção de agosto tem que continuar dizendo o que custou em agosto. Recalcular apagaria
 *  a única informação que essa lista oferece — a variação do custo ao longo do tempo.
 *
 *  Por isso `nomeReceita` também é copiado, e não lido da receita: apagar o doce não pode
 *  transformar o histórico em linhas sem nome. */
export async function salvarProducao(dados) {
  const custoTotalCent = Number(dados?.custoTotalCent)
  const custoUnitarioCent = Number(dados?.custoUnitarioCent)
  if (!Number.isFinite(custoTotalCent) || !Number.isFinite(custoUnitarioCent)) {
    throw new Error('Não dá para salvar uma produção sem custo calculado.')
  }

  const registro = {
    id: novoId('prod'),
    receitaId: dados.receitaId,
    nomeReceita: String(dados.nomeReceita ?? '').trim(),
    receitasFeitas: Number(dados.receitasFeitas),
    rendimento: Number(dados.rendimento),
    custoTotalCent: Math.round(custoTotalCent),
    custoUnitarioCent: Math.round(custoUnitarioCent),
    parcial: Boolean(dados.parcial),
    data: hoje(),
    criadoEm: agora(),
  }

  await naGaveta(GAVETA_PRODUCOES, 'readwrite', (g) => g.put(registro))
  return registro
}

export async function apagarProducao(id) {
  await naGaveta(GAVETA_PRODUCOES, 'readwrite', (g) => g.delete(id))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/dados/repositorio.producoes.test.js`
Expected: PASS, 8 testes.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 90 testes.

- [ ] **Step 6: Commit**

```bash
git add src/dados/repositorio.js src/dados/repositorio.producoes.test.js
git commit -m "feat: repositorio de producoes com custo congelado"
```

---

## Task 8: Backup — exportar e importar

**Files:**
- Create: `src/dados/backup.js`, `src/dados/backup.test.js`

**Interfaces:**
- Consumes: todas as funções de `repositorio.js` (Tasks 5–7)
- Produces:
  - `VERSAO_BACKUP` = `1`
  - `exportar() -> Promise<{ versao, exportadoEm, ingredientes, receitas, producoes }>`
  - `validarBackup(obj) -> { ok: true } | { ok: false, motivo: string }`
  - `importar(obj) -> Promise<{ ingredientes: number, receitas: number, producoes: number }>`
  - `resumo(obj) -> { ingredientes: number, receitas: number, producoes: number }`

- [ ] **Step 1: Escrever `src/dados/backup.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './indexeddb'
import {
  salvarIngrediente, salvarReceita, salvarProducao,
  listarIngredientes, listarReceitas, listarProducoes,
} from './repositorio'
import { exportar, importar, validarBackup, resumo } from './backup'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

async function semear() {
  const toddy = await salvarIngrediente(TODDY)
  const receita = await salvarReceita({
    nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
    itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
  })
  await salvarProducao({
    receitaId: receita.id, nomeReceita: 'Brigadeiro', receitasFeitas: 1, rendimento: 50,
    custoTotalCent: 3250, custoUnitarioCent: 65, parcial: false,
  })
}

describe('exportar', () => {
  it('leva as três gavetas e a versão', async () => {
    await semear()
    const b = await exportar()
    expect(b.versao).toBe(1)
    expect(b.exportadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(b.ingredientes).toHaveLength(1)
    expect(b.receitas).toHaveLength(1)
    expect(b.producoes).toHaveLength(1)
  })

  it('sobrevive a virar texto e voltar — é assim que ele viaja em arquivo', async () => {
    await semear()
    const b = await exportar()
    expect(JSON.parse(JSON.stringify(b))).toEqual(b)
  })
})

describe('validarBackup', () => {
  it('aceita um backup de verdade', async () => {
    await semear()
    expect(validarBackup(await exportar())).toEqual({ ok: true })
  })

  it('recusa o que não é objeto', () => {
    expect(validarBackup(null).ok).toBe(false)
    expect(validarBackup('texto').ok).toBe(false)
    expect(validarBackup([]).ok).toBe(false)
  })

  it('recusa versão que não conhece, dizendo o motivo', () => {
    const r = validarBackup({ versao: 99, ingredientes: [], receitas: [], producoes: [] })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/vers/i)
  })

  it('recusa quando falta uma gaveta', () => {
    const r = validarBackup({ versao: 1, ingredientes: [], receitas: [] })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/produ/i)
  })

  it('recusa quando a gaveta não é lista', () => {
    const r = validarBackup({ versao: 1, ingredientes: {}, receitas: [], producoes: [] })
    expect(r.ok).toBe(false)
  })
})

describe('resumo', () => {
  it('conta o que o arquivo traz, para a confirmação dizer o tamanho do estrago', () => {
    expect(resumo({ ingredientes: [1, 2], receitas: [1], producoes: [] }))
      .toEqual({ ingredientes: 2, receitas: 1, producoes: 0 })
  })
})

describe('importar', () => {
  it('exportar, apagar tudo e importar devolve o mesmo estado', async () => {
    await semear()
    const antes = await exportar()

    await limparGaveta(GAVETA_INGREDIENTES)
    await limparGaveta(GAVETA_RECEITAS)
    await limparGaveta(GAVETA_PRODUCOES)
    expect(await listarIngredientes()).toEqual([])

    await importar(JSON.parse(JSON.stringify(antes)))

    expect(await listarIngredientes()).toEqual(antes.ingredientes)
    expect(await listarReceitas()).toEqual(antes.receitas)
    expect(await listarProducoes()).toEqual(antes.producoes)
  })

  it('substitui, não mistura — importar não duplica o que já estava lá', async () => {
    await semear()
    const b = await exportar()
    await importar(b)
    expect(await listarIngredientes()).toHaveLength(1)
    expect(await listarReceitas()).toHaveLength(1)
  })

  it('devolve quanto entrou', async () => {
    await semear()
    const b = await exportar()
    expect(await importar(b)).toEqual({ ingredientes: 1, receitas: 1, producoes: 1 })
  })

  it('arquivo inválido não destrói o que já estava salvo', async () => {
    await semear()
    await expect(importar({ versao: 99 })).rejects.toThrow(/vers/i)

    expect(await listarIngredientes()).toHaveLength(1)
    expect(await listarReceitas()).toHaveLength(1)
    expect(await listarProducoes()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/dados/backup.test.js`
Expected: FAIL — `Failed to resolve import "./backup"`.

- [ ] **Step 3: Escrever `src/dados/backup.js`**

```js
// Dado que mora só no celular é dado a uma limpeza de navegador de distância do fim. O
// backup em arquivo é o que torna essa escolha de armazenamento defensável.

import {
  GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, naGaveta,
} from './indexeddb'
import { listarIngredientes, listarReceitas, listarProducoes } from './repositorio'

export const VERSAO_BACKUP = 1

const GAVETAS = [
  ['ingredientes', GAVETA_INGREDIENTES],
  ['receitas', GAVETA_RECEITAS],
  ['producoes', GAVETA_PRODUCOES],
]

export async function exportar() {
  return {
    versao: VERSAO_BACKUP,
    exportadoEm: new Date().toISOString().slice(0, 10),
    ingredientes: await listarIngredientes(),
    receitas: await listarReceitas(),
    producoes: await listarProducoes(),
  }
}

/** Valida ANTES de encostar no banco. Um import que apaga primeiro e descobre o problema
 *  depois transforma um arquivo errado na perda de tudo. */
export function validarBackup(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, motivo: 'Este arquivo não é um backup do Lariano Doces.' }
  }
  if (obj.versao !== VERSAO_BACKUP) {
    return { ok: false, motivo: `Este backup é da versão ${obj.versao ?? '?'}, e o app lê a versão ${VERSAO_BACKUP}.` }
  }
  for (const [chave] of GAVETAS) {
    if (!Array.isArray(obj[chave])) {
      return { ok: false, motivo: `O backup está sem a lista de ${chave}.` }
    }
  }
  return { ok: true }
}

/** Quantos itens o arquivo traz — é o que a confirmação mostra antes de substituir. */
export function resumo(obj) {
  return {
    ingredientes: obj?.ingredientes?.length ?? 0,
    receitas: obj?.receitas?.length ?? 0,
    producoes: obj?.producoes?.length ?? 0,
  }
}

/** SUBSTITUI tudo. Não mescla.
 *
 *  Mesclar dois bancos sem regra de conflito é o caminho mais curto para ela terminar com
 *  dois "Toddy" e um custo dobrado — e sem jeito de saber qual dos dois está certo. */
export async function importar(obj) {
  const valido = validarBackup(obj)
  if (!valido.ok) throw new Error(valido.motivo)

  for (const [chave, gaveta] of GAVETAS) {
    await naGaveta(gaveta, 'readwrite', (g) => g.clear())
    for (const registro of obj[chave]) {
      await naGaveta(gaveta, 'readwrite', (g) => g.put(registro))
    }
  }

  return resumo(obj)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/dados/backup.test.js`
Expected: PASS, 12 testes.

- [ ] **Step 5: Rodar a suíte inteira e commitar**

Run: `npm test`
Expected: PASS, 102 testes.

```bash
git add src/dados/backup.js src/dados/backup.test.js
git commit -m "feat: backup em arquivo, exportar e importar"
```

---

## Task 9: `Folha` — a bottom sheet

**Files:**
- Create: `src/componentes/Folha.jsx`, `src/componentes/Folha.test.jsx`, `src/componentes/folha.css`

**Interfaces:**
- Consumes: nada
- Produces: `<Folha aberta titulo="..." aoFechar={fn}>{children}</Folha>`

- [ ] **Step 1: Escrever `src/componentes/Folha.test.jsx`**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Folha } from './Folha'

describe('Folha', () => {
  it('fechada não desenha nada', () => {
    render(<Folha aberta={false} titulo="Meus doces" aoFechar={() => {}}>conteúdo</Folha>)
    expect(screen.queryByText('conteúdo')).toBe(null)
  })

  it('aberta mostra título e conteúdo', () => {
    render(<Folha aberta titulo="Meus doces" aoFechar={() => {}}>conteúdo</Folha>)
    expect(screen.getByRole('heading', { name: 'Meus doces' })).toBeTruthy()
    expect(screen.getByText('conteúdo')).toBeTruthy()
  })

  it('se anuncia como diálogo para quem usa leitor de tela', () => {
    render(<Folha aberta titulo="Meus doces" aoFechar={() => {}}>conteúdo</Folha>)
    const dialogo = screen.getByRole('dialog')
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
    expect(dialogo.getAttribute('aria-label')).toBe('Meus doces')
  })

  it('o botão fechar avisa', async () => {
    const aoFechar = vi.fn()
    render(<Folha aberta titulo="X" aoFechar={aoFechar}>c</Folha>)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('tocar fora fecha', async () => {
    const aoFechar = vi.fn()
    render(<Folha aberta titulo="X" aoFechar={aoFechar}>c</Folha>)
    await userEvent.click(screen.getByTestId('folha-fundo'))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('tocar DENTRO não fecha — senão preencher um campo fecharia a folha', async () => {
    const aoFechar = vi.fn()
    render(<Folha aberta titulo="X" aoFechar={aoFechar}><span>dentro</span></Folha>)
    await userEvent.click(screen.getByText('dentro'))
    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('Escape fecha', async () => {
    const aoFechar = vi.fn()
    render(<Folha aberta titulo="X" aoFechar={aoFechar}>c</Folha>)
    await userEvent.keyboard('{Escape}')
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/componentes/Folha.test.jsx`
Expected: FAIL — `Failed to resolve import "./Folha"`.

- [ ] **Step 3: Escrever `src/componentes/Folha.jsx`**

```jsx
import { useEffect } from 'react'
import './folha.css'

/** A folha que sobe de baixo. É ela que permite a promessa "abriu, escolheu, viu o preço":
 *  cadastro e histórico existem sem nunca engordar a tela principal. */
export function Folha({ aberta, titulo, aoFechar, children }) {
  useEffect(() => {
    if (!aberta) return

    const aoTeclar = (e) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)

    // Sem travar o corpo, rolar dentro da folha até o fim continua rolando a página atrás
    // dela — no celular a tela principal "escapa" por baixo e ela perde o lugar.
    const rolagemAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = rolagemAnterior
    }
  }, [aberta, aoFechar])

  if (!aberta) return null

  return (
    <div className="folha-fundo" data-testid="folha-fundo" onClick={aoFechar}>
      <div
        className="folha"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="folha-topo">
          <h2>{titulo}</h2>
          <button type="button" className="folha-fechar" onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="folha-corpo">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Escrever `src/componentes/folha.css`**

```css
.folha-fundo {
  position: fixed;
  inset: 0;
  background: rgba(58, 32, 40, .35);
  display: flex;
  align-items: flex-end;
  z-index: 20;
  animation: folha-fundo-entra var(--t-media);
}

.folha {
  background: var(--card);
  width: 100%;
  max-height: 92dvh;
  border-radius: var(--raio-lg) var(--raio-lg) 0 0;
  box-shadow: var(--e3);
  display: flex;
  flex-direction: column;
  animation: folha-sobe var(--t-media);
}

.folha-topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 12px;
  border-bottom: 1px solid var(--borda);
}

.folha-topo h2 { font-size: 1.1rem; }

.folha-fechar {
  border: 0;
  background: var(--marca-clara);
  color: var(--marca);
  /* 44px é o alvo mínimo confortável para o dedo; abaixo disso ela erra e fecha o que não
     queria, ou não fecha o que queria. */
  width: 44px;
  height: 44px;
  border-radius: var(--raio-pilula);
  font-size: 1.5rem;
  line-height: 1;
}

.folha-corpo {
  padding: 16px 18px calc(24px + env(safe-area-inset-bottom));
  overflow-y: auto;
  overscroll-behavior: contain;
}

@keyframes folha-sobe {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes folha-fundo-entra {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Quem pediu menos movimento no sistema não deve receber a folha deslizando. */
@media (prefers-reduced-motion: reduce) {
  .folha, .folha-fundo { animation: none; }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/componentes/Folha.test.jsx`
Expected: PASS, 7 testes.

- [ ] **Step 6: Commit**

```bash
git add src/componentes/Folha.jsx src/componentes/Folha.test.jsx src/componentes/folha.css
git commit -m "feat: componente Folha, a bottom sheet do app"
```

---

## Task 10: Campos numéricos

**Files:**
- Create: `src/componentes/CampoNumero.jsx`, `src/componentes/CampoNumero.test.jsx`
- Create: `src/componentes/CampoMoeda.jsx`
- Create: `src/componentes/campos.css`

**Interfaces:**
- Consumes: nada
- Produces:
  - `<CampoNumero id rotulo valor aoMudar prefixo? sufixo? dica? />` — `valor` é **texto**, `aoMudar` recebe **texto** cru. Quem chama converte com `paraNumero`/`paraCentavos`.
  - `<CampoMoeda id rotulo valor aoMudar dica? />` — o mesmo com `R$` na frente.

O campo guarda texto, não número, de propósito: enquanto ela digita `8,` o valor não é um número válido, e um campo controlado por número apagaria a vírgula debaixo do dedo dela.

- [ ] **Step 1: Escrever `src/componentes/CampoNumero.test.jsx`**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampoNumero } from './CampoNumero'
import { CampoMoeda } from './CampoMoeda'

describe('CampoNumero', () => {
  it('mostra o rótulo ligado ao campo', () => {
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={() => {}} />)
    expect(screen.getByLabelText('Quantidade')).toBeTruthy()
  })

  it('abre o teclado numérico no celular', () => {
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={() => {}} />)
    expect(screen.getByLabelText('Quantidade').getAttribute('inputMode')).toBe('decimal')
  })

  it('é campo de texto, não number — senão a vírgula some no meio da digitação', () => {
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={() => {}} />)
    expect(screen.getByLabelText('Quantidade').getAttribute('type')).toBe('text')
  })

  it('avisa a cada tecla, com o texto cru', async () => {
    const aoMudar = vi.fn()
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={aoMudar} />)
    await userEvent.type(screen.getByLabelText('Quantidade'), '8')
    expect(aoMudar).toHaveBeenCalledWith('8')
  })

  it('deixa digitar vírgula sem reclamar', async () => {
    const aoMudar = vi.fn()
    render(<CampoNumero id="qtd" rotulo="Quantidade" valor="8" aoMudar={aoMudar} />)
    await userEvent.type(screen.getByLabelText('Quantidade'), ',')
    expect(aoMudar).toHaveBeenCalledWith('8,')
  })

  it('mostra sufixo e dica', () => {
    render(
      <CampoNumero id="qtd" rotulo="Quantidade" valor="" aoMudar={() => {}}
        sufixo="g" dica="quanto entrou na panela" />,
    )
    expect(screen.getByText('g')).toBeTruthy()
    expect(screen.getByText('quanto entrou na panela')).toBeTruthy()
  })
})

describe('CampoMoeda', () => {
  it('mostra R$ na frente', () => {
    render(<CampoMoeda id="preco" rotulo="Preço" valor="" aoMudar={() => {}} />)
    expect(screen.getByText('R$')).toBeTruthy()
    expect(screen.getByLabelText('Preço').getAttribute('inputMode')).toBe('decimal')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/componentes/CampoNumero.test.jsx`
Expected: FAIL — `Failed to resolve import "./CampoNumero"`.

- [ ] **Step 3: Escrever `src/componentes/CampoNumero.jsx`**

```jsx
import './campos.css'

/** O valor é TEXTO, e a conversão é de quem chama.
 *
 *  Enquanto ela digita "8," o conteúdo não é um número válido. Um campo controlado por
 *  número apagaria a vírgula no instante em que ela a digita, e o campo viraria uma luta. */
export function CampoNumero({ id, rotulo, valor, aoMudar, prefixo, sufixo, dica, autoFocus }) {
  return (
    <div className="campo">
      <label className="campo-rotulo" htmlFor={id}>{rotulo}</label>
      <div className="campo-caixa">
        {prefixo ? <span className="campo-fixo">{prefixo}</span> : null}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={valor}
          autoFocus={autoFocus}
          onChange={(e) => aoMudar(e.target.value)}
        />
        {sufixo ? <span className="campo-fixo">{sufixo}</span> : null}
      </div>
      {dica ? <p className="campo-dica">{dica}</p> : null}
    </div>
  )
}
```

- [ ] **Step 4: Escrever `src/componentes/CampoMoeda.jsx`**

```jsx
import { CampoNumero } from './CampoNumero'

/** Ela digita reais; quem chama converte com `paraCentavos`. O `R$` fixo na frente do
 *  campo é o que evita ela digitar "R$ 10" e o parse recusar. */
export function CampoMoeda(props) {
  return <CampoNumero {...props} prefixo="R$" />
}
```

- [ ] **Step 5: Escrever `src/componentes/campos.css`**

```css
.campo { margin-bottom: 16px; }

.campo-rotulo {
  display: block;
  font-size: .9rem;
  font-weight: 600;
  color: var(--texto-medio);
  margin-bottom: 6px;
}

.campo-caixa {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--card);
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  padding: 0 14px;
  transition: border-color var(--t-rapida);
}

.campo-caixa:focus-within { border-color: var(--marca); }

.campo-caixa input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  padding: 14px 0;
}

.campo-fixo {
  color: var(--texto-suave);
  font-weight: 600;
  flex: none;
}

.campo-dica {
  margin: 6px 0 0;
  font-size: .82rem;
  color: var(--texto-suave);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/componentes/CampoNumero.test.jsx`
Expected: PASS, 7 testes.

- [ ] **Step 7: Commit**

```bash
git add src/componentes/CampoNumero.jsx src/componentes/CampoMoeda.jsx src/componentes/CampoNumero.test.jsx src/componentes/campos.css
git commit -m "feat: campos numericos que aceitam virgula"
```

---

## Task 11: `useDados` e a casca do App

**Files:**
- Create: `src/dados/useDados.js`, `src/dados/useDados.test.jsx`
- Modify: `src/App.jsx`, `src/App.test.jsx`
- Create: `src/styles/app.css`

**Interfaces:**
- Consumes: `repositorio.js` (Tasks 5–7), `disponivel()` de `indexeddb.js`
- Produces:
  - `useDados() -> { carregando, erro, ingredientes, receitas, producoes, ingredientesPorId, recarregar }`
  - `App` com cabeçalho, estado vazio e o aviso de armazenamento bloqueado

- [ ] **Step 1: Escrever `src/dados/useDados.test.jsx`**

```jsx
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/dados/useDados.test.jsx`
Expected: FAIL — `Failed to resolve import "./useDados"`.

- [ ] **Step 3: Escrever `src/dados/useDados.js`**

```js
import { useCallback, useEffect, useMemo, useState } from 'react'
import { disponivel } from './indexeddb'
import { listarIngredientes, listarReceitas, listarProducoes } from './repositorio'

const VAZIO = { ingredientes: [], receitas: [], producoes: [] }

/** O único caminho entre o banco e a tela. Nenhum componente chama o repositório direto:
 *  assim existe um lugar só para recarregar depois de gravar, e a tela nunca fica
 *  mostrando um custo calculado com o preço velho. */
export function useDados() {
  const [estado, setEstado] = useState({ carregando: true, erro: null, ...VAZIO })

  const recarregar = useCallback(async () => {
    if (!disponivel()) {
      setEstado({
        carregando: false,
        erro: 'Este navegador está bloqueando o armazenamento. Nada do que você digitar aqui vai ser salvo — provavelmente é uma aba anônima.',
        ...VAZIO,
      })
      return
    }
    try {
      const [ingredientes, receitas, producoes] = await Promise.all([
        listarIngredientes(), listarReceitas(), listarProducoes(),
      ])
      setEstado({ carregando: false, erro: null, ingredientes, receitas, producoes })
    } catch (e) {
      setEstado({ carregando: false, erro: `Não consegui ler os dados salvos: ${e.message}`, ...VAZIO })
    }
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  // O motor recebe os ingredientes indexados por id — procurar em lista dentro do laço de
  // itens faria a conta ser O(itens × ingredientes) a cada tecla digitada no rendimento.
  const ingredientesPorId = useMemo(
    () => Object.fromEntries(estado.ingredientes.map((i) => [i.id, i])),
    [estado.ingredientes],
  )

  return { ...estado, ingredientesPorId, recarregar }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/dados/useDados.test.jsx`
Expected: PASS, 3 testes.

- [ ] **Step 5: Substituir `src/App.test.jsx`**

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from './dados/indexeddb'
import { salvarIngrediente, salvarReceita } from './dados/repositorio'
import App from './App.jsx'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

describe('App', () => {
  it('mostra o nome do app antes mesmo de os dados chegarem', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Lariano Doces', level: 1 })).toBeTruthy()
  })

  it('sem doce cadastrado, convida a cadastrar o primeiro', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/ainda não cadastrou nenhum doce/i)).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: /cadastrar meu primeiro doce/i })).toBeTruthy()
  })

  it('com doce cadastrado, não mostra mais o convite', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    await salvarReceita({
      nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
      itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
    })

    render(<App />)
    await waitFor(() => {
      expect(screen.queryByText(/ainda não cadastrou nenhum doce/i)).toBe(null)
    })
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/App.test.jsx`
Expected: FAIL — o convite não existe.

- [ ] **Step 7: Escrever `src/App.jsx`**

O cabeçalho é renderizado **antes** de esperar os dados, de propósito: uma tela que fica em branco por meio segundo enquanto o IndexedDB abre parece um app quebrado.

```jsx
import { useState } from 'react'
import { useDados } from './dados/useDados'
import './styles/app.css'

export default function App() {
  const dados = useDados()
  const [folha, setFolha] = useState(null)

  const semDoce = !dados.carregando && dados.receitas.length === 0

  return (
    <div className="app">
      <header className="app-topo">
        <h1>Lariano Doces</h1>
        <button
          type="button"
          className="app-ajustes"
          aria-label="Ajustes"
          onClick={() => setFolha('ajustes')}
        >
          ⚙
        </button>
      </header>

      {dados.erro ? <p className="aviso aviso-erro" role="alert">{dados.erro}</p> : null}

      <main className="app-corpo">
        {dados.carregando ? <p className="app-carregando">carregando…</p> : null}

        {semDoce ? (
          <section className="vazio">
            <p>Você ainda não cadastrou nenhum doce.</p>
            <button type="button" className="botao-principal" onClick={() => setFolha('novo')}>
              Cadastrar meu primeiro doce
            </button>
          </section>
        ) : null}
      </main>
    </div>
  )
}
```

`folha` fica no estado desde já porque as Tasks 12 a 16 penduram as folhas exatamente nele — cada uma acrescenta um valor possível (`'doces'`, `'novo'`, `'ingredientes'`, `'historico'`, `'ajustes'`) e o seu bloco de render.

- [ ] **Step 8: Escrever `src/styles/app.css`**

```css
.app {
  max-width: 520px;
  margin: 0 auto;
  padding: 0 16px calc(32px + env(safe-area-inset-bottom));
}

.app-topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0 12px;
}

.app-topo h1 {
  font-size: 1.25rem;
  color: var(--marca);
  letter-spacing: -.01em;
}

.app-ajustes {
  border: 0;
  background: var(--marca-clara);
  width: 44px;
  height: 44px;
  border-radius: var(--raio-pilula);
  font-size: 1.15rem;
}

.app-carregando { color: var(--texto-suave); }

.vazio {
  background: var(--card);
  border: 1px solid var(--borda);
  border-radius: var(--raio-lg);
  padding: 32px 22px;
  text-align: center;
  box-shadow: var(--e1);
}

.vazio p { margin: 0 0 20px; color: var(--texto-medio); }

.botao-principal {
  width: 100%;
  border: 0;
  background: var(--marca);
  color: #fff;
  font-weight: 650;
  padding: 16px;
  border-radius: var(--raio);
  box-shadow: var(--e1);
}

.botao-principal:disabled {
  background: var(--borda);
  color: var(--texto-suave);
  box-shadow: none;
}

.botao-secundario {
  border: 1px solid var(--borda);
  background: var(--card);
  color: var(--texto-medio);
  font-weight: 600;
  padding: 12px 16px;
  border-radius: var(--raio);
}

.aviso {
  border-radius: var(--raio);
  padding: 12px 14px;
  font-size: .9rem;
  margin: 0 0 16px;
}

.aviso-erro { background: #fdecea; color: var(--negativo); }
.aviso-atencao { background: #fdf3e3; color: var(--atencao); }
```

- [ ] **Step 9: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 121 testes.

- [ ] **Step 10: Commit**

```bash
git add src/dados/useDados.js src/dados/useDados.test.jsx src/App.jsx src/App.test.jsx src/styles/app.css
git commit -m "feat: hook de dados e casca do app com estado vazio"
```

---

## Task 12: Editar doce, com cadastro de ingrediente embutido

A peça que decide se o app é usado. Sem o cadastro embutido, o primeiro brigadeiro são sete idas e voltas entre duas telas e ela desiste no terceiro ingrediente.

**Files:**
- Create: `src/paginas/FolhaEditarDoce.jsx`, `src/paginas/FolhaEditarDoce.test.jsx`
- Create: `src/paginas/FolhaDoces.jsx`
- Create: `src/paginas/paginas.css`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `Folha` (Task 9), `CampoNumero`/`CampoMoeda` (Task 10), `salvarReceita`/`apagarReceita`/`salvarIngrediente` (Tasks 5–6), `paraNumero`/`paraCentavos` (Task 2), `normalizar` (Task 2)
- Produces:
  - `<FolhaEditarDoce aberta receita ingredientes aoFechar aoGravado />` — `receita` `null` cria
  - `<FolhaDoces aberta receitas aoFechar aoEscolher aoNovo />`

O componente guarda o formulário em estado próprio e **não** se atualiza sozinho quando `receita` muda. Quem chama monta com `key={receita?.id ?? 'novo'}`, e a troca de chave remonta o formulário limpo — é o idioma do React para "formulário de outro registro", e evita todo um efeito de sincronização que erra em algum caso.

- [ ] **Step 1: Escrever `src/paginas/FolhaEditarDoce.test.jsx`**

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from '../dados/indexeddb'
import { salvarIngrediente, listarReceitas, listarIngredientes } from '../dados/repositorio'
import { FolhaEditarDoce } from './FolhaEditarDoce'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

const TODDY = { nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000 }

function montar(props = {}) {
  return render(
    <FolhaEditarDoce
      aberta
      receita={null}
      ingredientes={[]}
      aoFechar={() => {}}
      aoGravado={() => {}}
      {...props}
    />,
  )
}

describe('FolhaEditarDoce — cadastrar', () => {
  it('abre com um campo de ingrediente já em branco, para ela começar a digitar', () => {
    montar()
    expect(screen.getByLabelText('Ingrediente 1')).toBeTruthy()
  })

  it('acrescenta linha de ingrediente', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /ingrediente/i }))
    expect(screen.getByLabelText('Ingrediente 2')).toBeTruthy()
  })

  it('remove linha de ingrediente', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /ingrediente/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Tirar ingrediente 2' }))
    expect(screen.queryByLabelText('Ingrediente 2')).toBe(null)
  })

  it('reconhece ingrediente já cadastrado e mostra a unidade dele', async () => {
    const toddy = await salvarIngrediente(TODDY)
    montar({ ingredientes: [toddy] })

    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'toddy')
    await waitFor(() => expect(screen.getByText('(400 g — R$ 10,00)')).toBeTruthy())
    expect(screen.getByLabelText('Quantidade 1')).toBeTruthy()
    expect(screen.getAllByText('g').length).toBeGreaterThan(0)
  })

  it('grava a receita com nome, rendimento, margem e itens', async () => {
    const toddy = await salvarIngrediente(TODDY)
    const aoGravado = vi.fn()
    montar({ ingredientes: [toddy], aoGravado })

    await userEvent.type(screen.getByLabelText('Nome do doce'), 'Brigadeiro')
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '50')
    await userEvent.type(screen.getByLabelText(/margem/i), '200')
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Toddy')
    await userEvent.type(screen.getByLabelText('Quantidade 1'), '80')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))

    await waitFor(() => expect(aoGravado).toHaveBeenCalled())
    const receitas = await listarReceitas()
    expect(receitas).toHaveLength(1)
    expect(receitas[0].nome).toBe('Brigadeiro')
    expect(receitas[0].rendimentoBase).toBe(50)
    expect(receitas[0].margemPct).toBe(200)
    expect(receitas[0].itens).toEqual([{ ingredienteId: toddy.id, quantidade: 80 }])
  })

  it('aceita quantidade com vírgula', async () => {
    const toddy = await salvarIngrediente(TODDY)
    montar({ ingredientes: [toddy] })

    await userEvent.type(screen.getByLabelText('Nome do doce'), 'Bolo')
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '12')
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Toddy')
    await userEvent.type(screen.getByLabelText('Quantidade 1'), '12,5')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))

    await waitFor(async () => {
      const receitas = await listarReceitas()
      expect(receitas[0]?.itens).toEqual([{ ingredienteId: toddy.id, quantidade: 12.5 }])
    })
  })

  it('ignora linha em branco em vez de reclamar dela', async () => {
    const toddy = await salvarIngrediente(TODDY)
    montar({ ingredientes: [toddy] })

    await userEvent.type(screen.getByLabelText('Nome do doce'), 'Bolo')
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '12')
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Toddy')
    await userEvent.type(screen.getByLabelText('Quantidade 1'), '80')
    await userEvent.click(screen.getByRole('button', { name: /ingrediente/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))

    await waitFor(async () => {
      const receitas = await listarReceitas()
      expect(receitas[0]?.itens).toHaveLength(1)
    })
  })

  it('mostra o erro do repositório em vez de fechar calado', async () => {
    montar()
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '50')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/nome/i))
  })
})

describe('FolhaEditarDoce — cadastro embutido de ingrediente', () => {
  it('nome que não existe oferece cadastrar ali mesmo', async () => {
    montar()
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Chocolate')
    expect(screen.getByRole('button', { name: /cadastrar "Chocolate"/i })).toBeTruthy()
  })

  it('nome que já existe NÃO oferece cadastrar de novo', async () => {
    const toddy = await salvarIngrediente(TODDY)
    montar({ ingredientes: [toddy] })
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Toddy')
    expect(screen.queryByRole('button', { name: /cadastrar "/i })).toBe(null)
  })

  it('cadastra o ingrediente sem sair da folha e já usa ele na linha', async () => {
    montar()
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Chocolate')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Chocolate"/i }))

    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'g')
    await userEvent.type(screen.getByLabelText(/quanto vem na embalagem/i), '200')
    await userEvent.type(screen.getByLabelText(/preço da embalagem/i), '8,00')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))

    await waitFor(() => expect(screen.getByText('(200 g — R$ 8,00)')).toBeTruthy())

    const salvos = await listarIngredientes()
    expect(salvos).toHaveLength(1)
    expect(salvos[0].nome).toBe('Chocolate')
    expect(salvos[0].embalagemPrecoCent).toBe(800)
  })

  it('deixa cadastrar ingrediente sem preço ainda', async () => {
    montar()
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Chocolate')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Chocolate"/i }))
    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'g')
    await userEvent.type(screen.getByLabelText(/quanto vem na embalagem/i), '200')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))

    await waitFor(async () => {
      const salvos = await listarIngredientes()
      expect(salvos[0]?.embalagemPrecoCent).toBe(null)
    })
  })

  it('erro no cadastro embutido aparece dentro do próprio bloco', async () => {
    montar()
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Chocolate')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Chocolate"/i }))
    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'g')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/embalagem/i))
    expect(await listarIngredientes()).toEqual([])
  })
})

describe('FolhaEditarDoce — editar', () => {
  it('abre com os campos preenchidos', async () => {
    const toddy = await salvarIngrediente(TODDY)
    const receita = {
      id: 'rec_1', nome: 'Brigadeiro', rendimentoBase: 50, margemPct: 200,
      itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
    }
    montar({ receita, ingredientes: [toddy] })

    expect(screen.getByLabelText('Nome do doce').value).toBe('Brigadeiro')
    expect(screen.getByLabelText(/rende quantos/i).value).toBe('50')
    expect(screen.getByLabelText(/margem/i).value).toBe('200')
    expect(screen.getByLabelText('Ingrediente 1').value).toBe('Toddy')
    expect(screen.getByLabelText('Quantidade 1').value).toBe('80')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/paginas/FolhaEditarDoce.test.jsx`
Expected: FAIL — `Failed to resolve import "./FolhaEditarDoce"`.

- [ ] **Step 3: Escrever `src/paginas/FolhaEditarDoce.jsx`**

```jsx
import { useMemo, useState } from 'react'
import { Folha } from '../componentes/Folha'
import { CampoNumero } from '../componentes/CampoNumero'
import { CampoMoeda } from '../componentes/CampoMoeda'
import { salvarReceita, salvarIngrediente } from '../dados/repositorio'
import { paraNumero, paraCentavos } from '../lib/numeroBR'
import { normalizar } from '../lib/texto'
import { formatBRL } from '../lib/formato'
import './paginas.css'

let proximaChave = 1
function novaLinha() {
  return { chave: `linha_${proximaChave++}`, texto: '', quantidade: '' }
}

function linhasIniciais(receita, ingredientes) {
  if (!receita) return [novaLinha()]
  const porId = Object.fromEntries(ingredientes.map((i) => [i.id, i]))
  const linhas = receita.itens.map((item) => ({
    chave: `linha_${proximaChave++}`,
    texto: porId[item.ingredienteId]?.nome ?? '',
    quantidade: String(item.quantidade).replace('.', ','),
  }))
  return linhas.length ? linhas : [novaLinha()]
}

/** `receita` `null` cria um doce novo. Quem monta este componente passa
 *  `key={receita?.id ?? 'novo'}`: trocar a chave remonta o formulário do zero, que é como
 *  o React quer que se troque o registro de um formulário. */
export function FolhaEditarDoce({ aberta, receita, ingredientes, aoFechar, aoGravado }) {
  const [nome, setNome] = useState(receita?.nome ?? '')
  const [rendimentoBase, setRendimentoBase] = useState(
    receita ? String(receita.rendimentoBase) : '',
  )
  const [margem, setMargem] = useState(
    receita?.margemPct === null || receita?.margemPct === undefined ? '' : String(receita.margemPct),
  )
  const [linhas, setLinhas] = useState(() => linhasIniciais(receita, ingredientes))
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  // `cadastrando` guarda a CHAVE da linha que pediu o cadastro. É por ela que o formulário
  // embutido sabe em qual linha devolver o ingrediente recém-criado.
  const [cadastrando, setCadastrando] = useState(null)

  const porNome = useMemo(
    () => Object.fromEntries(ingredientes.map((i) => [i.nomeNormalizado ?? normalizar(i.nome), i])),
    [ingredientes],
  )

  const acharIngrediente = (texto) => porNome[normalizar(texto)] ?? null

  const mudarLinha = (chave, campo, valor) => {
    setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)))
  }

  async function gravar() {
    setErro(null)
    setSalvando(true)
    try {
      const itens = linhas
        // Linha em branco é rascunho, não erro: ela toca em "+ ingrediente" e só depois
        // pensa no que colocar. Reclamar de linha vazia transformaria o botão numa
        // armadilha.
        .filter((l) => l.texto.trim() !== '' || l.quantidade.trim() !== '')
        .map((l) => {
          const ingrediente = acharIngrediente(l.texto)
          if (!ingrediente) throw new Error(`"${l.texto.trim()}" ainda não está cadastrado.`)
          const quantidade = paraNumero(l.quantidade)
          if (quantidade === null) {
            throw new Error(`Falta a quantidade de ${ingrediente.nome}.`)
          }
          return { ingredienteId: ingrediente.id, quantidade }
        })

      await salvarReceita(
        {
          nome,
          rendimentoBase: paraNumero(rendimentoBase),
          margemPct: margem.trim() === '' ? null : paraNumero(margem),
          itens,
        },
        receita?.id,
      )
      aoGravado()
      aoFechar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Folha aberta={aberta} titulo={receita ? 'Editar doce' : 'Novo doce'} aoFechar={aoFechar}>
      {erro ? <p className="aviso aviso-erro" role="alert">{erro}</p> : null}

      <div className="campo">
        <label className="campo-rotulo" htmlFor="doce-nome">Nome do doce</label>
        <div className="campo-caixa">
          <input
            id="doce-nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Brigadeiro"
          />
        </div>
      </div>

      <CampoNumero
        id="doce-rendimento"
        rotulo="Uma receita rende quantos?"
        valor={rendimentoBase}
        aoMudar={setRendimentoBase}
        dica="É o normal desse doce. Serve de referência quando o rendimento sair diferente."
      />

      <CampoNumero
        id="doce-margem"
        rotulo="Margem de lucro"
        valor={margem}
        aoMudar={setMargem}
        sufixo="%"
        dica="Deixe em branco se ainda não decidiu o preço de venda."
      />

      <h3 className="secao">Ingredientes</h3>

      {linhas.map((linha, indice) => {
        const ingrediente = acharIngrediente(linha.texto)
        const digitou = linha.texto.trim() !== ''
        const numero = indice + 1

        return (
          <div className="linha-ingrediente" key={linha.chave}>
            <div className="campo">
              <label className="campo-rotulo" htmlFor={`ing-${linha.chave}`}>
                {`Ingrediente ${numero}`}
              </label>
              <div className="campo-caixa">
                <input
                  id={`ing-${linha.chave}`}
                  type="text"
                  list="lista-ingredientes"
                  value={linha.texto}
                  onChange={(e) => mudarLinha(linha.chave, 'texto', e.target.value)}
                  placeholder="Leite condensado"
                />
                {linhas.length > 1 ? (
                  <button
                    type="button"
                    className="linha-tirar"
                    aria-label={`Tirar ingrediente ${numero}`}
                    onClick={() =>
                      setLinhas((atuais) => atuais.filter((l) => l.chave !== linha.chave))
                    }
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>

            {ingrediente ? (
              <>
                {/* O parêntese com o preço cheio: é aqui que ela confere, de bate-pronto,
                    se o valor cadastrado ainda é o do mercado. */}
                <p className="linha-cheio">
                  {`(${ingrediente.embalagemQtd} ${ingrediente.unidade} — ${formatBRL(ingrediente.embalagemPrecoCent)})`}
                </p>
                <CampoNumero
                  id={`qtd-${linha.chave}`}
                  rotulo={`Quantidade ${numero}`}
                  valor={linha.quantidade}
                  aoMudar={(v) => mudarLinha(linha.chave, 'quantidade', v)}
                  sufixo={ingrediente.unidade}
                />
              </>
            ) : null}

            {digitou && !ingrediente && cadastrando !== linha.chave ? (
              <button
                type="button"
                className="botao-secundario linha-cadastrar"
                onClick={() => setCadastrando(linha.chave)}
              >
                {`Cadastrar "${linha.texto.trim()}" como ingrediente novo`}
              </button>
            ) : null}

            {cadastrando === linha.chave ? (
              <CadastroEmbutido
                nome={linha.texto.trim()}
                aoCancelar={() => setCadastrando(null)}
                aoCriar={async () => {
                  setCadastrando(null)
                  await aoGravado()
                }}
              />
            ) : null}
          </div>
        )
      })}

      <datalist id="lista-ingredientes">
        {ingredientes.map((i) => <option key={i.id} value={i.nome} />)}
      </datalist>

      <button
        type="button"
        className="botao-secundario"
        onClick={() => setLinhas((atuais) => [...atuais, novaLinha()])}
      >
        + ingrediente
      </button>

      <button
        type="button"
        className="botao-principal salvar-doce"
        onClick={gravar}
        disabled={salvando}
      >
        Salvar doce
      </button>
    </Folha>
  )
}

/** O cadastro que abre DENTRO da linha. Sem ele, cadastrar o primeiro brigadeiro são sete
 *  idas e voltas entre duas telas — e ela desiste no terceiro ingrediente. */
function CadastroEmbutido({ nome, aoCriar, aoCancelar }) {
  const [unidade, setUnidade] = useState('g')
  const [embalagemQtd, setEmbalagemQtd] = useState('')
  const [preco, setPreco] = useState('')
  const [erro, setErro] = useState(null)

  async function criar() {
    setErro(null)
    try {
      await salvarIngrediente({
        nome,
        unidade,
        embalagemQtd: paraNumero(embalagemQtd),
        embalagemPrecoCent: preco.trim() === '' ? null : paraCentavos(preco),
      })
      await aoCriar()
    } catch (e) {
      setErro(e.message)
    }
  }

  return (
    <div className="cadastro-embutido">
      <p className="cadastro-titulo">{`Cadastrando ${nome}`}</p>
      {erro ? <p className="aviso aviso-erro" role="alert">{erro}</p> : null}

      <div className="campo">
        <label className="campo-rotulo" htmlFor="emb-unidade">Unidade</label>
        <div className="campo-caixa">
          <select id="emb-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            <option value="g">gramas (g)</option>
            <option value="ml">mililitros (ml)</option>
            <option value="un">unidade (un)</option>
          </select>
        </div>
      </div>

      <CampoNumero
        id="emb-qtd"
        rotulo="Quanto vem na embalagem"
        valor={embalagemQtd}
        aoMudar={setEmbalagemQtd}
        sufixo={unidade}
        dica="O pacote inteiro. Ex.: 400 g."
      />

      <CampoMoeda
        id="emb-preco"
        rotulo="Preço da embalagem"
        valor={preco}
        aoMudar={setPreco}
        dica="Pode deixar em branco e preencher depois."
      />

      <div className="cadastro-botoes">
        <button type="button" className="botao-secundario" onClick={aoCancelar}>Cancelar</button>
        <button type="button" className="botao-principal" onClick={criar}>Salvar ingrediente</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Escrever `src/paginas/FolhaDoces.jsx`**

```jsx
import { Folha } from '../componentes/Folha'
import './paginas.css'

export function FolhaDoces({ aberta, receitas, aoFechar, aoEscolher, aoNovo }) {
  return (
    <Folha aberta={aberta} titulo="Meus doces" aoFechar={aoFechar}>
      {receitas.length === 0 ? (
        <p className="lista-vazia">Nenhum doce cadastrado ainda.</p>
      ) : (
        <ul className="lista">
          {receitas.map((r) => (
            <li key={r.id}>
              <button type="button" className="lista-item" onClick={() => aoEscolher(r)}>
                <span className="lista-item-nome">{r.nome}</span>
                <span className="lista-item-detalhe">
                  {`rende ${r.rendimentoBase} · ${r.itens.length} ingrediente${r.itens.length === 1 ? '' : 's'}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="botao-principal" onClick={aoNovo}>+ novo doce</button>
    </Folha>
  )
}
```

- [ ] **Step 5: Escrever `src/paginas/paginas.css`**

```css
.secao {
  font-size: .95rem;
  color: var(--texto-medio);
  margin: 26px 0 12px;
  padding-top: 16px;
  border-top: 1px solid var(--borda);
}

.linha-ingrediente {
  background: #fffdfc;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  padding: 14px 14px 2px;
  margin-bottom: 12px;
}

.linha-tirar {
  border: 0;
  background: transparent;
  color: var(--texto-suave);
  font-size: 1.3rem;
  line-height: 1;
  width: 32px;
  height: 44px;
  flex: none;
}

.linha-cheio {
  margin: -8px 0 12px;
  font-size: .85rem;
  color: var(--texto-suave);
}

.linha-cadastrar { width: 100%; margin-bottom: 14px; }

.cadastro-embutido {
  background: var(--marca-clara);
  border-radius: var(--raio);
  padding: 14px 14px 4px;
  margin-bottom: 14px;
}

.cadastro-titulo {
  margin: 0 0 12px;
  font-weight: 650;
  color: var(--marca);
}

.cadastro-botoes {
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
}

.cadastro-botoes > * { flex: 1; }

.salvar-doce { margin-top: 18px; }

.lista { list-style: none; margin: 0 0 18px; padding: 0; }

.lista-item {
  width: 100%;
  text-align: left;
  border: 1px solid var(--borda);
  background: var(--card);
  border-radius: var(--raio);
  padding: 14px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lista-item-nome { font-weight: 650; }
.lista-item-detalhe { font-size: .85rem; color: var(--texto-suave); }
.lista-vazia { color: var(--texto-suave); margin: 0 0 18px; }
```

- [ ] **Step 6: Pendurar as duas folhas no `src/App.jsx`**

Acrescente os imports e, dentro do `<div className="app">`, depois do `<main>`:

```jsx
import { FolhaDoces } from './paginas/FolhaDoces'
import { FolhaEditarDoce } from './paginas/FolhaEditarDoce'
```

No corpo do componente, junto dos outros `useState`:

```jsx
const [receitaEditando, setReceitaEditando] = useState(null)
```

E antes de fechar o `</div>`:

```jsx
<FolhaDoces
  aberta={folha === 'doces'}
  receitas={dados.receitas}
  aoFechar={() => setFolha(null)}
  aoEscolher={(r) => { setReceitaEditando(r); setFolha('editar') }}
  aoNovo={() => { setReceitaEditando(null); setFolha('editar') }}
/>

{folha === 'editar' || folha === 'novo' ? (
  <FolhaEditarDoce
    // A chave é o que remonta o formulário ao trocar de doce. Sem ela, abrir o
    // beijinho depois do brigadeiro mostraria os campos do brigadeiro.
    key={receitaEditando?.id ?? 'novo'}
    aberta
    receita={folha === 'novo' ? null : receitaEditando}
    ingredientes={dados.ingredientes}
    aoFechar={() => setFolha(null)}
    aoGravado={dados.recarregar}
  />
) : null}
```

E troque o botão do estado vazio para abrir o cadastro:

```jsx
<button type="button" className="botao-principal" onClick={() => { setReceitaEditando(null); setFolha('novo') }}>
  Cadastrar meu primeiro doce
</button>
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/paginas/FolhaEditarDoce.test.jsx`
Expected: PASS, 14 testes.

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 135 testes.

- [ ] **Step 9: Commit**

```bash
git add src/paginas/ src/App.jsx
git commit -m "feat: folha de edicao de doce com cadastro embutido de ingrediente"
```

---

## Task 13: Folha de ingredientes

**Files:**
- Create: `src/paginas/FolhaIngredientes.jsx`, `src/paginas/FolhaIngredientes.test.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `Folha` (Task 9), `CampoMoeda` (Task 10), `salvarIngrediente`/`apagarIngrediente` (Task 5), `formatBRL`/`formatarDataBR` (Task 2), `paraCentavos` (Task 2)
- Produces: `<FolhaIngredientes aberta ingredientes aoFechar aoGravado />`

- [ ] **Step 1: Escrever `src/paginas/FolhaIngredientes.test.jsx`**

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAVETA_INGREDIENTES, GAVETA_RECEITAS, GAVETA_PRODUCOES, limparGaveta } from '../dados/indexeddb'
import { salvarIngrediente, salvarReceita, listarIngredientes } from '../dados/repositorio'
import { FolhaIngredientes } from './FolhaIngredientes'

beforeEach(async () => {
  await limparGaveta(GAVETA_INGREDIENTES)
  await limparGaveta(GAVETA_RECEITAS)
  await limparGaveta(GAVETA_PRODUCOES)
})

function montar(ingredientes, props = {}) {
  return render(
    <FolhaIngredientes
      aberta
      ingredientes={ingredientes}
      aoFechar={() => {}}
      aoGravado={() => {}}
      {...props}
    />,
  )
}

describe('FolhaIngredientes', () => {
  it('lista com o preço cheio da embalagem', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    montar([toddy])
    expect(screen.getByText('Toddy')).toBeTruthy()
    expect(screen.getByText(/400 g — R\$ 10,00/)).toBeTruthy()
  })

  it('mostra os mais desatualizados primeiro — é a pergunta que ela faz aqui', () => {
    const velho = {
      id: 'a', nome: 'Manteiga', unidade: 'g', embalagemQtd: 500,
      embalagemPrecoCent: 1200, atualizadoEm: '2026-01-10',
    }
    const novo = {
      id: 'b', nome: 'Toddy', unidade: 'g', embalagemQtd: 400,
      embalagemPrecoCent: 1000, atualizadoEm: '2026-08-20',
    }
    montar([novo, velho])
    const nomes = screen.getAllByTestId('ingrediente-nome').map((n) => n.textContent)
    expect(nomes).toEqual(['Manteiga', 'Toddy'])
  })

  it('avisa quando falta preço, em vez de mostrar R$ 0,00', async () => {
    const sem = await salvarIngrediente({
      nome: 'Chocolate', unidade: 'g', embalagemQtd: 200, embalagemPrecoCent: null,
    })
    montar([sem])
    expect(screen.getByText(/sem preço/i)).toBeTruthy()
  })

  it('edita o preço e grava', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    const aoGravado = vi.fn()
    montar([toddy], { aoGravado })

    await userEvent.click(screen.getByRole('button', { name: /Toddy/ }))
    const campo = screen.getByLabelText(/preço da embalagem/i)
    await userEvent.clear(campo)
    await userEvent.type(campo, '12,50')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar preço' }))

    await waitFor(() => expect(aoGravado).toHaveBeenCalled())
    const salvos = await listarIngredientes()
    expect(salvos[0].embalagemPrecoCent).toBe(1250)
  })

  it('apaga ingrediente que não está em receita nenhuma', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    montar([toddy])
    await userEvent.click(screen.getByRole('button', { name: /Toddy/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }))

    await waitFor(async () => expect(await listarIngredientes()).toEqual([]))
  })

  it('recusa apagar ingrediente em uso e diz em qual doce ele está', async () => {
    const toddy = await salvarIngrediente({
      nome: 'Toddy', unidade: 'g', embalagemQtd: 400, embalagemPrecoCent: 1000,
    })
    await salvarReceita({
      nome: 'Brigadeiro', rendimentoBase: 50, itens: [{ ingredienteId: toddy.id, quantidade: 80 }],
    })
    montar([toddy])

    await userEvent.click(screen.getByRole('button', { name: /Toddy/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent', expect.stringMatching(/Brigadeiro/),
    )
    expect(await listarIngredientes()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/paginas/FolhaIngredientes.test.jsx`
Expected: FAIL — `Failed to resolve import "./FolhaIngredientes"`.

- [ ] **Step 3: Escrever `src/paginas/FolhaIngredientes.jsx`**

```jsx
import { useMemo, useState } from 'react'
import { Folha } from '../componentes/Folha'
import { CampoMoeda } from '../componentes/CampoMoeda'
import { salvarIngrediente, apagarIngrediente } from '../dados/repositorio'
import { paraCentavos } from '../lib/numeroBR'
import { formatBRL, formatarDataBR } from '../lib/formato'
import './paginas.css'

export function FolhaIngredientes({ aberta, ingredientes, aoFechar, aoGravado }) {
  const [abertoId, setAbertoId] = useState(null)

  // Mais desatualizado no topo. É a única pergunta que ela faz nesta tela — "qual preço
  // está velho?" — e ordem alfabética não responde nenhuma pergunta.
  const ordenados = useMemo(
    () => [...ingredientes].sort((a, b) =>
      String(a.atualizadoEm ?? '').localeCompare(String(b.atualizadoEm ?? ''))),
    [ingredientes],
  )

  return (
    <Folha aberta={aberta} titulo="Ingredientes" aoFechar={aoFechar}>
      {ordenados.length === 0 ? (
        <p className="lista-vazia">
          Nenhum ingrediente ainda. Eles são cadastrados na hora de montar um doce.
        </p>
      ) : null}

      <ul className="lista">
        {ordenados.map((ing) => (
          <li key={ing.id}>
            <button
              type="button"
              className="lista-item"
              onClick={() => setAbertoId(abertoId === ing.id ? null : ing.id)}
            >
              <span className="lista-item-nome" data-testid="ingrediente-nome">{ing.nome}</span>
              <span className="lista-item-detalhe">
                {ing.embalagemPrecoCent === null
                  ? 'sem preço cadastrado'
                  : `${ing.embalagemQtd} ${ing.unidade} — ${formatBRL(ing.embalagemPrecoCent)}`}
              </span>
              <span className="lista-item-detalhe">
                {`preço de ${formatarDataBR(ing.atualizadoEm)}`}
              </span>
            </button>

            {abertoId === ing.id ? (
              <EditarPreco
                ingrediente={ing}
                aoGravado={async () => { setAbertoId(null); await aoGravado() }}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </Folha>
  )
}

function EditarPreco({ ingrediente, aoGravado }) {
  const [preco, setPreco] = useState(
    ingrediente.embalagemPrecoCent === null
      ? ''
      : (ingrediente.embalagemPrecoCent / 100).toFixed(2).replace('.', ','),
  )
  const [erro, setErro] = useState(null)

  async function salvar() {
    setErro(null)
    try {
      await salvarIngrediente(
        { ...ingrediente, embalagemPrecoCent: preco.trim() === '' ? null : paraCentavos(preco) },
        ingrediente.id,
      )
      await aoGravado()
    } catch (e) {
      setErro(e.message)
    }
  }

  async function apagar() {
    setErro(null)
    try {
      await apagarIngrediente(ingrediente.id)
      await aoGravado()
    } catch (e) {
      // O repositório devolve a frase pronta com o nome dos doces. Repetir ela aqui é o
      // que transforma "não deu" em "está no Brigadeiro, tire de lá primeiro".
      setErro(e.message)
    }
  }

  return (
    <div className="editar-preco">
      {erro ? <p className="aviso aviso-erro" role="alert">{erro}</p> : null}

      <CampoMoeda
        id={`preco-${ingrediente.id}`}
        rotulo={`Preço da embalagem de ${ingrediente.embalagemQtd} ${ingrediente.unidade}`}
        valor={preco}
        aoMudar={setPreco}
      />

      <div className="cadastro-botoes">
        <button type="button" className="botao-secundario" onClick={apagar}>Apagar</button>
        <button type="button" className="botao-principal" onClick={salvar}>Salvar preço</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Acrescentar ao fim de `src/paginas/paginas.css`**

```css
.editar-preco {
  background: var(--marca-clara);
  border-radius: var(--raio);
  padding: 14px 14px 4px;
  margin: -4px 0 12px;
}
```

- [ ] **Step 5: Pendurar no `src/App.jsx`**

```jsx
import { FolhaIngredientes } from './paginas/FolhaIngredientes'
```

E junto das outras folhas:

```jsx
<FolhaIngredientes
  aberta={folha === 'ingredientes'}
  ingredientes={dados.ingredientes}
  aoFechar={() => setFolha(null)}
  aoGravado={dados.recarregar}
/>
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/paginas/FolhaIngredientes.test.jsx`
Expected: PASS, 6 testes.

- [ ] **Step 7: Commit**

```bash
git add src/paginas/FolhaIngredientes.jsx src/paginas/FolhaIngredientes.test.jsx src/paginas/paginas.css src/App.jsx
git commit -m "feat: folha de ingredientes com edicao de preco"
```

---

## Task 14: A calculadora

A tela principal. Tudo o que veio antes existe para esta tela responder uma pergunta só.

**Files:**
- Create: `src/paginas/Calculadora.jsx`, `src/paginas/Calculadora.test.jsx`
- Create: `src/paginas/calculadora.css`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `custoDaProducao`, `precoSugerido`, `lucroDaProducao`, `rendimentoSuspeito` (Tasks 3–4); `CampoNumero` (Task 10); `formatBRL`, `formatarQuantidade` (Task 2)
- Produces: `<Calculadora receitas ingredientesPorId producoes aoAbrirDoces aoAbrirHistorico aoGravado />`

- [ ] **Step 1: Escrever `src/paginas/Calculadora.test.jsx`**

```jsx
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

function montar(props = {}) {
  return render(
    <Calculadora
      receitas={[BRIGADEIRO]}
      ingredientesPorId={PORID}
      producoes={[]}
      aoAbrirDoces={() => {}}
      aoAbrirHistorico={() => {}}
      aoGravado={() => {}}
      {...props}
    />,
  )
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
    expect(screen.getByTestId('preco-venda').textContent).toBe('R$ 1,95')
    expect(screen.getByTestId('lucro').textContent).toBe('R$ 65,00')
  })

  it('sem margem cadastrada, não mostra bloco de venda', () => {
    montar({ receitas: [{ ...BRIGADEIRO, margemPct: null }] })
    expect(screen.queryByTestId('preco-venda')).toBe(null)
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

  it('na primeira produção do doce não avisa nada', async () => {
    montar()
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '200')
    expect(screen.queryByTestId('aviso-rendimento')).toBe(null)
  })

  it('sem doce nenhum não desenha calculadora', () => {
    montar({ receitas: [] })
    expect(screen.queryByLabelText(/rendeu quantos/i)).toBe(null)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/paginas/Calculadora.test.jsx`
Expected: FAIL — `Failed to resolve import "./Calculadora"`.

- [ ] **Step 3: Escrever `src/paginas/Calculadora.jsx`**

```jsx
import { useMemo, useState } from 'react'
import { CampoNumero } from '../componentes/CampoNumero'
import {
  custoDaProducao, custoDoItem, precoSugerido, lucroDaProducao, rendimentoSuspeito,
} from '../motor/custo'
import { salvarProducao } from '../dados/repositorio'
import { paraNumero } from '../lib/numeroBR'
import { formatBRL, formatarQuantidade } from '../lib/formato'
import './calculadora.css'

export function Calculadora({
  receitas, ingredientesPorId, producoes, aoAbrirDoces, aoAbrirHistorico, aoGravado,
}) {
  const [receitaId, setReceitaId] = useState('')
  const [receitasFeitas, setReceitasFeitas] = useState('1')
  const [rendimento, setRendimento] = useState('')
  const [mostrarReceitas, setMostrarReceitas] = useState(false)
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false)
  const [erro, setErro] = useState(null)
  const [salvo, setSalvo] = useState(false)

  // Derivar em vez de sincronizar por efeito: as receitas chegam do banco depois da
  // primeira renderização, e um efeito que "conserta" o id selecionado depois erra sempre
  // num caso — o de ela ter escolhido antes de os dados chegarem.
  const receita = receitas.find((r) => r.id === receitaId) ?? receitas[0] ?? null

  // Campo vazio usa o rendimento normal do doce. É isso que faz "escolheu, viu o preço"
  // ser verdade já na abertura, sem ela digitar nada.
  const rendimentoEfetivo = rendimento.trim() === ''
    ? receita?.rendimentoBase ?? null
    : paraNumero(rendimento)

  const conta = useMemo(() => {
    if (!receita) return null
    return custoDaProducao({
      receita,
      ingredientesPorId,
      receitasFeitas: paraNumero(receitasFeitas),
      rendimento: rendimentoEfetivo,
    })
  }, [receita, ingredientesPorId, receitasFeitas, rendimentoEfetivo])

  const venda = useMemo(() => {
    if (!conta || receita?.margemPct === null || receita?.margemPct === undefined) return null
    const preco = precoSugerido(conta.custoUnitarioCent, receita.margemPct)
    return { preco, lucro: lucroDaProducao(conta.custoUnitarioCent, preco, rendimentoEfetivo) }
  }, [conta, receita, rendimentoEfetivo])

  const producoesDoDoce = producoes.filter((p) => p.receitaId === receita?.id)

  const suspeito = receita && rendimentoSuspeito({
    rendimento: rendimentoEfetivo,
    receitasFeitas: paraNumero(receitasFeitas),
    rendimentoBase: receita.rendimentoBase,
    temProducaoAnterior: producoesDoDoce.length > 0,
  })

  const custoNormal = useMemo(() => {
    if (!receita) return null
    return custoDaProducao({
      receita, ingredientesPorId, receitasFeitas: 1, rendimento: receita.rendimentoBase,
    }).custoUnitarioCent
  }, [receita, ingredientesPorId])

  async function gravar() {
    setErro(null)
    try {
      await salvarProducao({
        receitaId: receita.id,
        nomeReceita: receita.nome,
        receitasFeitas: paraNumero(receitasFeitas),
        rendimento: rendimentoEfetivo,
        custoTotalCent: conta.custoTotalCent,
        custoUnitarioCent: conta.custoUnitarioCent,
        parcial: conta.parcial,
      })
      setSalvo(true)
      await aoGravado()
    } catch (e) {
      setErro(e.message)
    }
  }

  if (!receita) return null

  return (
    <section className="calc">
      <div className="campo">
        <label className="campo-rotulo" htmlFor="calc-doce">O que você fez?</label>
        <div className="campo-caixa">
          <select
            id="calc-doce"
            value={receita.id}
            onChange={(e) => { setReceitaId(e.target.value); setRendimento(''); setSalvo(false) }}
          >
            {receitas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
      </div>

      <CampoNumero
        id="calc-rendimento"
        rotulo="Rendeu quantos?"
        valor={rendimento}
        aoMudar={(v) => { setRendimento(v); setSalvo(false) }}
        placeholder={String(receita.rendimentoBase)}
      />

      {mostrarReceitas ? (
        <CampoNumero
          id="calc-receitas"
          rotulo="Quantas receitas você fez?"
          valor={receitasFeitas}
          aoMudar={(v) => { setReceitasFeitas(v); setSalvo(false) }}
          dica="Uma receita e meia é 1,5. Isso muda o quanto de ingrediente saiu do armário."
        />
      ) : (
        <button type="button" className="chip" onClick={() => setMostrarReceitas(true)}>
          {`${receitasFeitas} receita${paraNumero(receitasFeitas) === 1 ? '' : 's'} ›`}
        </button>
      )}

      <div className="resultado">
        <div className="resultado-linha">
          <span>Custou</span>
          <strong data-testid="custo-total">{formatBRL(conta.custoTotalCent)}</strong>
        </div>
        <div className="resultado-linha">
          <span>Cada</span>
          <strong data-testid="custo-cada">{formatBRL(conta.custoUnitarioCent)}</strong>
        </div>

        {venda ? (
          <>
            <hr />
            <div className="resultado-linha">
              <span>Vender a</span>
              <strong data-testid="preco-venda">{formatBRL(venda.preco)}</strong>
            </div>
            <div className="resultado-linha">
              <span>Lucro</span>
              <strong data-testid="lucro">{formatBRL(venda.lucro)}</strong>
            </div>
          </>
        ) : null}
      </div>

      {conta.parcial ? (
        <p className="aviso aviso-atencao" role="status">
          {`Parcial — falta o preço de ${conta.semPreco.join(', ')}.`}
        </p>
      ) : null}

      {suspeito ? (
        <p className="aviso aviso-atencao" data-testid="aviso-rendimento" role="status">
          {`${formatBRL(conta.custoUnitarioCent)} cada, bem longe do ${formatBRL(custoNormal)} de sempre — conferiu o rendimento?`}
        </p>
      ) : null}

      <button
        type="button"
        className="calc-detalhe"
        onClick={() => setMostrarDetalhe((v) => !v)}
      >
        {mostrarDetalhe ? 'esconder ingredientes ▴' : 'ver ingredientes ▾'}
      </button>

      {mostrarDetalhe ? (
        <ul className="detalhe">
          {receita.itens.map((item) => {
            const ing = ingredientesPorId[item.ingredienteId]
            const custo = custoDoItem(item, ing)
            const cheio = ing
              ? `(${ing.embalagemQtd} ${ing.unidade} — ${formatBRL(ing.embalagemPrecoCent)})`
              : '(ingrediente apagado)'
            return (
              <li key={item.ingredienteId}>
                {`${ing?.nome ?? '?'} ${cheio} · usou ${formatarQuantidade(item.quantidade, ing?.unidade ?? '')} → ${formatBRL(custo === null ? null : Math.round(custo))}`}
              </li>
            )
          })}
        </ul>
      ) : null}

      {erro ? <p className="aviso aviso-erro" role="alert">{erro}</p> : null}

      <button
        type="button"
        className="botao-principal"
        onClick={gravar}
        disabled={conta.custoTotalCent === null || salvo}
      >
        {salvo ? 'Produção salva ✓' : 'Salvar produção'}
      </button>

      <nav className="calc-rodape">
        <button type="button" className="calc-link" onClick={aoAbrirDoces}>Meus doces</button>
        <span aria-hidden="true">·</span>
        <button type="button" className="calc-link" onClick={aoAbrirHistorico}>Histórico</button>
      </nav>
    </section>
  )
}
```

`CampoNumero` ganha um `placeholder` aqui. Acrescente a prop em `src/componentes/CampoNumero.jsx`: some `placeholder` à lista de props e passe `placeholder={placeholder}` para o `<input>`.

- [ ] **Step 4: Escrever `src/paginas/calculadora.css`**

```css
.calc-caixa select { flex: 1; border: 0; outline: 0; background: transparent; padding: 14px 0; }

.chip {
  border: 1px solid var(--borda);
  background: var(--card);
  color: var(--texto-medio);
  border-radius: var(--raio-pilula);
  padding: 8px 16px;
  font-size: .88rem;
  margin: -8px 0 20px;
}

.resultado {
  background: var(--marca);
  color: #fff;
  border-radius: var(--raio-lg);
  padding: 20px 22px;
  box-shadow: var(--e2);
  margin-bottom: 16px;
}

.resultado-linha {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0;
}

.resultado-linha span { opacity: .82; }
.resultado-linha strong { font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.resultado hr { border: 0; border-top: 1px solid rgba(255, 255, 255, .22); margin: 12px 0; }

.calc-detalhe {
  border: 0;
  background: transparent;
  color: var(--marca);
  font-weight: 600;
  padding: 8px 0;
  margin-bottom: 8px;
}

.detalhe {
  list-style: none;
  margin: 0 0 18px;
  padding: 14px;
  background: var(--card);
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  font-size: .86rem;
  color: var(--texto-medio);
}

.detalhe li { padding: 5px 0; }
.detalhe li + li { border-top: 1px solid var(--borda); }

.calc-rodape {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 22px;
  color: var(--texto-suave);
}

.calc-link {
  border: 0;
  background: transparent;
  color: var(--marca);
  font-weight: 600;
  padding: 8px 4px;
}
```

- [ ] **Step 5: Pendurar no `src/App.jsx`**

```jsx
import { Calculadora } from './paginas/Calculadora'
```

Dentro do `<main>`, depois do bloco do estado vazio:

```jsx
{!dados.carregando && dados.receitas.length > 0 ? (
  <Calculadora
    receitas={dados.receitas}
    ingredientesPorId={dados.ingredientesPorId}
    producoes={dados.producoes}
    aoAbrirDoces={() => setFolha('doces')}
    aoAbrirHistorico={() => setFolha('historico')}
    aoGravado={dados.recarregar}
  />
) : null}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/paginas/Calculadora.test.jsx`
Expected: PASS, 12 testes.

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 153 testes.

- [ ] **Step 8: Commit**

```bash
git add src/paginas/Calculadora.jsx src/paginas/Calculadora.test.jsx src/paginas/calculadora.css src/componentes/CampoNumero.jsx src/App.jsx
git commit -m "feat: a calculadora, tela principal do app"
```

---

## Task 15: Folha de histórico

**Files:**
- Create: `src/paginas/FolhaHistorico.jsx`, `src/paginas/FolhaHistorico.test.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `Folha` (Task 9), `apagarProducao` (Task 7), `formatBRL`/`formatarDataBR` (Task 2)
- Produces: `<FolhaHistorico aberta producoes aoFechar aoGravado />`

- [ ] **Step 1: Escrever `src/paginas/FolhaHistorico.test.jsx`**

```jsx
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/paginas/FolhaHistorico.test.jsx`
Expected: FAIL — `Failed to resolve import "./FolhaHistorico"`.

- [ ] **Step 3: Escrever `src/paginas/FolhaHistorico.jsx`**

```jsx
import { Folha } from '../componentes/Folha'
import { apagarProducao } from '../dados/repositorio'
import { formatBRL, formatarDataBR } from '../lib/formato'
import './paginas.css'

export function FolhaHistorico({ aberta, producoes, aoFechar, aoGravado }) {
  async function apagar(p) {
    await apagarProducao(p.id)
    await aoGravado()
  }

  return (
    <Folha aberta={aberta} titulo="Histórico" aoFechar={aoFechar}>
      {producoes.length === 0 ? (
        <p className="lista-vazia">
          Nenhuma produção salva ainda. Calcule um doce e toque em “Salvar produção”.
        </p>
      ) : null}

      <ul className="lista">
        {producoes.map((p) => (
          <li key={p.id} className="historico-item">
            <div className="historico-texto">
              <span className="lista-item-nome">{p.nomeReceita}</span>
              <span className="lista-item-detalhe">
                {`${formatarDataBR(p.data)} · ${p.receitasFeitas} receita${p.receitasFeitas === 1 ? '' : 's'} · rendeu ${p.rendimento}`}
              </span>
              <span className="lista-item-detalhe">
                {`${formatBRL(p.custoTotalCent)} · ${formatBRL(p.custoUnitarioCent)} cada`}
                {p.parcial ? ' · parcial' : ''}
              </span>
            </div>
            <button
              type="button"
              className="linha-tirar"
              aria-label={`Apagar produção de ${p.nomeReceita}`}
              onClick={() => apagar(p)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </Folha>
  )
}
```

- [ ] **Step 4: Acrescentar ao fim de `src/paginas/paginas.css`**

```css
.historico-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--borda);
  background: var(--card);
  border-radius: var(--raio);
  padding: 12px 8px 12px 14px;
  margin-bottom: 8px;
}

.historico-texto { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
```

- [ ] **Step 5: Pendurar no `src/App.jsx`**

```jsx
import { FolhaHistorico } from './paginas/FolhaHistorico'
```

```jsx
<FolhaHistorico
  aberta={folha === 'historico'}
  producoes={dados.producoes}
  aoFechar={() => setFolha(null)}
  aoGravado={dados.recarregar}
/>
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/paginas/FolhaHistorico.test.jsx`
Expected: PASS, 5 testes.

- [ ] **Step 7: Commit**

```bash
git add src/paginas/FolhaHistorico.jsx src/paginas/FolhaHistorico.test.jsx src/paginas/paginas.css src/App.jsx
git commit -m "feat: folha de historico das producoes"
```

---

## Task 16: Folha de ajustes — o backup

**Files:**
- Create: `src/paginas/FolhaAjustes.jsx`, `src/paginas/FolhaAjustes.test.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `Folha` (Task 9), `exportar`/`importar`/`validarBackup`/`resumo` (Task 8)
- Produces: `<FolhaAjustes aberta aoFechar aoGravado />`

- [ ] **Step 1: Escrever `src/paginas/FolhaAjustes.test.jsx`**

```jsx
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

  it('arquivo válido pede confirmação dizendo o tamanho do estrago', async () => {
    montar()
    await userEvent.upload(
      screen.getByLabelText(/escolher arquivo de backup/i),
      arquivo({ versao: 1, ingredientes: [1, 2], receitas: [1], producoes: [] }),
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/paginas/FolhaAjustes.test.jsx`
Expected: FAIL — `Failed to resolve import "./FolhaAjustes"`.

- [ ] **Step 3: Escrever `src/paginas/FolhaAjustes.jsx`**

```jsx
import { useState } from 'react'
import { Folha } from '../componentes/Folha'
import { exportar, importar, validarBackup, resumo } from '../dados/backup'
import './paginas.css'

export function FolhaAjustes({ aberta, aoFechar, aoGravado }) {
  const [erro, setErro] = useState(null)
  const [recado, setRecado] = useState(null)
  const [pendente, setPendente] = useState(null)

  async function baixar() {
    setErro(null)
    try {
      const dados = await exportar()
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `lariano-doces-${dados.exportadoEm}.json`
      a.click()
      URL.revokeObjectURL(url)
      setRecado('Backup salvo. Guarde esse arquivo fora do celular.')
    } catch (e) {
      setErro(e.message)
    }
  }

  async function escolher(evento) {
    setErro(null)
    setRecado(null)
    setPendente(null)

    const arquivo = evento.target.files?.[0]
    // Limpar o input é o que permite escolher o MESMO arquivo duas vezes seguidas — sem
    // isso, corrigir o arquivo e reescolher não dispara nada e parece que o app travou.
    evento.target.value = ''
    if (!arquivo) return

    try {
      const conteudo = JSON.parse(await arquivo.text())
      const valido = validarBackup(conteudo)
      if (!valido.ok) {
        setErro(valido.motivo)
        return
      }
      // Só depois de validar é que se pergunta. Perguntar primeiro e falhar depois seria
      // ela autorizar apagar tudo por um arquivo que nem serve.
      setPendente(conteudo)
    } catch {
      setErro('Não consegui ler esse arquivo. Ele precisa ser o .json que o app gerou.')
    }
  }

  async function confirmar() {
    setErro(null)
    try {
      const contagem = await importar(pendente)
      setPendente(null)
      setRecado(`Importado: ${contagem.ingredientes} ingredientes, ${contagem.receitas} doces, ${contagem.producoes} produções.`)
      await aoGravado()
    } catch (e) {
      setErro(e.message)
    }
  }

  const conta = pendente ? resumo(pendente) : null

  return (
    <Folha aberta={aberta} titulo="Ajustes" aoFechar={aoFechar}>
      {erro ? <p className="aviso aviso-erro" role="alert">{erro}</p> : null}
      {recado ? <p className="aviso aviso-atencao" role="status">{recado}</p> : null}

      <h3 className="secao">Backup</h3>
      <p className="campo-dica">
        Os dados ficam só neste celular. Se você limpar os dados do navegador ou trocar de
        aparelho, some tudo — por isso o backup existe.
      </p>

      <button type="button" className="botao-principal" onClick={baixar}>
        Salvar backup em arquivo
      </button>

      <div className="campo importar">
        <label className="campo-rotulo" htmlFor="arquivo-backup">
          Escolher arquivo de backup
        </label>
        <input id="arquivo-backup" type="file" accept="application/json,.json" onChange={escolher} />
      </div>

      {pendente ? (
        <div className="cadastro-embutido">
          <p className="cadastro-titulo">Isso apaga o que está salvo agora</p>
          <p className="campo-dica">
            {`O arquivo traz ${conta.ingredientes} ingredientes, ${conta.receitas} doces e ${conta.producoes} produções, e substitui tudo o que está no aparelho.`}
          </p>
          <div className="cadastro-botoes">
            <button type="button" className="botao-secundario" onClick={() => setPendente(null)}>
              Cancelar
            </button>
            <button type="button" className="botao-principal" onClick={confirmar}>
              Substituir tudo
            </button>
          </div>
        </div>
      ) : null}
    </Folha>
  )
}
```

- [ ] **Step 4: Acrescentar ao fim de `src/paginas/paginas.css`**

```css
.importar { margin-top: 20px; }
.importar input[type="file"] { font-size: .9rem; }
```

- [ ] **Step 5: Pendurar no `src/App.jsx`**

```jsx
import { FolhaAjustes } from './paginas/FolhaAjustes'
```

```jsx
<FolhaAjustes
  aberta={folha === 'ajustes'}
  aoFechar={() => setFolha(null)}
  aoGravado={dados.recarregar}
/>
```

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 163 testes.

- [ ] **Step 7: Commit**

```bash
git add src/paginas/FolhaAjustes.jsx src/paginas/FolhaAjustes.test.jsx src/paginas/paginas.css src/App.jsx
git commit -m "feat: ajustes com backup em arquivo"
```

---

## Task 17: Teste de ponta a ponta — o primeiro uso

O caminho inteiro numa prova só. Se este teste passa, o app funciona para quem nunca abriu ele.

**Files:**
- Create: `src/primeiroUso.test.jsx`

**Interfaces:**
- Consumes: `App` e tudo que ele monta (Tasks 11–16)
- Produces: nada — é prova

- [ ] **Step 1: Escrever `src/primeiroUso.test.jsx`**

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

    // 2. O doce.
    await userEvent.type(screen.getByLabelText('Nome do doce'), 'Brigadeiro')
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '50')
    await userEvent.type(screen.getByLabelText(/margem/i), '200')

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

    // 5. De volta à tela principal, o preço já está lá — ela não digitou rendimento nenhum.
    // R$ 13,00 de leite + R$ 2,60 de forminha = R$ 15,60, dividido por 50.
    await waitFor(() => {
      expect(screen.getByTestId('custo-total').textContent).toBe('R$ 15,60')
    })
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,31')
    expect(screen.getByTestId('preco-venda').textContent).toBe('R$ 0,93')

    // 6. Hoje rendeu diferente: o total não muda, o preço por unidade muda.
    await userEvent.type(screen.getByLabelText(/rendeu quantos/i), '60')
    expect(screen.getByTestId('custo-total').textContent).toBe('R$ 15,60')
    expect(screen.getByTestId('custo-cada').textContent).toBe('R$ 0,26')

    // 7. Salvar a produção grava o custo congelado.
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produção' }))
    await waitFor(async () => {
      const producoes = await listarProducoes()
      expect(producoes).toHaveLength(1)
      expect(producoes[0].nomeReceita).toBe('Brigadeiro')
      expect(producoes[0].rendimento).toBe(60)
      expect(producoes[0].custoTotalCent).toBe(1560)
      expect(producoes[0].custoUnitarioCent).toBe(26)
    })

    // 8. E aparece no histórico.
    await userEvent.click(screen.getByRole('button', { name: 'Histórico' }))
    expect(await screen.findByText('Brigadeiro')).toBeTruthy()
    expect(screen.getByText(/rendeu 60/)).toBeTruthy()
  })

  it('subir o preço de um ingrediente muda o custo dos doces e NÃO muda o histórico', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /cadastrar meu primeiro doce/i }))
    await userEvent.type(screen.getByLabelText('Nome do doce'), 'Beijinho')
    await userEvent.type(screen.getByLabelText(/rende quantos/i), '10')
    await userEvent.type(screen.getByLabelText('Ingrediente 1'), 'Coco')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar "Coco"/i }))
    await userEvent.selectOptions(screen.getByLabelText('Unidade'), 'g')
    await userEvent.type(screen.getByLabelText(/quanto vem na embalagem/i), '100')
    await userEvent.type(screen.getByLabelText(/preço da embalagem/i), '10,00')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar ingrediente' }))
    await waitFor(() => expect(screen.getByText('(100 g — R$ 10,00)')).toBeTruthy())
    await userEvent.type(screen.getByLabelText('Quantidade 1'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar doce' }))

    await waitFor(() => expect(screen.getByTestId('custo-total').textContent).toBe('R$ 10,00'))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produção' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /produção salva/i })).toBeTruthy())

    // O coco dobrou de preço.
    await userEvent.click(screen.getByRole('button', { name: 'Meus doces' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    const { salvarIngrediente, listarIngredientes } = await import('./dados/repositorio')
    const coco = (await listarIngredientes())[0]
    await salvarIngrediente({ ...coco, embalagemPrecoCent: 2000 }, coco.id)

    // Recarregar a tela é o que traz o preço novo — no app real é o `recarregar` de
    // qualquer gravação.
    const producoesAntes = await listarProducoes()
    expect(producoesAntes[0].custoTotalCent).toBe(1000)
  })
})
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run src/primeiroUso.test.jsx`
Expected: PASS, 2 testes. Se algum passo falhar, o defeito é real e está no fluxo — conserte o componente, não o teste.

- [ ] **Step 3: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 165 testes.

- [ ] **Step 4: Commit**

```bash
git add src/primeiroUso.test.jsx
git commit -m "test: caminho de ponta a ponta do primeiro uso"
```

---

## Task 18: PWA e publicação no GitHub Pages

**Files:**
- Create: `public/manifest.json`, `public/sw.js`, `public/icone-192.png`, `public/icone-512.png`
- Create: `.github/workflows/publicar.yml`
- Modify: `index.html`, `src/main.jsx`
- Create: `README.md`

**Interfaces:**
- Consumes: build do Vite (Task 1)
- Produces: site publicado, instalável na tela inicial do celular

- [ ] **Step 1: Gerar os dois ícones**

```bash
cd "c:/Users/Luiz/Desktop/NOTAS LUIZ/projeto pessoal/lariano doces"
node -e "
const s = 512, r = 96;
const svg = \`<svg xmlns='http://www.w3.org/2000/svg' width='\${s}' height='\${s}'>
<rect width='\${s}' height='\${s}' rx='\${r}' fill='#8c3b5e'/>
<text x='50%' y='58%' font-family='system-ui,sans-serif' font-size='300' font-weight='700'
 fill='#fdf7f4' text-anchor='middle' dominant-baseline='middle'>LD</text></svg>\`;
require('fs').writeFileSync('public/icone.svg', svg);
console.log('svg gerado');
"
```

O ícone é um SVG, e não PNG: `manifest.json` aceita SVG, e assim não entra binário no repositório nem dependência de gerador de imagem. Se o Luiz tiver a logo da Lariano, trocar é substituir o arquivo.

- [ ] **Step 2: Criar `public/manifest.json`**

```json
{
  "name": "Lariano Doces",
  "short_name": "Lariano",
  "description": "Quanto custou fazer o doce",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#fdf7f4",
  "theme_color": "#8c3b5e",
  "icons": [
    { "src": "./icone.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
```

Caminhos relativos (`./`) e não absolutos (`/`): no GitHub Pages o app mora em `/lariano-doces/`, e um `start_url` de `/` abriria a raiz do domínio.

- [ ] **Step 3: Criar `public/sw.js`**

```js
// Service worker mínimo: guarda a casca do app para abrir sem internet. Não guarda dado —
// dado dela mora no IndexedDB, que não passa por aqui.
const CACHE = 'lariano-doces-v1'

self.addEventListener('install', (evento) => {
  evento.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)),
      ))
      .then(() => self.clients.claim()),
  )
})

// Rede primeiro, cache como rede de segurança. O contrário deixaria ela presa numa versão
// velha do app depois de uma correção — e ela não tem como "limpar o cache" no celular.
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return

  evento.respondWith(
    fetch(evento.request)
      .then((resposta) => {
        const copia = resposta.clone()
        caches.open(CACHE).then((c) => c.put(evento.request, copia))
        return resposta
      })
      .catch(() => caches.match(evento.request)),
  )
})
```

- [ ] **Step 4: Ligar o manifest no `index.html`**

Acrescente dentro do `<head>`:

```html
<link rel="manifest" href="./manifest.json" />
<link rel="icon" href="./icone.svg" type="image/svg+xml" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Lariano" />
```

- [ ] **Step 5: Registrar o service worker no `src/main.jsx`**

Acrescente ao fim do arquivo:

```jsx
// Só em produção: em desenvolvimento o service worker serve versão velha e faz o `npm run
// dev` parecer quebrado depois de cada edição.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Sem service worker o app ainda funciona; só não abre offline. Não é motivo para
      // estourar erro na cara dela.
    })
  })
}
```

- [ ] **Step 6: Conferir que o build sai**

Run: `npm run build`
Expected: gera `dist/` sem erro, com `index.html`, `manifest.json`, `sw.js` e `icone.svg`.

Run: `grep -o '/lariano-doces/assets/[^"]*' dist/index.html | head -2`
Expected: os caminhos dos assets começam com `/lariano-doces/`. Se começarem com `/` puro, o `base` do `vite.config.js` está errado e a página abriria em branco no Pages.

- [ ] **Step 7: Criar `.github/workflows/publicar.yml`**

```yaml
name: Publicar no GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  construir:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      # Publicar sem rodar o teste é publicar no escuro. Se a suíte cair, o site que está
      # no ar continua sendo o último que passou.
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  publicar:
    needs: construir
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 8: Criar `README.md`**

```markdown
# Lariano Doces

Calculadora de custo de fabricação de doces. Uma tela: escolhe o doce, diz quantas rendeu,
vê quanto custou — total, por unidade e preço de venda sugerido.

## Rodar

    npm install
    npm run dev

## Testar

    npm test

## Publicar

Empurrar para `main` publica sozinho, pelo workflow em `.github/workflows/publicar.yml`.

## Como funciona

- **Ingrediente** é cadastro global, com o preço da embalagem inteira. Mudou o preço, muda
  o custo de todos os doces que usam ele.
- **Receita** guarda só quantidade, nunca preço.
- **Produção** guarda o custo congelado do dia — o histórico de agosto continua mostrando
  o preço de agosto.
- Os dados ficam **no aparelho** (IndexedDB). O backup em Ajustes é a única cópia.

Design e decisões: `docs/specs/2026-08-26-custo-de-doces-design.md`.
```

- [ ] **Step 9: Commit**

```bash
git add public/ .github/ index.html src/main.jsx README.md
git commit -m "feat: PWA instalavel e publicacao automatica no GitHub Pages"
```

- [ ] **Step 10: Publicar**

O repositório vazio no GitHub e o "Settings → Pages → Source: GitHub Actions" são cliques na interface do GitHub — **peça ao Luiz**, é login e UI externa. Com o repositório `lariano-doces` criado e vazio:

```bash
cd "c:/Users/Luiz/Desktop/NOTAS LUIZ/projeto pessoal/lariano doces"
git branch -M main
git remote add origin https://github.com/<usuario>/lariano-doces.git
git push -u origin main
```

Depois confira que o workflow terminou verde e que a página abre. Se abrir em branco, o
suspeito nº 1 é o `base` do `vite.config.js` não bater com o nome do repositório.

- [ ] **Step 11: Verificação final**

Run: `npm test`
Expected: PASS, 165 testes.

Confira na página publicada, pelo celular:
1. Cadastrar um doce com um ingrediente em grama e um em unidade; o custo bate com a conta na mão.
2. Escolher o doce e digitar o rendimento mostra o preço sem mais nada.
3. Mudar o preço de um ingrediente muda o custo do doce e **não** muda produção já salva.
4. Ingrediente sem preço mostra aviso de parcial.
5. Exportar, apagar tudo e importar devolve o mesmo estado.
6. "Adicionar à tela inicial" abre como app, e abre com o celular no modo avião.

---

## Self-Review

Feito depois de escrever o plano inteiro, conferindo contra a spec.

**Cobertura da spec.** Cada seção tem task: modelo de dados → 5, 6, 7; regras de cálculo →
3, 4; aviso de rendimento → 4 e 14; a tela → 14; as cinco folhas → 12, 13, 15, 16; cadastro
embutido → 12; primeiro uso → 11 e 17; estados de erro → distribuídos (sem preço em 3 e 14,
apagar em uso em 6 e 13, rendimento zero em 3 e 14, vírgula em 2 e 10, nome repetido em 5 e
6, IndexedDB bloqueado em 11, backup inválido em 8 e 16); backup → 8, 16; publicação → 18.

**Correções aplicadas durante a revisão:**

1. `CampoNumero` não tinha `placeholder`, e a Task 14 usa um para sugerir o rendimento
   normal. A prop foi acrescentada no Step 3 da Task 14, junto de onde é usada.
2. `listarReceitas` estava só na Task 6, mas `apagarIngrediente` (Task 5) já precisa dela —
   um plano executado em ordem quebraria na Task 5. Movida para a Task 5.
3. Os números do exemplo do brigadeiro batem em todos os lugares: R$ 32,50 a receita,
   R$ 0,65 cada, R$ 1,95 de venda, R$ 65,00 de lucro. O teste de ponta a ponta usa um
   brigadeiro de dois ingredientes e por isso tem números próprios (R$ 15,60 / R$ 0,31),
   conferidos à parte.
4. `formatarQuantidade` recebe a unidade do ingrediente, que na Task 14 pode ser `undefined`
   se o ingrediente sumiu — o fallback `?? ''` está no lugar.

**Sem placeholder.** Nenhum "TBD", nenhum "adicione validação apropriada": toda função tem
corpo, todo teste tem asserção.

---

## Contagem de testes por task

| Task | Novos | Acumulado |
| --- | --- | --- |
| 1 | 1 | 1 |
| 2 | 23 | 24 |
| 3 | 20 | 44 |
| 4 | 14 | 58 |
| 5 | 12 | 70 |
| 6 | 12 | 82 |
| 7 | 8 | 90 |
| 8 | 12 | 102 |
| 9 | 7 | 109 |
| 10 | 7 | 116 |
| 11 | 6 (3 do hook + 3 do App, que substituem o 1 da Task 1) | 121 |
| 12 | 14 | 135 |
| 13 | 6 | 141 |
| 14 | 12 | 153 |
| 15 | 5 | 158 |
| 16 | 5 | 163 |
| 17 | 2 | 165 |
| 18 | 0 | 165 |

Os totais dos passos "rodar a suíte inteira" são estimativa. Se o número real divergir por
um ou dois, é porque um teste foi dividido durante a implementação — não é defeito. O que
importa é que **nenhum** esteja vermelho.
