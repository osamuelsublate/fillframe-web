const formatador = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

// "há 5 minutos", "ontem", "agora mesmo"
export function tempoRelativo(dataIso: string): string {
  const segundos = (new Date(dataIso).getTime() - Date.now()) / 1000
  for (const [unidade, tamanho] of unidades) {
    if (Math.abs(segundos) >= tamanho) {
      return formatador.format(Math.round(segundos / tamanho), unidade)
    }
  }
  return 'agora mesmo'
}

// 95 → "1:35"
export function minutosESegundos(segundos: number): string {
  const inteiros = Math.max(0, Math.round(segundos))
  return `${Math.floor(inteiros / 60)}:${String(inteiros % 60).padStart(2, '0')}`
}
