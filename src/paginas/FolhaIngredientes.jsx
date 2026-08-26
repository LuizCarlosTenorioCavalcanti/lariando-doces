import { useCallback, useMemo, useState } from 'react'
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

  // `Folha` guarda `aoFechar` em dependência de `useEffect`. Um callback inline aqui faria
  // esse efeito re-rodar (e o listener de Escape ser trocado) a cada render desta folha.
  const fechar = useCallback(() => {
    setAbertoId(null)
    aoFechar()
  }, [aoFechar])

  return (
    <Folha aberta={aberta} titulo="Ingredientes" aoFechar={fechar}>
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
                aoGravado={aoGravado}
                aoConcluir={() => setAbertoId(null)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </Folha>
  )
}

function EditarPreco({ ingrediente, aoGravado, aoConcluir }) {
  const [preco, setPreco] = useState(
    ingrediente.embalagemPrecoCent === null
      ? ''
      : (ingrediente.embalagemPrecoCent / 100).toFixed(2).replace('.', ','),
  )
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  // Sem `finally`: no caminho de sucesso o `aoConcluir()` fecha este formulário (o pai
  // deixa de renderizar `EditarPreco`), e chamar `setSalvando(false)` depois disso seria
  // atualizar estado de um componente já desmontado. `setSalvando(false)` só roda no
  // `catch`, onde o formulário continua aberto para mostrar o erro — mesmo padrão do
  // `CadastroEmbutido` em FolhaEditarDoce.jsx.
  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      await salvarIngrediente(
        { ...ingrediente, embalagemPrecoCent: preco.trim() === '' ? null : paraCentavos(preco) },
        ingrediente.id,
      )
      await aoGravado()
      aoConcluir()
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  async function apagar() {
    setErro(null)
    setSalvando(true)
    try {
      await apagarIngrediente(ingrediente.id)
      await aoGravado()
      aoConcluir()
    } catch (e) {
      // O repositório devolve a frase pronta com o nome dos doces. Repetir ela aqui é o
      // que transforma "não deu" em "está no Brigadeiro, tire de lá primeiro".
      setErro(e.message)
      setSalvando(false)
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
        <button type="button" className="botao-secundario" onClick={apagar} disabled={salvando}>
          Apagar
        </button>
        <button type="button" className="botao-principal" onClick={salvar} disabled={salvando}>
          Salvar preço
        </button>
      </div>
    </div>
  )
}
