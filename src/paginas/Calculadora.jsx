import { useCallback, useMemo, useState } from 'react'
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
  const [salvando, setSalvando] = useState(false)

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

  const aoMudarDoce = useCallback((e) => {
    setReceitaId(e.target.value)
    setRendimento('')
    setSalvo(false)
  }, [])

  const aoMudarRendimento = useCallback((v) => {
    setRendimento(v)
    setSalvo(false)
  }, [])

  const aoMudarReceitasFeitas = useCallback((v) => {
    setReceitasFeitas(v)
    setSalvo(false)
  }, [])

  const abrirCampoReceitas = useCallback(() => setMostrarReceitas(true), [])
  const alternarDetalhe = useCallback(() => setMostrarDetalhe((v) => !v), [])

  const gravar = useCallback(async () => {
    if (salvando) return
    setErro(null)
    setSalvando(true)
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
    } finally {
      setSalvando(false)
    }
  }, [salvando, receita, receitasFeitas, rendimentoEfetivo, conta, aoGravado])

  if (!receita) return null

  return (
    <section className="calc">
      <div className="campo">
        <label className="campo-rotulo" htmlFor="calc-doce">O que você fez?</label>
        <div className="campo-caixa">
          <select
            id="calc-doce"
            value={receita.id}
            onChange={aoMudarDoce}
          >
            {receitas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
      </div>

      <CampoNumero
        id="calc-rendimento"
        rotulo="Rendeu quantos?"
        valor={rendimento}
        aoMudar={aoMudarRendimento}
        placeholder={String(receita.rendimentoBase)}
      />

      {mostrarReceitas ? (
        <CampoNumero
          id="calc-receitas"
          rotulo="Quantas receitas você fez?"
          valor={receitasFeitas}
          aoMudar={aoMudarReceitasFeitas}
          dica="Uma receita e meia é 1,5. Isso muda o quanto de ingrediente saiu do armário."
        />
      ) : (
        <button type="button" className="chip" onClick={abrirCampoReceitas}>
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
        onClick={alternarDetalhe}
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
        disabled={conta.custoTotalCent === null || salvo || salvando}
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
