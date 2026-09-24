// Única porta para o backend: tudo passa por /api (proxy do Vite).

export class ErroApi extends Error {
  status: number
  campo: string | null

  constructor(mensagem: string, status: number, campo: string | null = null) {
    super(mensagem)
    this.status = status
    this.campo = campo
  }
}

export async function pedir<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(`/api${caminho}`, opcoes)
  } catch {
    throw new ErroApi('Não foi possível falar com o backend. Ele está rodando?', 0)
  }

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null)
    const mensagem =
      corpo && typeof corpo.erro === 'string'
        ? corpo.erro
        : 'Não foi possível falar com o backend. Ele está rodando?'
    const campo = corpo && typeof corpo.campo === 'string' ? corpo.campo : null
    throw new ErroApi(mensagem, resposta.status, campo)
  }

  return resposta.json() as Promise<T>
}

// Para DELETE: o backend responde 204, sem corpo.
export async function apagarNaApi(caminho: string): Promise<void> {
  let resposta: Response
  try {
    resposta = await fetch(`/api${caminho}`, { method: 'DELETE' })
  } catch {
    throw new ErroApi('Não foi possível falar com o backend. Ele está rodando?', 0)
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null)
    throw new ErroApi(corpo?.erro ?? 'Não foi possível apagar.', resposta.status)
  }
}
