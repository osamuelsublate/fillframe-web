import { useEffect, useRef, useState } from 'react'
import { minutosESegundos } from '../utils/tempo'
import { IconeMicrofone } from './Icones'

const LIMITE_SEGUNDOS = 10 * 60 // 10 minutos por mensagem de voz

// Formatos que o navegador pode gravar, em ordem de preferência (todos aceitos pelo backend).
const FORMATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

type Props = {
  desativado: boolean
  aoTerminar: (arquivo: File) => void
  aoErro: (mensagem: string) => void
  aoMudarGravando: (gravando: boolean) => void
}

// Botão de microfone: grava com o MediaRecorder do navegador, mostra o tempo, cancela ou envia.
export default function GravadorAudio({ desativado, aoTerminar, aoErro, aoMudarGravando }: Props) {
  const [estado, setEstado] = useState<'parado' | 'pedindo' | 'gravando'>('parado')
  const [segundos, setSegundos] = useState(0)
  const gravador = useRef<MediaRecorder | null>(null)
  const pedacos = useRef<Blob[]>([])
  const enviarAoParar = useRef(false)

  useEffect(() => {
    aoMudarGravando(estado === 'gravando')
  }, [estado, aoMudarGravando])

  useEffect(() => {
    if (estado !== 'gravando') return
    const inicio = Date.now()
    const relogio = window.setInterval(() => {
      const decorridos = Math.floor((Date.now() - inicio) / 1000)
      setSegundos(decorridos)
      if (decorridos >= LIMITE_SEGUNDOS) parar(true)
    }, 250)
    return () => window.clearInterval(relogio)
  }, [estado])

  // Ao sair da tela no meio de uma gravação, desliga o microfone.
  useEffect(() => () => gravador.current?.stream.getTracks().forEach((t) => t.stop()), [])

  async function comecar() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      aoErro('Este navegador não permite gravar áudio.')
      return
    }
    setEstado('pedindo')
    let fluxo: MediaStream
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (erro) {
      setEstado('parado')
      const nome = erro instanceof DOMException ? erro.name : ''
      aoErro(
        nome === 'NotAllowedError' || nome === 'SecurityError'
          ? 'Permita o acesso ao microfone para gravar áudio.'
          : nome === 'NotFoundError'
            ? 'Nenhum microfone foi encontrado.'
            : 'Não foi possível usar o microfone.',
      )
      return
    }

    const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f))
    const novo = new MediaRecorder(fluxo, formato ? { mimeType: formato } : undefined)
    pedacos.current = []
    enviarAoParar.current = false
    novo.ondataavailable = (evento) => {
      if (evento.data.size > 0) pedacos.current.push(evento.data)
    }
    novo.onstop = () => {
      fluxo.getTracks().forEach((t) => t.stop())
      setEstado('parado')
      setSegundos(0)
      if (!enviarAoParar.current || pedacos.current.length === 0) return
      const tipo = novo.mimeType.split(';')[0] || 'audio/webm'
      const extensao = tipo.includes('mp4') ? 'm4a' : 'webm'
      aoTerminar(new File(pedacos.current, `gravacao.${extensao}`, { type: tipo }))
    }
    gravador.current = novo
    novo.start(1000)
    setEstado('gravando')
  }

  function parar(enviar: boolean) {
    enviarAoParar.current = enviar
    if (gravador.current?.state === 'recording') gravador.current.stop()
  }

  if (estado === 'gravando') {
    return (
      <div className="surgir flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 py-0.5 pl-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-vermelho" aria-hidden />
        <span className="font-medium">Gravando…</span>
        <span className="text-corpo text-rotulo-2 tabular-nums">{minutosESegundos(segundos)}</span>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => parar(false)}
            className="apertar h-9 rounded-full bg-preenchimento-3 px-4 font-medium hover:bg-preenchimento-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => parar(true)}
            className="apertar h-9 rounded-full bg-azul px-4 font-semibold text-white hover:bg-azul-forte"
          >
            Enviar áudio
          </button>
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={comecar}
      disabled={desativado || estado === 'pedindo'}
      title="Gravar áudio"
      aria-label="Gravar áudio"
      className="apertar flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rotulo-2 hover:bg-preenchimento-2 hover:text-rotulo disabled:opacity-40"
    >
      <IconeMicrofone className="h-5 w-5" />
    </button>
  )
}
