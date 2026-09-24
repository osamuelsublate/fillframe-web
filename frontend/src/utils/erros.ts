// Erros das chamadas ao backend e avisos na tela, num lugar só.

export const BACKEND_FORA = 'O FillFrame não está respondendo. Confira se o terminal do backend está aberto.'

export class ErroApi extends Error {
  status: number
  campo: string | null

  constructor(mensagem: string, status: number, campo: string | null = null) {
    super(mensagem)
    this.status = status
    this.campo = campo
  }
}

// Faz a chamada; se nem chegar ao backend (desligado, sem rede), vira o erro "não está respondendo".
export async function chamar(url: string, opcoes?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, opcoes)
  } catch {
    throw new ErroApi(BACKEND_FORA, 0)
  }
}

// Lê o `{erro, campo}` do backend. Sem esse corpo e com 502/503/504, quem respondeu foi o proxy
// do Vite: o backend está desligado.
export async function erroDaResposta(resposta: Response, padrao: string): Promise<ErroApi> {
  const corpo = await resposta.json().catch(() => null)
  if (corpo && typeof corpo.erro === 'string') {
    return new ErroApi(corpo.erro, resposta.status, typeof corpo.campo === 'string' ? corpo.campo : null)
  }
  if ([502, 503, 504].includes(resposta.status)) return new ErroApi(BACKEND_FORA, resposta.status)
  return new ErroApi(padrao, resposta.status)
}

export function mensagemDe(erro: unknown): string {
  if (erro instanceof Error && erro.message) return erro.message
  return 'Algo deu errado. Tente de novo.'
}

// ---------- Avisos (toast) ----------

export type Aviso = { id: number; texto: string }

let avisos: Aviso[] = []
let proximoId = 1
const ouvintes = new Set<() => void>()
const DURACAO_MS = 7000

function avisarOuvintes() {
  ouvintes.forEach((ouvinte) => ouvinte())
}

// Mostra um aviso de erro por alguns segundos (o mesmo texto não se repete na tela).
export function avisar(texto: string) {
  if (avisos.some((aviso) => aviso.texto === texto)) return
  const id = proximoId++
  avisos = [...avisos.slice(-2), { id, texto }]
  avisarOuvintes()
  window.setTimeout(() => fecharAviso(id), DURACAO_MS)
}

export function fecharAviso(id: number) {
  avisos = avisos.filter((aviso) => aviso.id !== id)
  avisarOuvintes()
}

export function assinarAvisos(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function avisosAtuais() {
  return avisos
}
