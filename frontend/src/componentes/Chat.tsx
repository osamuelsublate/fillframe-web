import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { enviarMensagem, useLlms, type EventoTool } from '../api/chat'
import { ACEITOS, enviarReferencia, type Referencia } from '../api/referencias'
import { useAlterarSessao, type Mensagem as MensagemSalva, type SessaoCompleta } from '../api/sessoes'
import GravadorAudio from './GravadorAudio'
import Mensagem, { AvisoRascunho, type Anexo } from './Mensagem'

const BOAS_VINDAS = 'Qual conteúdo você vai gravar? Me conta e eu te ajudo a planejar os brolls.'

// A resposta em andamento, na ordem em que chega: pedaços de texto e rascunhos preparados.
type Parte = { tipo: 'texto'; texto: string } | ({ tipo: 'tool' } & EventoTool)

type Envio = {
  texto: string
  anexos: Anexo[]
  audioUrl: string | null
  transcricao: string | null
  partes: Parte[]
  terminou: boolean
}

// Arquivo escolhido para a próxima mensagem: é enviado na hora, para o backend validar.
type AnexoLocal = {
  chave: string
  nome: string
  estado: 'enviando' | 'pronto' | 'erro'
  referencia?: Referencia
  erro?: string
}

function paraAnexo(referencia: Referencia): Anexo {
  return {
    id: referencia.id,
    tipo: referencia.tipo,
    nome: referencia.nome_original ?? 'arquivo',
    url: referencia.url,
  }
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
  const [anexos, setAnexos] = useState<AnexoLocal[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [subindoAudio, setSubindoAudio] = useState(false)
  const [erroAudio, setErroAudio] = useState<string | null>(null)
  const llms = useLlms()
  const llmAceitaAudio = llms.data?.find((l) => l.id === sessao.llm)?.aceita_audio ?? false
  const fimDaLista = useRef<HTMLDivElement>(null)
  const caixaTexto = useRef<HTMLTextAreaElement>(null)
  const seletorArquivo = useRef<HTMLInputElement>(null)

  const enviando = envio !== null && !envio.terminou
  const subindoAnexo = anexos.some((a) => a.estado === 'enviando')
  const podeEnviar = rascunho.trim().length > 0 && !enviando && !subindoAnexo

  const urlPorReferencia = new Map(sessao.referencias.map((r) => [r.id, r.url]))
  const anexosPorMensagem = new Map<string, Anexo[]>()
  for (const referencia of sessao.referencias) {
    // O áudio gravado aparece como player na própria mensagem, não como anexo.
    if (!referencia.mensagem_id || referencia.tipo === 'audio') continue
    anexosPorMensagem.set(referencia.mensagem_id, [
      ...(anexosPorMensagem.get(referencia.mensagem_id) ?? []),
      paraAnexo(referencia),
    ])
  }
  const mensagens = sessao.mensagens.filter(
    (m) => !!(m.texto || m.transcricao || m.audio_referencia_id) || (m.chamadas_de_tool ?? []).some((c) => c.acao),
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

  function adicionarArquivos(arquivos: FileList | File[]) {
    for (const arquivo of Array.from(arquivos)) {
      const chave = `${Date.now()}-${Math.random()}`
      setAnexos((atuais) => [...atuais, { chave, nome: arquivo.name, estado: 'enviando' }])
      enviarReferencia(sessao.id, arquivo)
        .then((referencia) => {
          setAnexos((atuais) =>
            atuais.map((a) => (a.chave === chave ? { ...a, estado: 'pronto', referencia } : a)),
          )
          // A imagem já aparece em "Referências da sessão", no painel.
          clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessao.id] })
        })
        .catch((falha: Error) =>
          setAnexos((atuais) =>
            atuais.map((a) => (a.chave === chave ? { ...a, estado: 'erro', erro: falha.message } : a)),
          ),
        )
    }
  }

  // Áudio gravado: sobe como referência e já envia a mensagem (com o texto e os anexos que houver).
  async function enviarAudio(arquivo: File) {
    setErroAudio(null)
    setSubindoAudio(true)
    try {
      const audio = await enviarReferencia(sessao.id, arquivo)
      setSubindoAudio(false)
      await enviar(audio)
    } catch (falha) {
      setSubindoAudio(false)
      setErroAudio(falha instanceof Error ? falha.message : 'Não foi possível enviar o áudio.')
    }
  }

  async function enviar(audio: Referencia | null = null) {
    const texto = rascunho.trim()
    if ((!texto && !audio) || enviando || subindoAnexo) return

    const prontos = anexos.flatMap((a) => (a.referencia ? [a.referencia] : []))
    setRascunho('')
    setAnexos([])
    setErro(null)
    setErroAudio(null)
    setEnvio({
      texto,
      anexos: prontos.map(paraAnexo),
      audioUrl: audio?.url ?? null,
      transcricao: null,
      partes: [],
      terminou: false,
    })

    let falhou: string | null = null
    await enviarMensagem(sessao.id, texto, prontos.map((r) => r.id), audio?.id ?? null, {
      aoTranscricao: (transcricao) => setEnvio((atual) => atual && { ...atual, transcricao }),
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

  const esperandoTranscricao =
    envio !== null &&
    envio.audioUrl !== null &&
    !llmAceitaAudio &&
    envio.transcricao === null &&
    envio.partes.length === 0 &&
    !envio.terminou

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={(evento) => {
        if (!evento.dataTransfer.types.includes('Files')) return
        evento.preventDefault()
        setArrastando(true)
      }}
      onDragLeave={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node)) setArrastando(false)
      }}
      onDrop={(evento) => {
        evento.preventDefault()
        setArrastando(false)
        if (evento.dataTransfer.files.length) adicionarArquivos(evento.dataTransfer.files)
      }}
    >
      {arrastando && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-stone-400 bg-stone-50/90 text-sm font-medium text-stone-600">
          Solte aqui para anexar imagens ou arquivos de texto
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {mensagens.length === 0 && !envio && <Mensagem autor="llm" texto={BOAS_VINDAS} />}

          {mensagens.map((mensagem) => (
            <MensagemDaConversa
              key={mensagem.id}
              mensagem={mensagem}
              anexos={anexosPorMensagem.get(mensagem.id) ?? []}
              audioUrl={mensagem.audio_referencia_id ? (urlPorReferencia.get(mensagem.audio_referencia_id) ?? null) : null}
              aoRevisarCriacao={aoRevisarCriacao}
            />
          ))}

          {envio && (
            <>
              <Mensagem
                autor="usuario"
                texto={envio.texto}
                anexos={envio.anexos}
                audioUrl={envio.audioUrl}
                transcricao={envio.transcricao}
                transcrevendo={esperandoTranscricao}
              />
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
              {!envio.terminou && !esperandoTranscricao && envio.partes[envio.partes.length - 1]?.tipo !== 'texto' && (
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
        <div className="mx-auto max-w-3xl rounded-2xl border border-stone-300 bg-white p-2 shadow-sm focus-within:border-stone-500">
          {anexos.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 px-1 pb-2">
              {anexos.map((anexo) => (
                <li
                  key={anexo.chave}
                  className={`flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
                    anexo.estado === 'erro' ? 'border-red-200 bg-red-50 text-red-800' : 'border-stone-200 bg-stone-50'
                  }`}
                >
                  {anexo.referencia?.tipo === 'imagem' ? (
                    <img src={anexo.referencia.url} alt="" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <span aria-hidden>{anexo.estado === 'enviando' ? '⏳' : anexo.estado === 'erro' ? '⚠️' : '📄'}</span>
                  )}
                  <span className="max-w-48 truncate">{anexo.nome}</span>
                  {anexo.estado === 'enviando' && <span className="text-stone-500">enviando…</span>}
                  {anexo.erro && <span role="alert">{anexo.erro}</span>}
                  <button
                    type="button"
                    onClick={() => setAnexos((atuais) => atuais.filter((a) => a.chave !== anexo.chave))}
                    title="Tirar da mensagem"
                    aria-label={`Tirar ${anexo.nome} da mensagem`}
                    className="ml-0.5 rounded px-1 text-stone-500 hover:bg-stone-200 hover:text-stone-900"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={seletorArquivo}
              type="file"
              multiple
              accept={ACEITOS}
              className="hidden"
              onChange={(evento) => {
                if (evento.target.files?.length) adicionarArquivos(evento.target.files)
                evento.target.value = ''
              }}
            />
            {!gravando && (
              <button
                type="button"
                onClick={() => seletorArquivo.current?.click()}
                title="Anexar imagens ou arquivos de texto"
                aria-label="Anexar arquivo"
                className="rounded-xl p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                  <path d="m21.4 11.1-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" />
                </svg>
              </button>
            )}
            {!gravando && (
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
            )}
            <GravadorAudio
              desativado={enviando || subindoAudio || subindoAnexo}
              aoTerminar={enviarAudio}
              aoErro={setErroAudio}
              aoMudarGravando={setGravando}
            />
            {!gravando && (
              <button
                type="button"
                onClick={() => enviar()}
                disabled={!podeEnviar}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {subindoAudio ? 'Enviando…' : 'Enviar'}
              </button>
            )}
          </div>
          {erroAudio && (
            <p role="alert" className="px-2 pt-1.5 text-sm text-red-700">
              {erroAudio}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function MensagemDaConversa({
  mensagem,
  anexos,
  audioUrl,
  aoRevisarCriacao,
}: {
  mensagem: MensagemSalva
  anexos: Anexo[]
  audioUrl: string | null
  aoRevisarCriacao: Props['aoRevisarCriacao']
}) {
  if (mensagem.autor === 'usuario') {
    return (
      <Mensagem
        autor="usuario"
        texto={mensagem.texto ?? ''}
        anexos={anexos}
        audioUrl={audioUrl}
        transcricao={mensagem.transcricao}
      />
    )
  }
  const texto = mensagem.texto ?? mensagem.transcricao ?? ''

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
