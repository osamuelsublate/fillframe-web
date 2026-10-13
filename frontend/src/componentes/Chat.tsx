import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { enviarMensagem, useLlms, type EventoTool } from '../api/chat'
import { ACEITOS, enviarReferencia, type Referencia } from '../api/referencias'
import { useAlterarSessao, type Mensagem as MensagemSalva, type SessaoCompleta } from '../api/sessoes'
import GravadorAudio from './GravadorAudio'
import { IconeClipe, IconeDocumento, IconeEnviar, IconeFechar, IconeSetas } from './Icones'
import Mensagem, { AvisoRascunho, Digitando, type Anexo } from './Mensagem'

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

// Imagem mandada de fora do chat (ex.: "Mandar para o chat" na Galeria).
export type AnexoExterno = { referencia: Referencia; vez: number }

type Props = {
  sessao: SessaoCompleta
  anexoExterno?: AnexoExterno | null
  aoRevisarCriacao: (criacaoId: string, editar: boolean) => void
}

function juntarTexto(partes: Parte[], pedaco: string): Parte[] {
  const ultima = partes[partes.length - 1]
  if (ultima?.tipo === 'texto') return [...partes.slice(0, -1), { tipo: 'texto', texto: ultima.texto + pedaco }]
  return [...partes, { tipo: 'texto', texto: pedaco }]
}

export default function Chat({ sessao, anexoExterno = null, aoRevisarCriacao }: Props) {
  const clienteQuery = useQueryClient()
  const [rascunho, setRascunho] = useState('')
  const [envio, setEnvio] = useState<Envio | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [anexos, setAnexos] = useState<AnexoLocal[]>([])
  const [vezAnexoExterno, setVezAnexoExterno] = useState(anexoExterno?.vez)

  // Anexo novo vindo da Galeria: entra na caixa de mensagem (sem repetir o mesmo arquivo).
  if (anexoExterno && anexoExterno.vez !== vezAnexoExterno) {
    setVezAnexoExterno(anexoExterno.vez)
    const { referencia } = anexoExterno
    if (!anexos.some((a) => a.referencia?.id === referencia.id)) {
      setAnexos([
        ...anexos,
        { chave: `galeria-${referencia.id}`, nome: referencia.nome_original ?? 'imagem', estado: 'pronto', referencia },
      ])
    }
  }
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
    const anexosDoEnvio = anexos
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
    let salva = false
    await enviarMensagem(sessao.id, texto, prontos.map((r) => r.id), audio?.id ?? null, {
      aoSalva: () => {
        salva = true
      },
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

    // Recarrega a conversa salva e o histórico (a sessão sobe para o topo).
    const recarregar = () =>
      Promise.all([
        clienteQuery.invalidateQueries({ queryKey: ['sessoes', sessao.id] }),
        clienteQuery.invalidateQueries({ queryKey: ['sessoes'], exact: true }),
      ])

    if (falhou) {
      // Falhou: mostra o erro na hora, sem esperar a recarga (que também pode falhar).
      setEnvio(null)
      setErro(falhou)
      // Se a mensagem nem chegou a ser guardada, o texto e os anexos voltam para a caixa: nada se perde.
      if (!salva) {
        setRascunho((atual) => atual || texto)
        setAnexos((atuais) => (atuais.length ? atuais : anexosDoEnvio))
      }
      void recarregar()
    } else {
      setEnvio((atual) => atual && { ...atual, terminou: true })
      await recarregar()
      setEnvio(null)
    }
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
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-azul bg-fundo/90 text-corpo font-medium text-azul">
          Solte aqui para anexar imagens ou arquivos de texto
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
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
                <Digitando texto={envio.partes.length ? 'Preparando…' : 'Pensando…'} />
              )}
            </>
          )}

          {erro && <Mensagem autor="llm" texto={erro} erro />}
          <div ref={fimDaLista} />
        </div>
      </div>

      <div className="px-6 pb-5">
        <div className="mx-auto max-w-3xl rounded-[22px] bg-fundo p-1.5 shadow-flutuante transition-shadow duration-200 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ff-azul)_35%,transparent),var(--ff-sombra-flutuante)]">
          {anexos.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 px-1.5 pt-1 pb-2">
              {anexos.map((anexo) => (
                <li
                  key={anexo.chave}
                  className={`surgir flex max-w-full items-center gap-2 rounded-xl py-1 pr-1 pl-1 text-nota ${
                    anexo.estado === 'erro' ? 'bg-vermelho/10 text-vermelho-texto' : 'bg-preenchimento-3'
                  }`}
                >
                  {anexo.referencia?.tipo === 'imagem' ? (
                    <img src={anexo.referencia.url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-fundo" aria-hidden>
                      {anexo.estado === 'enviando' ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-preenchimento border-t-azul" />
                      ) : (
                        <IconeDocumento className="h-4.5 w-4.5 text-azul" />
                      )}
                    </span>
                  )}
                  <span className="max-w-48 truncate">{anexo.nome}</span>
                  {anexo.estado === 'enviando' && <span className="text-rotulo-2">enviando…</span>}
                  {anexo.erro && <span role="alert">{anexo.erro}</span>}
                  <button
                    type="button"
                    onClick={() => setAnexos((atuais) => atuais.filter((a) => a.chave !== anexo.chave))}
                    title="Tirar da mensagem"
                    aria-label={`Tirar ${anexo.nome} da mensagem`}
                    className="apertar flex h-6 w-6 items-center justify-center rounded-full text-rotulo-2 hover:bg-preenchimento hover:text-rotulo"
                  >
                    <IconeFechar className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-1">
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
                className="apertar flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rotulo-2 hover:bg-preenchimento-2 hover:text-rotulo"
              >
                <IconeClipe className="h-5 w-5" />
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
                placeholder="Escreva sua mensagem…"
                title="Enter envia, Shift+Enter quebra a linha"
                className="max-h-60 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-corpo outline-none placeholder:text-rotulo-3"
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
                title={subindoAudio ? 'Enviando…' : 'Enviar (Enter)'}
                aria-label={subindoAudio ? 'Enviando…' : 'Enviar'}
                className="apertar flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-azul text-white hover:bg-azul-forte disabled:cursor-not-allowed disabled:bg-preenchimento disabled:text-fundo"
              >
                {subindoAudio ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <IconeEnviar className="h-4.5 w-4.5" />
                )}
              </button>
            )}
          </div>
          {erroAudio && (
            <p role="alert" className="px-3 pt-1 pb-1.5 text-nota text-vermelho-texto">
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
    <label className="flex items-center gap-2 text-rotulo-2">
      <span className="hidden sm:inline">LLM</span>
      <span className="relative flex items-center">
        <select
          value={sessao.llm}
          onChange={(evento) => alterar.mutate({ llm: evento.target.value })}
          disabled={alterar.isPending || llms.isPending}
          title={alterar.isError ? alterar.error.message : 'LLM desta sessão'}
          className="apertar h-7 appearance-none rounded-md bg-preenchimento-3 py-0 pr-7 pl-2.5 font-medium text-rotulo hover:bg-preenchimento-2 disabled:opacity-60"
        >
          {!conhecida && <option value={sessao.llm}>{sessao.llm}</option>}
          {opcoes.map((llm) => (
            <option key={llm.id} value={llm.id}>
              {llm.nome.replace(/^[^:]+:\s*/, '')}
            </option>
          ))}
        </select>
        <IconeSetas className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-rotulo-2" />
      </span>
      {alterar.isError && <span className="text-nota text-vermelho-texto">{alterar.error.message}</span>}
    </label>
  )
}
