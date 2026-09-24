import type { ResumoPreco } from '../api/modelos'

function dolar(valor: number): string {
  const casas = valor !== 0 && valor < 0.1 ? 3 : 2
  return `US$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`
}

// "US$ 0,035 por imagem", "US$ 0,20 a 0,60 por segundo"
export function textoPreco(resumo: ResumoPreco | null): string {
  if (!resumo) return 'Preço não informado'
  if (resumo.valor_max === 0) return 'Grátis'
  const faixa =
    resumo.valor_min === resumo.valor_max
      ? dolar(resumo.valor_min)
      : `${dolar(resumo.valor_min)} a ${dolar(resumo.valor_max).replace('US$ ', '')}`
  return `${faixa} por ${resumo.unidade}`
}
