import type { Orientacao } from '../api/criacoes'

const PREFERIDA: Record<Orientacao, string> = { vertical: '9:16', horizontal: '16:9' }

function razao(proporcao: string): number | null {
  const [largura, altura] = proporcao.split(':').map(Number)
  return largura && altura ? largura / altura : null
}

// Mesma regra do backend: 9:16 (ou 16:9) se o modelo aceita; senão, a mais próxima na mesma orientação.
export function proporcaoPara(orientacao: Orientacao, aceitas: string[]): string | null {
  const candidatas = aceitas.filter((p) => {
    const r = razao(p)
    return r !== null && (orientacao === 'vertical' ? r < 1 : r > 1)
  })
  if (candidatas.length === 0) return null
  const preferida = PREFERIDA[orientacao]
  if (candidatas.includes(preferida)) return preferida
  const alvo = razao(preferida)!
  return candidatas.reduce((melhor, p) =>
    Math.abs(razao(p)! - alvo) < Math.abs(razao(melhor)! - alvo) ? p : melhor,
  )
}
