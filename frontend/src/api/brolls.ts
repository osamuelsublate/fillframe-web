import { useQuery } from '@tanstack/react-query'
import { pedir } from './cliente'
import type { Broll } from './criacoes'
import type { TipoMidia } from './modelos'

export type ItemGaleria = Broll & {
  criacao_id: string
  raiz_id: string
  numero_versao: number
  tipo: TipoMidia
  orientacao: 'vertical' | 'horizontal'
  proporcao: string | null
  modelo: string
  prompt: string
  sessao_id: string
  sessao_nome: string
}

export type FiltrosGaleria = {
  sessaoId: string | null // null: todas as sessões
  tipo: TipoMidia | null
  orientacao: 'vertical' | 'horizontal' | null
}

// `atualizacao` muda quando a sessão ganha brolls novos, para a Galeria recarregar sozinha.
export function useGaleria(filtros: FiltrosGaleria, atualizacao: string) {
  return useQuery({
    queryKey: ['galeria', filtros, atualizacao],
    meta: { erroNaTela: true },
    queryFn: () => {
      const parametros = new URLSearchParams()
      if (filtros.sessaoId) parametros.set('sessao_id', filtros.sessaoId)
      if (filtros.tipo) parametros.set('tipo', filtros.tipo)
      if (filtros.orientacao) parametros.set('orientacao', filtros.orientacao)
      const busca = parametros.toString()
      return pedir<ItemGaleria[]>(`/brolls${busca ? `?${busca}` : ''}`)
    },
    placeholderData: (anteriores) => anteriores,
  })
}
