import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pedir } from './cliente'

export type TipoMidia = 'imagem' | 'video'

export type ResumoPreco = {
  valor_min: number
  valor_max: number
  unidade: string
}

export type ModeloMidia = {
  id: string
  nome: string
  descricao: string
  capacidades: {
    proporcoes: string[]
    resolucoes: string[]
    duracoes: number[]
    tamanhos: string[]
    aceita_referencia: boolean | null
    min_referencias: number
    max_referencias: number | null
    aceita_primeiro_quadro: boolean
    aceita_ultimo_quadro: boolean
    gera_audio: boolean
    max_imagens: number | null
  }
  precos: { resumo: ResumoPreco | null }
  tempo_medio_segundos: number | null
}

export function useModelos(tipo: TipoMidia, busca: string) {
  return useQuery({
    queryKey: ['modelos', tipo, busca],
    queryFn: () => {
      const parametros = busca.trim() ? `?busca=${encodeURIComponent(busca.trim())}` : ''
      return pedir<ModeloMidia[]>(`/modelos/${tipo}${parametros}`)
    },
    // Enquanto a busca carrega, mantém a lista do mesmo tipo (nunca mostra vídeos na aba de imagem).
    placeholderData: (anteriores, consultaAnterior) =>
      consultaAnterior?.queryKey[1] === tipo ? anteriores : undefined,
    // Na primeira vez o backend ainda está buscando o catálogo: tenta de novo até chegar.
    refetchInterval: (consulta) =>
      consulta.state.data?.length === 0 && !busca.trim() ? 3000 : false,
  })
}

export function useAtualizarModelos() {
  const clienteQuery = useQueryClient()
  return useMutation({
    mutationFn: () => pedir<{ atualizado_em: string | null }>('/modelos/atualizar', { method: 'POST' }),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['modelos'] })
      clienteQuery.invalidateQueries({ queryKey: ['status'] })
    },
  })
}
