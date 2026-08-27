import { useCallback, useMemo, useState } from 'react'
import { CampoNumero } from '../componentes/CampoNumero'
import { CampoMoeda } from '../componentes/CampoMoeda'
import {
  custoDaProducao, custoDoItem, precoSugerido, lucroDaProducao, rendimentoSuspeito,
  margemDoPreco, precoDoLucro,
} from '../motor/custo'
import { salvarProducao } from '../dados/repositorio'
import { paraNumero, paraCentavos, centavosParaCampo } from '../lib/numeroBR'
import { formatBRL, formatarQuantidade } from '../lib/formato'
import './calculadora.css'

export function Calculadora({
  receitas, ingredientesPorId, producoes, aoAbrirDoces, aoAbrirIngredientes, aoAbrirHistorico,
  aoGravado,
}) {
  const [receitaId, setReceitaId] = useState('')
  const [receitasFeitas, setReceitasFeitas] = useState('1')
  const [rendimento, setRendimento] = useState('')
  const [mostrarReceitas, setMostrarReceitas] = useState(false)
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false)
  const [erro, setErro] = useState(null)
  const [salvo, setSalvo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Uma linha por embalagem: 65 forminhas a R$ 0,05, 1 caixa a R$ 2,50. Texto, não número,
  // porque enquanto ela digita "2," o conteúdo não é número válido.
  const [linhasEmbalagem, setLinhasEmbalagem] = useState([
    { chave: 'emb_0', quantidade: '', preco: '' },
  ])

  // Derivar em vez de sincronizar por efeito: as receitas chegam do banco depois da
  // primeira renderização, e um efeito que "conserta" o id selecionado depois erra sempre
  // num caso — o de ela ter escolhido antes de os dados chegarem.
  const receita = receitas.find((r) => r.id === receitaId) ?? receitas[0] ?? null

  // Campo vazio usa o rendimento normal do doce. É isso que faz "escolheu, viu o preço"
  // ser verdade já na abertura, sem ela digitar nada.
  const rendimentoEfetivo = rendimento.trim() === ''
    ? receita?.rendimentoBase ?? null
    : paraNumero(rendimento)

  const embalagens = useMemo(
    () => linhasEmbalagem.map((l) => ({
      quantidade: l.quantidade.trim() === '' ? null : paraNumero(l.quantidade),
      precoUnitarioCent: l.preco.trim() === '' ? null : paraCentavos(l.preco),
    })),
    [linhasEmbalagem],
  )

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
    // Antes de ela digitar qualquer coisa, o ponto de partida é a margem cadastrada no
    // doce (v1). Sem margem cadastrada o bloco aparece vazio, esperando ela decidir.
    if (receita?.margemPct === null || receita?.margemPct === undefined) return null
    return precoSugerido(custoUnitarioCent, receita.margemPct)
  }, [editado, custoUnitarioCent, rendimentoEfetivo, receita])

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

  // "1," e "-" são textos INCOMPLETOS, não números errados: ela está no meio da digitação.
  // Alarmar aqui é a tela pulando sob o dedo dela, que é o defeito que estes três campos
  // existem para não ter. Só avisa quando dá para LER o número e ele é impossível.
  const digitouNumeroLegivel = editado.fonte === 'margem'
    ? paraNumero(editado.texto) !== null
    : paraCentavos(editado.texto) !== null

  const avisoVenda = precoCent === null && editado.fonte !== null && digitouNumeroLegivel
    ? (editado.fonte === 'margem'
      ? 'Margem de -100% ou menos deixaria o preço em zero ou negativo.'
      : 'Esse número deixaria o preço em zero ou negativo — confira o sinal.')
    : null

  const aoMudarVenda = useCallback((fonte, texto) => {
    setEditado({ fonte, texto })
    setSalvo(false)
  }, [])

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
        embalagens,
        precoVendaCent: precoCent,
      })
      setSalvo(true)
      await aoGravado()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }, [salvando, receita, receitasFeitas, rendimentoEfetivo, conta, embalagens, precoCent, aoGravado])

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

      <div className="resultado">
        <div className="resultado-linha">
          <span>Custou</span>
          <strong data-testid="custo-total">{formatBRL(conta.custoTotalCent)}</strong>
        </div>
        <div className="resultado-linha">
          <span>Cada</span>
          <strong data-testid="custo-cada">{formatBRL(conta.custoUnitarioCent)}</strong>
        </div>

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

            {avisoVenda ? (
              <p className="aviso aviso-atencao" role="status">{avisoVenda}</p>
            ) : null}
          </>
        ) : null}
      </div>

      {conta.parcial ? (
        <p className="aviso aviso-atencao" role="status">
          {conta.semPreco.length > 0
            ? `Parcial — falta o preço de ${conta.semPreco.join(', ')}.`
            : 'Parcial — falta o preço da embalagem.'}
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
          {receita.itens.map((item, indice) => {
            const ing = ingredientesPorId[item.ingredienteId]
            const custo = custoDoItem(item, ing)
            const cheio = ing
              ? `(${ing.embalagemQtd} ${ing.unidade} — ${formatBRL(ing.embalagemPrecoCent)})`
              : '(ingrediente apagado)'
            return (
              // `ingredienteId` pode se repetir na mesma receita (massa e cobertura usando
              // o mesmo item) — o índice é o que garante chave única nesse caso.
              <li key={`${item.ingredienteId}-${indice}`}>
                {`${ing?.nome ?? '?'} ${cheio} · usou ${formatarQuantidade(item.quantidade, ing?.unidade ?? '')} → ${formatBRL(custo === null ? null : Math.round(custo))}`}
              </li>
            )
          })}
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
        </ul>
      ) : null}

      {erro ? <p className="aviso aviso-erro" role="alert">{erro}</p> : null}

      <button
        type="button"
        className="botao-principal"
        onClick={gravar}
        disabled={conta.custoTotalCent === null || conta.custoUnitarioCent === null || salvo || salvando}
      >
        {salvo ? 'Produção salva ✓' : 'Salvar produção'}
      </button>

      <nav className="calc-rodape">
        <button type="button" className="calc-link" onClick={aoAbrirDoces}>Meus doces</button>
        <span aria-hidden="true">·</span>
        <button type="button" className="calc-link" onClick={aoAbrirIngredientes}>Ingredientes</button>
        <span aria-hidden="true">·</span>
        <button type="button" className="calc-link" onClick={aoAbrirHistorico}>Histórico</button>
      </nav>
    </section>
  )
}
