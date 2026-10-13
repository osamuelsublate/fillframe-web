import type { ReactNode } from 'react'
import { IconeAlerta, IconeDocumento, IconeVarinha } from './Icones'

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
      <div className="surgir flex flex-col items-end gap-1.5">
        {anexos.length > 0 && <ListaAnexos anexos={anexos} />}
        {audioUrl && (
          <div className="w-80 max-w-[85%] space-y-1.5 rounded-[20px] rounded-br-md bg-preenchimento-2 px-3 py-2.5">
            <audio src={audioUrl} controls preload="metadata" className="h-9 w-full" />
            {transcrevendo && <p className="animate-pulse px-1 text-nota text-rotulo-2">Transcrevendo…</p>}
            {transcricao && (
              <details className="px-1">
                <summary className="cursor-pointer text-nota text-rotulo-2 select-none">Texto transcrito</summary>
                <p className="mt-1 text-corpo whitespace-pre-wrap">{transcricao}</p>
              </details>
            )}
          </div>
        )}
        {texto && (
          <div className="max-w-[80%] rounded-[20px] rounded-br-md bg-azul px-4 py-2 text-corpo whitespace-pre-wrap text-white">
            {texto}
          </div>
        )}
      </div>
    )
  }

  if (erro) {
    return (
      <div role="alert" className="surgir flex items-start gap-2.5 rounded-xl bg-vermelho/10 px-4 py-3 text-vermelho-texto">
        <IconeAlerta className="mt-0.5 h-4.5 w-4.5 shrink-0" />
        <span className="text-corpo">{texto}</span>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-corpo">
      <Markdown texto={texto} />
      {digitando && <span className="inline-block h-4 w-0.5 animate-pulse rounded-full bg-azul align-middle" />}
    </div>
  )
}

// Os três pontinhos do iMessage enquanto a LLM pensa.
export function Digitando({ texto }: { texto: string }) {
  return (
    <div className="surgir flex items-center gap-2.5" role="status">
      <span className="flex items-center gap-1 rounded-[20px] rounded-bl-md bg-preenchimento-2 px-3.5 py-3" aria-hidden>
        <span className="h-2 w-2 animate-bounce rounded-full bg-rotulo-3 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-rotulo-3 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-rotulo-3" />
      </span>
      <span className="text-nota text-rotulo-2">{texto}</span>
    </div>
  )
}

export function ListaAnexos({ anexos }: { anexos: Anexo[] }) {
  return (
    <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
      {anexos.map((anexo) =>
        anexo.tipo === 'imagem' && anexo.url ? (
          <a key={anexo.id} href={anexo.url} target="_blank" rel="noopener noreferrer" title={anexo.nome} className="rounded-2xl">
            <img
              src={anexo.url}
              alt={anexo.nome}
              className="h-28 w-28 rounded-2xl object-cover shadow-cartao transition-transform duration-200 ease-apple hover:scale-[1.02]"
            />
          </a>
        ) : (
          <a
            key={anexo.id}
            href={anexo.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-preenchimento-3 px-3 py-2 hover:bg-preenchimento-2"
          >
            <IconeDocumento className="h-4.5 w-4.5 text-azul" />
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
      className="apertar group flex w-full items-center gap-3 rounded-xl bg-superficie px-3 py-2.5 text-left shadow-cartao hover:bg-preenchimento-3"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-azul/12 text-azul">
        <IconeVarinha className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          {acao === 'criacao_preparada'
            ? 'Rascunho preparado'
            : acao === 'versao_criada'
              ? 'Nova versão preparada'
              : 'Rascunho ajustado'}
        </span>
        <span className="block truncate text-nota text-rotulo-2">{resumo}</span>
      </span>
      <span className="shrink-0 rounded-full bg-azul/12 px-3 py-1 font-semibold text-azul group-hover:bg-azul group-hover:text-white">
        Revisar
      </span>
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
        <pre key={blocos.length} className="overflow-x-auto rounded-xl bg-preenchimento-3 p-3.5 font-mono text-nota">
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
        <blockquote key={blocos.length} className="space-y-2 border-l-[3px] border-preenchimento pl-3 text-rotulo-2">
          <Markdown texto={citacao.join('\n')} />
        </blockquote>,
      )
      continue
    }

    const titulo = linha.match(/^(#{1,4})\s+(.*)/)
    if (titulo) {
      const tamanho = titulo[1].length <= 2 ? 'text-titulo' : 'text-corpo'
      blocos.push(
        <p key={blocos.length} className={`${tamanho} pt-1 font-semibold tracking-tight`}>
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
        <Lista key={blocos.length} className={`space-y-1 pl-5 marker:text-rotulo-3 ${ordenada ? 'list-decimal' : 'list-disc'}`}>
          {itens.map((item, n) => (
            <li key={n}>{inline(item)}</li>
          ))}
        </Lista>,
      )
      continue
    }

    if (/^\s*(---|\*\*\*)\s*$/.test(linha)) {
      blocos.push(<hr key={blocos.length} className="border-separador" />)
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
        <code key={chave} className="rounded-md bg-preenchimento-3 px-1.5 py-0.5 font-mono text-[0.85em]">
          {trecho.slice(1, -1)}
        </code>,
      )
    } else if (trecho.startsWith('**')) {
      partes.push(<strong key={chave}>{trecho.slice(2, -2)}</strong>)
    } else if (trecho.startsWith('[')) {
      const [, rotulo, url] = trecho.match(/^\[([^\]]+)\]\(([^)]+)\)$/) ?? []
      partes.push(
        <a key={chave} href={url} target="_blank" rel="noopener noreferrer" className="text-azul hover:underline">
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
