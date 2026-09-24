import { useState } from 'react'
import { useGaleria, type FiltrosGaleria, type ItemGaleria } from '../api/brolls'
import { useApagarCriacao } from '../api/criacoes'
import { useReferenciaDeBroll, type Referencia } from '../api/referencias'
import type { SessaoCompleta } from '../api/sessoes'
import { minutosESegundos } from '../utils/tempo'
import Confirmacao from './Confirmacao'
import PlayerBroll from './PlayerBroll'

type Props = {
  sessao: SessaoCompleta
  aoMandarParaChat: (referencia: Referencia) => void
}

type Opcao<T> = { valor: T; rotulo: string }

// Aba Galeria: todos os brolls prontos da sessão (ou de todas), com filtros.
export default function AbaGaleria({ sessao, aoMandarParaChat }: Props) {
  const [todas, setTodas] = useState(false)
  const [tipo, setTipo] = useState<FiltrosGaleria['tipo']>(null)
  const [orientacao, setOrientacao] = useState<FiltrosGaleria['orientacao']>(null)
  const [aberto, setAberto] = useState<ItemGaleria | null>(null)
  const deBroll = useReferenciaDeBroll(sessao.id)
  const apagar = useApagarCriacao()
  const [apagando, setApagando] = useState<ItemGaleria | null>(null)

  // Recarrega quando algum broll desta sessão fica pronto.
  const atualizacao = sessao.criacoes
    .flatMap((c) => c.brolls.map((b) => b.id))
    .join(',')
  const galeria = useGaleria({ sessaoId: todas ? null : sessao.id, tipo, orientacao }, atualizacao)

  function mandarParaChat(item: ItemGaleria) {
    deBroll.mutate(item.id, { onSuccess: aoMandarParaChat })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-stone-200 p-3">
        <Alternador<boolean>
          opcoes={[
            { valor: false, rotulo: 'Esta sessão' },
            { valor: true, rotulo: 'Todas as sessões' },
          ]}
          valor={todas}
          aoMudar={setTodas}
        />
        <div className="flex flex-wrap gap-2">
          <Alternador<FiltrosGaleria['tipo']>
            opcoes={[
              { valor: null, rotulo: 'Tudo' },
              { valor: 'imagem', rotulo: 'Imagem' },
              { valor: 'video', rotulo: 'Vídeo' },
            ]}
            valor={tipo}
            aoMudar={setTipo}
          />
          <Alternador<FiltrosGaleria['orientacao']>
            opcoes={[
              { valor: null, rotulo: 'Todas' },
              { valor: 'vertical', rotulo: 'Vertical' },
              { valor: 'horizontal', rotulo: 'Horizontal' },
            ]}
            valor={orientacao}
            aoMudar={setOrientacao}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {galeria.isPending && <p className="text-sm text-stone-500">Carregando…</p>}
        {galeria.isError && <p className="text-sm text-red-700">{galeria.error.message}</p>}
        {galeria.data?.length === 0 && (
          <p className="py-6 text-center text-sm text-stone-500">
            {tipo || orientacao ? 'Nenhum broll com esses filtros.' : 'Nenhum broll pronto ainda.'}
          </p>
        )}
        <ul className="grid grid-cols-2 gap-2">
          {galeria.data?.map((item) => (
            <ItemDaGaleria
              key={item.id}
              item={item}
              mostrarSessao={todas}
              daSessaoAberta={item.sessao_id === sessao.id}
              mandando={deBroll.isPending && deBroll.variables === item.id}
              aoAbrir={() => setAberto(item)}
              aoMandarParaChat={() => mandarParaChat(item)}
              aoApagar={() => {
                apagar.reset()
                setApagando(item)
              }}
            />
          ))}
        </ul>
      </div>

      {apagando && (
        <Confirmacao
          mensagem={
            <p>
              Apagar a v{apagando.numero_versao} deste broll{todas ? ` (sessão “${apagando.sessao_nome}”)` : ''}? O arquivo
              é removido. Não dá para desfazer.
            </p>
          }
          botao="Apagar"
          ocupado={apagar.isPending}
          erro={apagar.isError ? apagar.error.message : null}
          aoCancelar={() => setApagando(null)}
          aoConfirmar={() =>
            apagar.mutate(
              { sessaoId: apagando.sessao_id, criacaoId: apagando.criacao_id },
              {
                onSuccess: () => {
                  if (aberto?.criacao_id === apagando.criacao_id) setAberto(null)
                  setApagando(null)
                },
              },
            )
          }
        />
      )}

      {aberto && (
        <div
          role="dialog"
          aria-label="Broll em tamanho grande"
          className="absolute inset-0 z-20 flex flex-col bg-white"
        >
          <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2">
            <button type="button" onClick={() => setAberto(null)} className="text-sm text-stone-600 hover:text-stone-900">
              ← Galeria
            </button>
            <span className="truncate text-sm font-medium">
              v{aberto.numero_versao} · {aberto.sessao_nome}
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            <PlayerBroll broll={aberto} aoApagar={() => setApagando(aberto)} />
            <p className="text-sm text-stone-700">{aberto.prompt}</p>
            <p className="text-xs text-stone-500">{aberto.modelo}</p>
          </div>
        </div>
      )}
    </div>
  )
}

type PropsItem = {
  item: ItemGaleria
  mostrarSessao: boolean
  daSessaoAberta: boolean
  mandando: boolean
  aoAbrir: () => void
  aoMandarParaChat: () => void
  aoApagar: () => void
}

function ItemDaGaleria({
  item,
  mostrarSessao,
  daSessaoAberta,
  mandando,
  aoAbrir,
  aoMandarParaChat,
  aoApagar,
}: PropsItem) {
  const ehVideo = item.tipo === 'video'
  const podeMandar = !ehVideo && daSessaoAberta

  return (
    <li className="overflow-hidden rounded-lg border border-stone-200">
      <button
        type="button"
        onClick={aoAbrir}
        title={item.prompt}
        className="relative block aspect-square w-full bg-stone-100"
      >
        {ehVideo ? (
          // preload="metadata": o primeiro quadro do vídeo serve de miniatura.
          <video src={item.url} preload="metadata" muted className="h-full w-full object-cover" />
        ) : (
          <img src={item.url_miniatura} alt={item.prompt} loading="lazy" className="h-full w-full object-cover" />
        )}
        <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          v{item.numero_versao} · {item.orientacao === 'vertical' ? 'Vertical' : 'Horizontal'}
        </span>
        {ehVideo && item.duracao_segundos && (
          <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            ▶ {minutosESegundos(item.duracao_segundos)}
          </span>
        )}
      </button>
      <div className="space-y-1.5 p-2">
        {mostrarSessao && <p className="truncate text-xs text-stone-500">{item.sessao_nome}</p>}
        <div className="flex gap-1">
          <a
            href={`${item.url}?download=1`}
            download
            className="flex-1 rounded-md border border-stone-300 px-1.5 py-1 text-center text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Baixar
          </a>
          {!ehVideo && (
            <button
              type="button"
              onClick={aoMandarParaChat}
              disabled={!podeMandar || mandando}
              title={daSessaoAberta ? 'Anexa esta imagem na caixa do chat' : 'Abra a sessão deste broll'}
              className="flex-1 rounded-md border border-stone-300 px-1.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
            >
              {mandando ? 'Mandando…' : 'Mandar para o chat'}
            </button>
          )}
        </div>
        <button type="button" onClick={aoApagar} className="text-xs text-red-700 hover:underline">
          Apagar
        </button>
      </div>
    </li>
  )
}

function Alternador<T>({ opcoes, valor, aoMudar }: { opcoes: Opcao<T>[]; valor: T; aoMudar: (valor: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-xs">
      {opcoes.map((opcao) => (
        <button
          key={String(opcao.valor)}
          type="button"
          onClick={() => aoMudar(opcao.valor)}
          aria-pressed={valor === opcao.valor}
          className={`rounded-md px-2.5 py-1 ${
            valor === opcao.valor ? 'bg-white font-medium shadow-sm' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}
