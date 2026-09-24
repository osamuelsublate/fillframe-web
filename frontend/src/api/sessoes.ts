import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pedir } from './cliente'
import type { Criacao } from './criacoes'
import type { Referencia } from './referencias'

export type SessaoResumo = {
  id: string
  nome: string
  llm: string
  ultimo_uso_em: string
}

export type Mensagem = {
  id: string
  autor: 'usuario' | 'llm' | 'tool'
  texto: string | null
  audio_referencia_id: string | null
  transcricao: string | null
  chamadas_de_tool: ChamadaTool[] | null
  criada_em: string
}

// Uma tool que a LLM usou. `acao` e `criacao_id` só existem quando ela preparou ou ajustou um rascunho.
export type ChamadaTool = {
  id: string
  nome: string
  acao?: 'criacao_preparada' | 'criacao_ajustada'
  criacao_id?: string
  prompt?: string
}

export type SessaoCompleta = SessaoResumo & {
  criada_em: string
  mensagens: Mensagem[]
  criacoes: Criacao[]
  referencias: Referencia[]
}

export function useSessoes() {
  return useQuery({
    queryKey: ['sessoes'],
    queryFn: () => pedir<SessaoResumo[]>('/sessoes'),
  })
}

export function useSessao(id: string | null) {
  return useQuery({
    queryKey: ['sessoes', id],
    queryFn: () => pedir<SessaoCompleta>(`/sessoes/${encodeURIComponent(id!)}`),
    enabled: id !== null,
    retry: false,
    // Enquanto alguma criação está gerando, consulta o andamento a cada 2 s.
    refetchInterval: (consulta) =>
      consulta.state.data?.criacoes.some((c) => c.situacao === 'gerando') ? 2000 : false,
  })
}

export function useCriarSessao() {
  const clienteQuery = useQueryClient()
  return useMutation({
    mutationFn: (dados: { nome?: string; llm?: string } = {}) =>
      pedir<SessaoCompleta>('/sessoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      }),
    onSuccess: (sessao) => {
      clienteQuery.setQueryData(['sessoes', sessao.id], sessao)
      clienteQuery.invalidateQueries({ queryKey: ['sessoes'], exact: true })
    },
  })
}

export function useAlterarSessao(id: string) {
  const clienteQuery = useQueryClient()
  return useMutation({
    mutationFn: (dados: { nome?: string; llm?: string }) =>
      pedir<SessaoResumo>(`/sessoes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['sessoes'] }),
  })
}
