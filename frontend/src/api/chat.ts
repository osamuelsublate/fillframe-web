import { useQuery } from '@tanstack/react-query'
import { ErroApi, pedir } from './cliente'

export type Llm = {
  id: string
  nome: string
  aceita_audio: boolean
  aceita_imagem: boolean
}

export function useLlms() {
  return useQuery({
    queryKey: ['llms'],
    queryFn: () => pedir<Llm[]>('/modelos/llm'),
  })
}

export type EventoTool = {
  acao: 'criacao_preparada' | 'criacao_ajustada'
  criacao_id: string
  prompt: string
}

type AoReceber = {
  aoTexto: (pedaco: string) => void
  aoTool: (evento: EventoTool) => void
  aoErro: (mensagem: string) => void
}

// Envia a mensagem e lê a resposta aos poucos (SSE: usuario, texto, tool, fim, erro).
export async function enviarMensagem(sessaoId: string, texto: string, { aoTexto, aoTool, aoErro }: AoReceber) {
  let resposta: Response
  try {
    resposta = await fetch(`/api/sessoes/${encodeURIComponent(sessaoId)}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    })
  } catch {
    aoErro('Não foi possível falar com o backend. Ele está rodando?')
    return
  }

  if (!resposta.ok || !resposta.body) {
    const corpo = await resposta.json().catch(() => null)
    const erro = new ErroApi(corpo?.erro ?? 'Não foi possível enviar a mensagem.', resposta.status)
    aoErro(erro.message)
    return
  }

  const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader()
  let acumulado = ''
  let terminou = false

  const tratarBloco = (bloco: string) => {
    let evento = 'message'
    let dados = ''
    for (const linha of bloco.split('\n')) {
      if (linha.startsWith('event:')) evento = linha.slice(6).trim()
      else if (linha.startsWith('data:')) dados += linha.slice(5).trim()
    }
    if (!dados) return
    const conteudo = JSON.parse(dados)
    if (evento === 'texto') aoTexto(conteudo.texto)
    else if (evento === 'tool') aoTool(conteudo)
    else if (evento === 'erro') {
      terminou = true
      aoErro(conteudo.erro)
    } else if (evento === 'fim') terminou = true
  }

  try {
    for (;;) {
      const { value, done } = await leitor.read()
      if (done) break
      acumulado += value
      let fimDoBloco = acumulado.indexOf('\n\n')
      while (fimDoBloco !== -1) {
        tratarBloco(acumulado.slice(0, fimDoBloco))
        acumulado = acumulado.slice(fimDoBloco + 2)
        fimDoBloco = acumulado.indexOf('\n\n')
      }
    }
  } catch {
    aoErro('A conexão com o backend caiu no meio da resposta.')
    return
  }

  if (!terminou) aoErro('A resposta terminou antes do fim. Tente de novo.')
}
