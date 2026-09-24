import { useMutation, useQueryClient } from '@tanstack/react-query'
import { chamar, erroDaResposta } from '../utils/erros'
import { apagarNaApi, pedir } from './cliente'

export type Referencia = {
  id: string
  tipo: 'imagem' | 'texto' | 'audio'
  origem: 'anexada' | 'gerada'
  broll_origem_id: string | null
  mensagem_id: string | null
  nome_original: string | null
  formato: string
  tamanho_bytes: number
  criada_em: string
  url: string
}

// Os mesmos tipos que o backend aceita (ele confere pelo conteúdo; isto só ajuda a janela de escolher arquivo).
export const ACEITOS =
  'image/png,image/jpeg,image/webp,.txt,.md,.markdown,.json,.csv,.yaml,.yml,.toml,.xml,.html,.css,.py,.js,.jsx,.ts,.tsx,.sql,.sh,.java,.go,.rs,.rb,.php,.c,.h,.cpp,.cs,.kt,.swift,.vue,.svelte,.ipynb'

// Envia um arquivo para a sessão. O backend valida o tipo e o tamanho.
export async function enviarReferencia(sessaoId: string, arquivo: File): Promise<Referencia> {
  const formulario = new FormData()
  formulario.append('arquivo', arquivo)
  const resposta = await chamar(`/api/sessoes/${encodeURIComponent(sessaoId)}/referencias`, {
    method: 'POST',
    body: formulario,
  })
  if (!resposta.ok) throw await erroDaResposta(resposta, 'Não foi possível enviar o arquivo.')
  return (await resposta.json()) as Referencia
}

// Transforma uma imagem gerada em referência da sessão (o backend guarda uma cópia do arquivo).
export function useReferenciaDeBroll(sessaoId: string) {
  const clienteQuery = useQueryClient()
  return useMutation({
    mutationFn: (brollId: string) =>
      pedir<Referencia>(`/sessoes/${encodeURIComponent(sessaoId)}/referencias/de-broll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broll_id: brollId }),
      }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessaoId] }),
  })
}

// Remove uma referência da sessão (o backend recusa se ela foi usada numa criação).
export function useApagarReferencia(sessaoId: string) {
  const clienteQuery = useQueryClient()
  return useMutation({
    meta: { erroNaTela: true },
    mutationFn: (referenciaId: string) =>
      apagarNaApi(`/sessoes/${encodeURIComponent(sessaoId)}/referencias/${encodeURIComponent(referenciaId)}`),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessaoId] }),
  })
}
