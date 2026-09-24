import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apagarNaApi, pedir } from './cliente'
import type { TipoMidia } from './modelos'
import type { SessaoCompleta } from './sessoes'

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

export type Papel = 'referencia' | 'primeiro_quadro' | 'ultimo_quadro'

export type ReferenciaUsada = { id: string; papel: Papel }

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
  referencias: ReferenciaUsada[]
}

export type ConfigCriacao = {
  tipo: TipoMidia
  modelo: string
  prompt: string
  orientacao: Orientacao
  resolucao: string | null
  duracao: number | null
  parametros_extras: Record<string, unknown> | null
  referencias: ReferenciaUsada[]
}

// Cria um rascunho novo (sem id) ou altera um rascunho existente (com id).
export function useSalvarCriacao(sessaoId: string) {
  const clienteQuery = useQueryClient()
  return useMutation({
    meta: { erroNaTela: true },
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
    meta: { erroNaTela: true },
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

// Nova versão (rascunho) a partir de qualquer versão. A versão de origem nunca muda.
export function useNovaVersao(sessaoId: string) {
  const clienteQuery = useQueryClient()
  return useMutation({
    meta: { erroNaTela: true },
    mutationFn: (criacaoId: string) =>
      pedir<Criacao>(
        `/sessoes/${encodeURIComponent(sessaoId)}/criacoes/${encodeURIComponent(criacaoId)}/versoes`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      ),
    onSuccess: (nova) => {
      // Já coloca a versão nova na sessão, para o editor abrir nela sem esperar a recarga.
      clienteQuery.setQueryData<SessaoCompleta>(['sessoes', sessaoId], (atual) =>
        atual ? { ...atual, criacoes: [nova, ...atual.criacoes] } : atual,
      )
      clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessaoId] })
    },
  })
}

// Apaga uma criação (versão). Com versões derivadas, ela fica "apagada" na árvore; sem, some de vez.
export function useApagarCriacao() {
  const clienteQuery = useQueryClient()
  return useMutation({
    meta: { erroNaTela: true },
    mutationFn: ({ sessaoId, criacaoId }: { sessaoId: string; criacaoId: string }) =>
      apagarNaApi(`/sessoes/${encodeURIComponent(sessaoId)}/criacoes/${encodeURIComponent(criacaoId)}`),
    onSuccess: (_, { sessaoId }) => {
      clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessaoId] })
      clienteQuery.invalidateQueries({ queryKey: ['galeria'] })
    },
  })
}
