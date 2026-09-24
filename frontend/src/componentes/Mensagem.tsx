import type { ReactNode } from 'react'

export type Anexo = {
  id: string
  tipo: 'imagem' | 'texto' | 'audio'
  nome: string
  url: string | null // null enquanto ainda não foi enviado
}

type Props = {
  autor: 'usuario' | 'llm'
  texto: string
  anexos?: Anexo[]
  audioUrl?: string | null
  transcricao?: string | null
  transcrevendo?: boolean
  erro?: boolean
  digitando?: boolean
}

export default function Mensagem({
  autor,
  texto,
  anexos = [],
  audioUrl,
  transcricao,
  transcrevendo = false,
  erro,
  digitando,
}: Props) {
  if (autor === 'usuario') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {anexos.length > 0 && <ListaAnexos anexos={anexos} />}
        {audioUrl && (
          <div className="w-80 max-w-[85%] space-y-1.5 rounded-2xl bg-stone-200 px-3 py-2.5">
            <audio src={audioUrl} controls preload="metadata" className="h-9 w-full" />
            {transcrevendo && <p className="animate-pulse px-1 text-xs text-stone-500">Transcrevendo…</p>}
            {transcricao && (
              <details className="px-1 text-sm">
                <summary className="cursor-pointer text-xs text-stone-600 select-none">Texto transcrito</summary>
                <p className="mt-1 whitespace-pre-wrap text-stone-800">{transcricao}</p>
              </details>
            )}
          </div>
        )}
        {texto && (
          <div className="max-w-[85%] rounded-2xl bg-stone-200 px-4 py-2.5 whitespace-pre-wrap">{texto}</div>
        )}
      </div>
    )
  }

  if (erro) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
        {texto}
      </div>
    )
  }

  return (
    <div className="space-y-3 leading-relaxed">
      <Markdown texto={texto} />
      {digitando && <span className="inline-block h-4 w-2 animate-pulse bg-stone-400 align-middle" />}
    </div>
  )
}

export function ListaAnexos({ anexos }: { anexos: Anexo[] }) {
  return (
    <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
      {anexos.map((anexo) =>
        anexo.tipo === 'imagem' && anexo.url ? (
          <a key={anexo.id} href={anexo.url} target="_blank" rel="noopener noreferrer" title={anexo.nome}>
            <img src={anexo.url} alt={anexo.nome} className="h-24 w-24 rounded-lg border border-stone-200 object-cover" />
          </a>
        ) : (
          <a
            key={anexo.id}
            href={anexo.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700"
          >
            <span aria-hidden>📄</span>
            <span className="max-w-40 truncate">{anexo.nome}</span>
          </a>
        ),
      )}
    </div>
  )
}

type PropsAviso = {
  acao: 'criacao_preparada' | 'criacao_ajustada' | 'versao_criada'
  prompt: string
  aoRevisar: () => void
}

// "Rascunho preparado: [prompt resumido] → revisar"
export function AvisoRascunho({ acao, prompt, aoRevisar }: PropsAviso) {
  const resumo = prompt.length > 90 ? `${prompt.slice(0, 90).trimEnd()}…` : prompt
  return (
    <button
      type="button"
      onClick={aoRevisar}
      className="flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-left text-sm hover:border-stone-400"
    >
      <span className="shrink-0 font-medium">
        {acao === 'criacao_preparada'
          ? 'Rascunho preparado:'
          : acao === 'versao_criada'
            ? 'Nova versão preparada:'
            : 'Rascunho ajustado:'}
      </span>
      <span className="min-w-0 flex-1 truncate text-stone-600">{resumo}</span>
      <span className="shrink-0 font-medium text-stone-900">→ revisar</span>
    </button>
  )
}

// Markdown simples: títulos, listas, blocos de código, negrito, itálico, código e links.
function Markdown({ texto }: { texto: string }) {
  const linhas = texto.split('\n')
  const blocos: ReactNode[] = []
  let i = 0

  while (i < linhas.length) {
    const linha = linhas[i]

    if (linha.trim().startsWith('```')) {
      const codigo: string[] = []
      i++
      while (i < linhas.length && !linhas[i].trim().startsWith('```')) codigo.push(linhas[i++])
      i++
      blocos.push(
        <pre key={blocos.length} className="overflow-x-auto rounded-lg bg-stone-900 p-3 text-sm text-stone-100">
          <code>{codigo.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Citação: linhas que começam com ">" (o conteúdo de dentro também é markdown).
    if (/^\s*>/.test(linha)) {
      const citacao: string[] = []
      while (i < linhas.length && /^\s*>/.test(linhas[i])) citacao.push(linhas[i++].replace(/^\s*>\s?/, ''))
      blocos.push(
        <blockquote key={blocos.length} className="space-y-2 border-l-2 border-stone-300 pl-3 text-stone-700">
          <Markdown texto={citacao.join('\n')} />
        </blockquote>,
      )
      continue
    }

    const titulo = linha.match(/^(#{1,4})\s+(.*)/)
    if (titulo) {
      const tamanho = titulo[1].length <= 2 ? 'text-lg' : 'text-base'
      blocos.push(
        <p key={blocos.length} className={`${tamanho} font-semibold`}>
          {inline(titulo[2])}
        </p>,
      )
      i++
      continue
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(linha)) {
      const ordenada = /^\s*\d+\.\s+/.test(linha)
      const itens: string[] = []
      while (i < linhas.length && /^\s*([-*]|\d+\.)\s+/.test(linhas[i])) {
        itens.push(linhas[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))
        i++
      }
      const Lista = ordenada ? 'ol' : 'ul'
      blocos.push(
        <Lista key={blocos.length} className={`space-y-1 pl-5 ${ordenada ? 'list-decimal' : 'list-disc'}`}>
          {itens.map((item, n) => (
            <li key={n}>{inline(item)}</li>
          ))}
        </Lista>,
      )
      continue
    }

    if (/^\s*(---|\*\*\*)\s*$/.test(linha)) {
      blocos.push(<hr key={blocos.length} className="border-stone-200" />)
      i++
      continue
    }

    if (!linha.trim()) {
      i++
      continue
    }

    const paragrafo: string[] = []
    while (
      i < linhas.length &&
      linhas[i].trim() &&
      !/^(#{1,4}\s|\s*([-*]|\d+\.)\s+|\s*```|\s*>)/.test(linhas[i])
    ) {
      paragrafo.push(linhas[i++])
    }
    blocos.push(
      <p key={blocos.length} className="whitespace-pre-wrap">
        {inline(paragrafo.join('\n'))}
      </p>,
    )
  }

  return <>{blocos}</>
}

function inline(texto: string): ReactNode[] {
  const partes: ReactNode[] = []
  const padrao = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g
  let ultimo = 0
  for (const achado of texto.matchAll(padrao)) {
    const inicio = achado.index ?? 0
    if (inicio > ultimo) partes.push(texto.slice(ultimo, inicio))
    const trecho = achado[0]
    const chave = partes.length
    if (trecho.startsWith('`')) {
      partes.push(
        <code key={chave} className="rounded bg-stone-100 px-1 py-0.5 text-[0.9em]">
          {trecho.slice(1, -1)}
        </code>,
      )
    } else if (trecho.startsWith('**')) {
      partes.push(<strong key={chave}>{trecho.slice(2, -2)}</strong>)
    } else if (trecho.startsWith('[')) {
      const [, rotulo, url] = trecho.match(/^\[([^\]]+)\]\(([^)]+)\)$/) ?? []
      partes.push(
        <a key={chave} href={url} target="_blank" rel="noopener noreferrer" className="underline">
          {rotulo}
        </a>,
      )
    } else {
      partes.push(<em key={chave}>{trecho.slice(1, -1)}</em>)
    }
    ultimo = inicio + trecho.length
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return partes
}
