# Lariando Doces

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
