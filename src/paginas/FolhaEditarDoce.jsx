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

  // O cadastro embutido devolve o ingrediente recém-criado direto para cá. Esperar a volta
  // de `aoGravado` (que em produção recarrega `ingredientes` lá em cima) deixaria a linha
  // muda por um instante — e em teste sem recarga real, para sempre. Guardar o registro
  // aqui é o que faz "usa ele na linha" acontecer sem depender do pai.
  const [criadosAgora, setCriadosAgora] = useState([])

  // Chave da linha que acabou de ganhar um ingrediente pelo cadastro embutido: é só nela
  // que a Quantidade recebe foco automático ao nascer. Sem essa distinção, digitar um
  // nome já cadastrado (ex.: "toddy" letra a letra) também roubaria o foco no meio da
  // digitação, quebrando o que ela está escrevendo no campo de nome.
  const [focoAposCriar, setFocoAposCriar] = useState(null)

  const porNome = useMemo(() => {
    const mapa = Object.fromEntries(
      ingredientes.map((i) => [i.nomeNormalizado ?? normalizar(i.nome), i]),
    )
    for (const i of criadosAgora) mapa[i.nomeNormalizado ?? normalizar(i.nome)] = i
    return mapa
  }, [ingredientes, criadosAgora])

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
                  autoFocus={focoAposCriar === linha.chave}
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
                aoCriar={async (novoIngrediente) => {
                  setCadastrando(null)
                  setCriadosAgora((atuais) => [...atuais, novoIngrediente])
                  setFocoAposCriar(linha.chave)
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
  const [salvando, setSalvando] = useState(false)

  async function criar() {
    setErro(null)
    setSalvando(true)
    try {
      const registro = await salvarIngrediente({
        nome,
        unidade,
        embalagemQtd: paraNumero(embalagemQtd),
        embalagemPrecoCent: preco.trim() === '' ? null : paraCentavos(preco),
      })
      await aoCriar(registro)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
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
        <button type="button" className="botao-secundario" onClick={aoCancelar} disabled={salvando}>
          Cancelar
        </button>
        <button type="button" className="botao-principal" onClick={criar} disabled={salvando}>
          Salvar ingrediente
        </button>
      </div>
    </div>
  )
}
