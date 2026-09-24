import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { enviarMensagem, useLlms, type EventoTool } from '../api/chat'
import { useAlterarSessao, type Mensagem as MensagemSalva, type SessaoCompleta } from '../api/sessoes'
import Mensagem, { AvisoRascunho } from './Mensagem'

const BOAS_VINDAS = 'Qual conteúdo você vai gravar? Me conta e eu te ajudo a planejar os brolls.'

// A resposta em andamento, na ordem em que chega: pedaços de texto e rascunhos preparados.
type Parte = { tipo: 'texto'; texto: string } | ({ tipo: 'tool' } & EventoTool)

type Envio = {
  texto: string
  partes: Parte[]
  terminou: boolean
}

type Props = {
  sessao: SessaoCompleta
  aoRevisarCriacao: (criacaoId: string, editar: boolean) => void
}

function juntarTexto(partes: Parte[], pedaco: string): Parte[] {
  const ultima = partes[partes.length - 1]
  if (ultima?.tipo === 'texto') return [...partes.slice(0, -1), { tipo: 'texto', texto: ultima.texto + pedaco }]
  return [...partes, { tipo: 'texto', texto: pedaco }]
}

export default function Chat({ sessao, aoRevisarCriacao }: Props) {
  const clienteQuery = useQueryClient()
  const [rascunho, setRascunho] = useState('')
  const [envio, setEnvio] = useState<Envio | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const fimDaLista = useRef<HTMLDivElement>(null)
  const caixaTexto = useRef<HTMLTextAreaElement>(null)

  const enviando = envio !== null && !envio.terminou
  const podeEnviar = rascunho.trim().length > 0 && !enviando
  const mensagens = sessao.mensagens.filter(
    (m) => !!(m.texto || m.transcricao) || (m.chamadas_de_tool ?? []).some((c) => c.acao),
  )

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length, envio?.partes, erro])

  // A caixa de texto cresce com o conteúdo, até um limite.
  useEffect(() => {
    const caixa = caixaTexto.current
    if (!caixa) return
    caixa.style.height = 'auto'
    caixa.style.height = `${Math.min(caixa.scrollHeight, 240)}px`
  }, [rascunho])

  async function enviar() {
    const texto = rascunho.trim()
    if (!texto || enviando) return

    setRascunho('')
    setErro(null)
    setEnvio({ texto, partes: [], terminou: false })

    let falhou: string | null = null
    await enviarMensagem(sessao.id, texto, {
      aoTexto: (pedaco) => setEnvio((atual) => atual && { ...atual, partes: juntarTexto(atual.partes, pedaco) }),
      aoTool: (evento) => {
        setEnvio((atual) => atual && { ...atual, partes: [...atual.partes, { tipo: 'tool', ...evento }] })
        // O rascunho aparece no painel na hora, em destaque.
        clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessao.id] })
        aoRevisarCriacao(evento.criacao_id, false)
      },
      aoErro: (mensagem) => {
        falhou = mensagem
      },
    })

    setEnvio((atual) => atual && { ...atual, terminou: true })
    // Recarrega a conversa salva e o histórico (a sessão sobe para o topo).
    await Promise.all([
      clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessao.id] }),
      clienteQuery.invalidateQueries({ queryKey: ['sessoes'], exact: true }),
    ])
    setEnvio(null)
    setErro(falhou)
    caixaTexto.current?.focus()
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault()
      enviar()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {mensagens.length === 0 && !envio && <Mensagem autor="llm" texto={BOAS_VINDAS} />}

          {mensagens.map((mensagem) => (
            <MensagemDaConversa key={mensagem.id} mensagem={mensagem} aoRevisarCriacao={aoRevisarCriacao} />
          ))}

          {envio && (
            <>
              <Mensagem autor="usuario" texto={envio.texto} />
              {envio.partes.map((parte, indice) =>
                parte.tipo === 'texto' ? (
                  <Mensagem
                    key={indice}
                    autor="llm"
                    texto={parte.texto}
                    digitando={!envio.terminou && indice === envio.partes.length - 1}
                  />
                ) : (
                  <AvisoRascunho
                    key={indice}
                    acao={parte.acao}
                    prompt={parte.prompt}
                    aoRevisar={() => aoRevisarCriacao(parte.criacao_id, true)}
                  />
                ),
              )}
              {!envio.terminou && envio.partes[envio.partes.length - 1]?.tipo !== 'texto' && (
                <p className="animate-pulse text-sm text-stone-500">
                  {envio.partes.length ? 'Preparando…' : 'Pensando…'}
                </p>
              )}
            </>
          )}

          {erro && <Mensagem autor="llm" texto={erro} erro />}
          <div ref={fimDaLista} />
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-stone-300 bg-white p-2 shadow-sm focus-within:border-stone-500">
          <textarea
            ref={caixaTexto}
            value={rascunho}
            onChange={(evento) => setRascunho(evento.target.value)}
            onKeyDown={aoTeclar}
            rows={1}
            autoFocus
            placeholder="Escreva sua mensagem… (Enter envia, Shift+Enter quebra a linha)"
            className="max-h-60 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 outline-none"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={!podeEnviar}
            className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}

function MensagemDaConversa({
  mensagem,
  aoRevisarCriacao,
}: {
  mensagem: MensagemSalva
  aoRevisarCriacao: Props['aoRevisarCriacao']
}) {
  const texto = mensagem.texto ?? mensagem.transcricao ?? ''
  if (mensagem.autor === 'usuario') return <Mensagem autor="usuario" texto={texto} />

  // Rodada com tools: o que a LLM disse e os rascunhos que preparou ou ajustou.
  const avisos = (mensagem.chamadas_de_tool ?? []).filter((c) => c.acao && c.criacao_id)
  return (
    <>
      {texto && <Mensagem autor="llm" texto={texto} />}
      {avisos.map((chamada) => (
        <AvisoRascunho
          key={chamada.id}
          acao={chamada.acao!}
          prompt={chamada.prompt ?? ''}
          aoRevisar={() => aoRevisarCriacao(chamada.criacao_id!, true)}
        />
      ))}
    </>
  )
}

export function SeletorLlm({ sessao }: { sessao: SessaoCompleta }) {
  const llms = useLlms()
  const alterar = useAlterarSessao(sessao.id)
  const opcoes = llms.data ?? []
  const conhecida = opcoes.some((llm) => llm.id === sessao.llm)

  return (
    <label className="flex items-center gap-2 text-sm text-stone-600">
      <span className="hidden sm:inline">LLM</span>
      <select
        value={sessao.llm}
        onChange={(evento) => alterar.mutate({ llm: evento.target.value })}
        disabled={alterar.isPending || llms.isPending}
        title={alterar.isError ? alterar.error.message : 'LLM desta sessão'}
        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm outline-none focus:border-stone-500"
      >
        {!conhecida && <option value={sessao.llm}>{sessao.llm}</option>}
        {opcoes.map((llm) => (
          <option key={llm.id} value={llm.id}>
            {llm.nome.replace(/^[^:]+:\s*/, '')}
          </option>
        ))}
      </select>
      {alterar.isError && <span className="text-xs text-red-700">{alterar.error.message}</span>}
    </label>
  )
}
