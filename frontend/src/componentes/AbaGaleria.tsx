import { useState } from 'react'
import { useGaleria, type FiltrosGaleria, type ItemGaleria } from '../api/brolls'
import { useApagarCriacao } from '../api/criacoes'
import { useReferenciaDeBroll, type Referencia } from '../api/referencias'
import type { SessaoCompleta } from '../api/sessoes'
import { minutosESegundos } from '../utils/tempo'
import Confirmacao from './Confirmacao'
import { IconeVoltar } from './Icones'
import PlayerBroll from './PlayerBroll'
import Segmentado from './Segmentado'

type Props = {
  sessao: SessaoCompleta
  aoMandarParaChat: (referencia: Referencia) => void
}

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
      <div className="space-y-2 border-b border-separador p-3">
        <Segmentado<boolean>
          nome="Quais sessões"
          opcoes={[
            { valor: false, rotulo: 'Esta sessão' },
            { valor: true, rotulo: 'Todas as sessões' },
          ]}
          valor={todas}
          aoMudar={setTodas}
        />
        <div className="flex flex-wrap gap-2">
          <Segmentado<FiltrosGaleria['tipo']>
            nome="Tipo"
            pequeno
            opcoes={[
              { valor: null, rotulo: 'Tudo' },
              { valor: 'imagem', rotulo: 'Imagem' },
              { valor: 'video', rotulo: 'Vídeo' },
            ]}
            valor={tipo}
            aoMudar={setTipo}
          />
          <Segmentado<FiltrosGaleria['orientacao']>
            nome="Formato"
            pequeno
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
        {galeria.isPending && <p className="text-rotulo-2">Carregando…</p>}
        {galeria.isError && <p className="text-vermelho-texto">{galeria.error.message}</p>}
        {galeria.data?.length === 0 && (
          <p className="py-10 text-center text-rotulo-2">
            {tipo || orientacao ? 'Nenhum broll com esses filtros.' : 'Nenhum broll pronto ainda.'}
          </p>
        )}
        <ul className="grid grid-cols-2 gap-3">
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
          className="surgir absolute inset-0 z-20 flex flex-col bg-agrupado"
        >
          <div className="relative flex h-13 shrink-0 items-center justify-center border-b border-separador bg-fundo px-24">
            <button
              type="button"
              onClick={() => setAberto(null)}
              className="apertar absolute left-1.5 flex items-center gap-0.5 rounded-md py-1 pr-2 pl-0.5 font-medium text-azul hover:bg-azul/10"
            >
              <IconeVoltar className="h-4.5 w-4.5" />
              Galeria
            </button>
            <span className="truncate font-semibold">
              v{aberto.numero_versao} · {aberto.sessao_nome}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="space-y-3 rounded-2xl bg-superficie p-3.5 shadow-cartao">
              <PlayerBroll broll={aberto} aoApagar={() => setApagando(aberto)} />
              <p className="leading-relaxed">{aberto.prompt}</p>
              <p className="text-nota text-rotulo-2">{aberto.modelo}</p>
            </div>
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
    <li className="surgir overflow-hidden rounded-2xl bg-superficie shadow-cartao">
      <button
        type="button"
        onClick={aoAbrir}
        title={item.prompt}
        className="group relative block aspect-square w-full overflow-hidden bg-preenchimento-3"
      >
        {ehVideo ? (
          // preload="metadata": o primeiro quadro do vídeo serve de miniatura.
          <video
            src={item.url}
            preload="metadata"
            muted
            className="h-full w-full object-cover transition-transform duration-300 ease-apple group-hover:scale-[1.03]"
          />
        ) : (
          <img
            src={item.url_miniatura}
            alt={item.prompt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 ease-apple group-hover:scale-[1.03]"
          />
        )}
        <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-mini font-semibold text-white">
          v{item.numero_versao} · {item.orientacao === 'vertical' ? 'Vertical' : 'Horizontal'}
        </span>
        {ehVideo && item.duracao_segundos && (
          <span className="absolute right-2 bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-mini font-semibold text-white tabular-nums">
            ▶ {minutosESegundos(item.duracao_segundos)}
          </span>
        )}
      </button>
      <div className="space-y-2 p-2.5">
        {mostrarSessao && <p className="truncate text-nota text-rotulo-2">{item.sessao_nome}</p>}
        <div className="flex gap-1.5">
          <a
            href={`${item.url}?download=1`}
            download
            className="apertar flex min-h-7 flex-1 items-center justify-center rounded-full bg-azul px-2 py-1 text-center text-nota font-semibold text-white hover:bg-azul-forte"
          >
            Baixar
          </a>
          {!ehVideo && (
            <button
              type="button"
              onClick={aoMandarParaChat}
              disabled={!podeMandar || mandando}
              title={daSessaoAberta ? 'Anexa esta imagem na caixa do chat' : 'Abra a sessão deste broll'}
              className="apertar min-h-7 flex-1 rounded-full bg-preenchimento-3 px-2 py-1 text-nota leading-tight font-semibold hover:bg-preenchimento-2 disabled:cursor-not-allowed disabled:text-rotulo-3"
            >
              {mandando ? 'Mandando…' : 'Mandar para o chat'}
            </button>
          )}
        </div>
        <button type="button" onClick={aoApagar} className="apertar -ml-1 rounded-md px-1 py-0.5 text-nota font-medium text-vermelho-texto hover:bg-vermelho/10">
          Apagar
        </button>
      </div>
    </li>
  )
}
