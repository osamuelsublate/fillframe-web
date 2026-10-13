import { useEffect, useState } from 'react'
import { minutosESegundos } from '../utils/tempo'

const LIMITE_ANTES_DE_TERMINAR = 0.95

type Props = {
  iniciadaEm: string | null
  estimativaSegundos: number | null
  pronto?: boolean
}

// Contador + barra: a barra anda pelo tempo decorrido ÷ estimativa e para em 95% até a geração
// terminar de verdade; o contador continua correndo.
export default function ProgressoCriacao({ iniciadaEm, estimativaSegundos, pronto = false }: Props) {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (pronto) return
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(relogio)
  }, [pronto])

  const decorridos = iniciadaEm ? Math.max(0, (agora - new Date(iniciadaEm).getTime()) / 1000) : 0
  const fracao = pronto
    ? 1
    : estimativaSegundos
      ? Math.min(decorridos / estimativaSegundos, LIMITE_ANTES_DE_TERMINAR)
      : 0

  if (pronto) {
    return (
      <div className="h-1 overflow-hidden rounded-full bg-verde/20" aria-hidden>
        <div className="h-full w-full rounded-full bg-verde" />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 font-medium text-azul">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-azul/25 border-t-azul" aria-hidden />
        <span>Gerando…</span>
        <span className="ml-auto text-rotulo tabular-nums">{minutosESegundos(Math.floor(decorridos))}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fracao * 100)}
        aria-label="Andamento estimado"
        className="h-1.5 overflow-hidden rounded-full bg-preenchimento-2"
      >
        <div
          className="h-full rounded-full bg-azul transition-[width] duration-1000 ease-linear"
          style={{ width: `${fracao * 100}%` }}
        />
      </div>
      {estimativaSegundos !== null && (
        <p className="text-nota text-rotulo-2">
          ~{minutosESegundos(estimativaSegundos)} estimado
          {decorridos > estimativaSegundos && ' · passou da estimativa, ainda gerando'}
        </p>
      )}
    </div>
  )
}
