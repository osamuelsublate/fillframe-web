import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pedir } from './cliente'
import type { TipoMidia } from './modelos'

export type Orientacao = 'vertical' | 'horizontal'
export type Situacao = 'rascunho' | 'gerando' | 'pronto' | 'falhou' | 'apagado'

export type Broll = {
  id: string
  indice: number
  formato: string
  largura: number | null
  altura: number | null
  duracao_segundos: number | null
  tamanho_bytes: number
  criado_em: string
  url: string
  url_miniatura: string
}

export type Criacao = {
  id: string
  sessao_id: string
  versao_de_id: string | null
  raiz_id: string
  numero_versao: number
  tipo: TipoMidia
  modelo: string
  prompt: string
  orientacao: Orientacao
  proporcao: string | null
  duracao_segundos: number | null
  resolucao: string | null
  parametros_extras: Record<string, unknown> | null
  situacao: Situacao
  erro: string | null
  estimativa_segundos: number | null
  iniciada_em: string | null
  concluida_em: string | null
  tempo_gasto_segundos: number | null
  custo_usd: number | null
  criada_em: string
  brolls: Broll[]
}

export type ConfigCriacao = {
  tipo: TipoMidia
  modelo: string
  prompt: string
  orientacao: Orientacao
  resolucao: string | null
  duracao: number | null
  parametros_extras: Record<string, unknown> | null
}

// Cria um rascunho novo (sem id) ou altera um rascunho existente (com id).
export function useSalvarCriacao(sessaoId: string) {
  const clienteQuery = useQueryClient()
  return useMutation({
    mutationFn: ({ id, config }: { id: string | null; config: ConfigCriacao }) =>
      pedir<Criacao>(
        id
          ? `/sessoes/${encodeURIComponent(sessaoId)}/criacoes/${encodeURIComponent(id)}`
          : `/sessoes/${encodeURIComponent(sessaoId)}/criacoes`,
        {
          method: id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        },
      ),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessaoId] })
      clienteQuery.invalidateQueries({ queryKey: ['sessoes'], exact: true })
    },
  })
}

// Única forma de disparar uma geração: o clique da pessoa em Gerar.
export function useGerarCriacao(sessaoId: string) {
  const clienteQuery = useQueryClient()
  return useMutation({
    mutationFn: (criacaoId: string) =>
      pedir<Criacao>(
        `/sessoes/${encodeURIComponent(sessaoId)}/criacoes/${encodeURIComponent(criacaoId)}/gerar`,
        { method: 'POST' },
      ),
    onSettled: () => {
      clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessaoId] })
      clienteQuery.invalidateQueries({ queryKey: ['sessoes'], exact: true })
    },
  })
}
