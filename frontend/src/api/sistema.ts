import { useQuery } from '@tanstack/react-query'
import { pedir } from './cliente'

export type Status = {
  chave_configurada: boolean
  chave_valida: boolean
  catalogo_atualizado_em: string | null
}

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    meta: { erroNaTela: true },
    queryFn: () => pedir<Status>('/status'),
    retry: false,
  })
}
