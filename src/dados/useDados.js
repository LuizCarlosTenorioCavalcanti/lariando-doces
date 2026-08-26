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
