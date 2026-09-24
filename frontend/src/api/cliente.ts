// Única porta para o backend: tudo passa por /api (proxy do Vite).
import { chamar, erroDaResposta } from '../utils/erros'

export { ErroApi } from '../utils/erros'

export async function pedir<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await chamar(`/api${caminho}`, opcoes)
  if (!resposta.ok) throw await erroDaResposta(resposta, 'O backend não conseguiu fazer isso agora. Tente de novo.')
  return resposta.json() as Promise<T>
}

// Para DELETE: o backend responde 204, sem corpo.
export async function apagarNaApi(caminho: string): Promise<void> {
  const resposta = await chamar(`/api${caminho}`, { method: 'DELETE' })
  if (!resposta.ok) throw await erroDaResposta(resposta, 'Não foi possível apagar.')
}
