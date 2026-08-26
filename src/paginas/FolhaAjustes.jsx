import { useState } from 'react'
import { Folha } from '../componentes/Folha'
import { exportar, importar, validarBackup, resumo } from '../dados/backup'
import './paginas.css'

export function FolhaAjustes({ aberta, aoFechar, aoGravado }) {
  const [erro, setErro] = useState(null)
  const [recado, setRecado] = useState(null)
  const [pendente, setPendente] = useState(null)
  // Cobre tanto exportar quanto importar: os dois mexem nas gavetas em algum grau, e um
  // clique duplo em qualquer um deles enquanto o outro está em voo é a mesma classe de
  // problema — por isso um único booleano trava os três botões e o input de arquivo.
  const [salvando, setSalvando] = useState(false)

  async function baixar() {
    setErro(null)
    setSalvando(true)
    try {
      const dados = await exportar()
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `lariando-doces-${dados.exportadoEm}.json`
      a.click()
      URL.revokeObjectURL(url)
      setRecado('Backup salvo. Guarde esse arquivo fora do celular.')
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
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
    setSalvando(true)
    try {
      const contagem = await importar(pendente)
      setPendente(null)
      setRecado(`Importado: ${contagem.ingredientes} ingredientes, ${contagem.receitas} doces, ${contagem.producoes} produções.`)
      await aoGravado()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
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

      <button type="button" className="botao-principal" onClick={baixar} disabled={salvando}>
        Salvar backup em arquivo
      </button>

      <div className="campo importar">
        <label className="campo-rotulo" htmlFor="arquivo-backup">
          Escolher arquivo de backup
        </label>
        <input
          id="arquivo-backup"
          type="file"
          accept="application/json,.json"
          onChange={escolher}
          disabled={salvando}
        />
      </div>

      {pendente ? (
        <div className="cadastro-embutido">
          <p className="cadastro-titulo">Isso apaga o que está salvo agora</p>
          <p className="campo-dica">
            {`O arquivo traz ${conta.ingredientes} ingredientes, ${conta.receitas} doces e ${conta.producoes} produções, e substitui tudo o que está no aparelho.`}
          </p>
          <div className="cadastro-botoes">
            <button
              type="button"
              className="botao-secundario"
              onClick={() => setPendente(null)}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button type="button" className="botao-principal" onClick={confirmar} disabled={salvando}>
              Substituir tudo
            </button>
          </div>
        </div>
      ) : null}
    </Folha>
  )
}
