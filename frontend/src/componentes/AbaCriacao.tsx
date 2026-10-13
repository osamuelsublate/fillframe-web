import { useEffect, useRef, useState } from 'react'
import {
  useApagarCriacao,
  useGerarCriacao,
  useNovaVersao,
  type Broll,
  type Criacao,
  type Situacao,
} from '../api/criacoes'
import { useApagarReferencia, useReferenciaDeBroll, type Referencia } from '../api/referencias'
import type { SessaoCompleta } from '../api/sessoes'
import ConfigCriacao, { type InicioCriacao } from './ConfigCriacao'
import Confirmacao from './Confirmacao'
import { IconeFechar, IconeMais } from './Icones'
import type { Destaque } from './Painel'
import PlayerBroll from './PlayerBroll'
import ProgressoCriacao from './ProgressoCriacao'
import SeletorVersoes from './SeletorVersoes'

const NOMES_SITUACAO: Record<Situacao, string> = {
  rascunho: 'Rascunho',
  gerando: 'Gerando',
  pronto: 'Pronto',
  falhou: 'Falhou',
  apagado: 'Apagado',
}

const CORES_SITUACAO: Record<Situacao, string> = {
  rascunho: 'bg-preenchimento-2 text-rotulo-2',
  gerando: 'bg-azul/12 text-azul',
  pronto: 'bg-verde/15 text-verde-texto',
  falhou: 'bg-vermelho/12 text-vermelho-texto',
  apagado: 'bg-preenchimento-3 text-rotulo-3',
}

type Props = {
  sessao: SessaoCompleta
  destaque: Destaque | null
}

// As versões de cada broll juntas (mesma raiz), com o broll mexido mais recentemente primeiro.
function agruparPorBroll(criacoes: Criacao[]): Criacao[][] {
  const grupos = new Map<string, Criacao[]>()
  for (const criacao of criacoes) grupos.set(criacao.raiz_id, [...(grupos.get(criacao.raiz_id) ?? []), criacao])
  const ultima = (grupo: Criacao[]) => Math.max(...grupo.map((c) => new Date(c.criada_em).getTime()))
  return [...grupos.values()]
    .map((grupo) => [...grupo].sort((a, b) => a.numero_versao - b.numero_versao))
    .sort((a, b) => ultima(b) - ultima(a))
}

// Versão mostrada por padrão: a mais nova que não foi apagada.
function versaoPadrao(grupo: Criacao[]): Criacao {
  return [...grupo].reverse().find((c) => c.situacao !== 'apagado') ?? grupo[grupo.length - 1]
}

// Aba Criação: lista das criações da sessão, ou a configuração de uma delas.
export default function AbaCriacao({ sessao, destaque }: Props) {
  // null: lista; 'nova': criação nova; id: editando esse rascunho.
  const [editando, setEditando] = useState<string | null>(null)
  const [inicio, setInicio] = useState<InicioCriacao | null>(null)
  const deBroll = useReferenciaDeBroll(sessao.id)
  const novaVersao = useNovaVersao(sessao.id)
  const apagar = useApagarCriacao()
  const [apagando, setApagando] = useState<{ criacao: Criacao; versoes: Criacao[] } | null>(null)
  // Versão escolhida em cada broll (raiz → id). Sem escolha, mostra a mais nova.
  const [escolhidas, setEscolhidas] = useState<Record<string, string>>({})
  const [vezVista, setVezVista] = useState(destaque?.vez)
  const lista = useRef<HTMLDivElement>(null)

  // Destaque novo: "revisar" abre o rascunho; um rascunho recém-preparado só fica marcado na lista.
  if (destaque && destaque.vez !== vezVista) {
    setVezVista(destaque.vez)
    const criacao = sessao.criacoes.find((c) => c.id === destaque.criacaoId)
    setEditando(destaque.editar && criacao ? destaque.criacaoId : null)
    if (criacao) setEscolhidas((atuais) => ({ ...atuais, [criacao.raiz_id]: criacao.id }))
  }
  const destacadaId = destaque && !editando ? destaque.criacaoId : null

  useEffect(() => {
    if (!destacadaId) return
    lista.current
      ?.querySelector(`[data-criacoes~="${destacadaId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [destacadaId, destaque?.vez, sessao.criacoes.length])

  // "Usar como referência": a imagem vira referência e abre um vídeo novo que começa nela,
  // na mesma orientação da imagem (senão o vídeo sai com faixas pretas).
  function usarComoReferencia(broll: Broll) {
    deBroll.mutate(broll.id, {
      onSuccess: (referencia) => {
        setInicio({
          tipo: 'video',
          orientacao: (broll.largura ?? 0) > (broll.altura ?? 0) ? 'horizontal' : 'vertical',
          referencias: [{ id: referencia.id, papel: 'primeiro_quadro' }],
        })
        setEditando('nova')
      },
    })
  }

  // "Nova versão a partir desta": cria o rascunho da versão nova e já abre para ajustar.
  function criarVersao(criacaoId: string) {
    novaVersao.mutate(criacaoId, {
      onSuccess: (nova) => {
        setEscolhidas((atuais) => ({ ...atuais, [nova.raiz_id]: nova.id }))
        setEditando(nova.id)
      },
    })
  }

  if (editando) {
    const criacao = sessao.criacoes.find((c) => c.id === editando) ?? null
    return (
      <ConfigCriacao
        key={editando}
        sessaoId={sessao.id}
        criacao={criacao}
        inicio={editando === 'nova' ? inicio : null}
        referenciasDaSessao={sessao.referencias}
        aoNovaVersao={criarVersao}
        aoFechar={() => {
          setEditando(null)
          setInicio(null)
        }}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pt-3 pb-1">
        <button
          type="button"
          onClick={() => {
            setInicio(null)
            setEditando('nova')
          }}
          className="apertar flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-azul font-semibold text-white hover:bg-azul-forte"
        >
          <IconeMais className="h-4 w-4" />
          Nova criação
        </button>
      </div>

      <div ref={lista} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <ReferenciasDaSessao sessao={sessao} />
        {sessao.criacoes.length === 0 && (
          <p className="py-10 text-center text-rotulo-2">Nenhuma criação nesta sessão ainda.</p>
        )}
        {novaVersao.isError && (
          <p role="alert" className="rounded-xl bg-vermelho/10 px-3 py-2 text-vermelho-texto">
            {novaVersao.error.message}
          </p>
        )}
        {agruparPorBroll(sessao.criacoes).map((versoes) => {
          // Versão escolhida (se ainda não foi apagada) ou a mais nova que existe.
          const escolhida =
            versoes.find((v) => v.id === escolhidas[versoes[0].raiz_id] && v.situacao !== 'apagado') ??
            versaoPadrao(versoes)
          return (
            <div key={versoes[0].raiz_id} data-criacoes={versoes.map((v) => v.id).join(' ')}>
              <CartaoCriacao
                sessaoId={sessao.id}
                criacao={escolhida}
                versoes={versoes}
                aoEscolherVersao={(id) => setEscolhidas((atuais) => ({ ...atuais, [versoes[0].raiz_id]: id }))}
                destacada={versoes.some((v) => v.id === destacadaId)}
                aoAbrir={() => setEditando(escolhida.id)}
                aoNovaVersao={() => criarVersao(escolhida.id)}
                criandoVersao={novaVersao.isPending && novaVersao.variables === escolhida.id}
                aoUsarComoReferencia={usarComoReferencia}
                brollVirandoReferencia={deBroll.isPending ? deBroll.variables : null}
                aoApagar={() => {
                  apagar.reset()
                  setApagando({ criacao: escolhida, versoes })
                }}
              />
            </div>
          )
        })}
      </div>

      {apagando && (
        <Confirmacao
          mensagem={<MensagemApagar {...apagando} />}
          botao="Apagar"
          ocupado={apagar.isPending}
          erro={apagar.isError ? apagar.error.message : null}
          aoCancelar={() => setApagando(null)}
          aoConfirmar={() =>
            apagar.mutate(
              { sessaoId: sessao.id, criacaoId: apagando.criacao.id },
              { onSuccess: () => setApagando(null) },
            )
          }
        />
      )}
    </div>
  )
}

function MensagemApagar({ criacao, versoes }: { criacao: Criacao; versoes: Criacao[] }) {
  const temDerivadas = versoes.some((v) => v.versao_de_id === criacao.id)
  const nome = versoes.length > 1 ? `a v${criacao.numero_versao} deste broll` : 'esta criação'
  return (
    <>
      <p>
        Apagar {nome}? {criacao.brolls.length > 0 && 'Os arquivos serão removidos. '}Não dá para desfazer.
      </p>
      {temDerivadas && (
        <p>As versões que partiram dela continuam; ela aparece como “apagada”.</p>
      )}
      {criacao.situacao === 'gerando' && (
        <p>
          A geração em andamento deixa de ser acompanhada. Se a OpenRouter cobrar, o valor não volta.
        </p>
      )}
    </>
  )
}

// "começa numa imagem · 2 referências de estilo"
function textoReferencias(criacao: Criacao): string {
  const partes: string[] = []
  if (criacao.referencias.some((r) => r.papel === 'primeiro_quadro')) partes.push('começa numa imagem')
  if (criacao.referencias.some((r) => r.papel === 'ultimo_quadro')) partes.push('termina numa imagem')
  const estilo = criacao.referencias.filter((r) => r.papel === 'referencia').length
  if (estilo === 1) partes.push('1 referência de estilo')
  if (estilo > 1) partes.push(`${estilo} referências de estilo`)
  return partes.join(' · ')
}

type PropsCartao = {
  sessaoId: string
  criacao: Criacao // a versão mostrada
  versoes: Criacao[] // todas as versões deste broll
  aoEscolherVersao: (criacaoId: string) => void
  destacada: boolean
  aoAbrir: () => void
  aoNovaVersao: () => void
  criandoVersao: boolean
  aoUsarComoReferencia: (broll: Broll) => void
  brollVirandoReferencia: string | null
  aoApagar: () => void
}

function CartaoCriacao({
  sessaoId,
  criacao,
  versoes,
  aoEscolherVersao,
  destacada,
  aoAbrir,
  aoNovaVersao,
  criandoVersao,
  aoUsarComoReferencia,
  brollVirandoReferencia,
  aoApagar,
}: PropsCartao) {
  const gerar = useGerarCriacao(sessaoId)
  const rascunho = criacao.situacao === 'rascunho'
  const detalhes = [
    criacao.tipo === 'imagem' ? 'Imagem' : 'Vídeo',
    `${criacao.orientacao === 'vertical' ? 'Vertical' : 'Horizontal'}${criacao.proporcao ? ` ${criacao.proporcao}` : ''}`,
    criacao.resolucao,
    criacao.duracao_segundos ? `${criacao.duracao_segundos}s` : null,
  ].filter(Boolean)

  const cabecalho = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-nota text-rotulo-2">
          {versoes.length > 1 && <span className="mr-1.5 font-semibold text-rotulo">v{criacao.numero_versao}</span>}
          {criacao.modelo}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-mini font-semibold ${CORES_SITUACAO[criacao.situacao]}`}>
          {NOMES_SITUACAO[criacao.situacao]}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 font-medium">{criacao.prompt}</p>
      <p className="mt-1.5 text-nota text-rotulo-2">{detalhes.join(' · ')}</p>
      {criacao.referencias.length > 0 && (
        <p className="mt-0.5 text-nota text-rotulo-2">{textoReferencias(criacao)}</p>
      )}
    </>
  )

  return (
    <div
      className={`surgir rounded-2xl bg-superficie p-3.5 transition-shadow duration-300 ${
        destacada ? 'shadow-[0_0_0_2px_var(--ff-azul),var(--ff-sombra-cartao)]' : 'shadow-cartao'
      }`}
    >
      {versoes.length > 1 && (
        <div className="mb-2">
          <SeletorVersoes versoes={versoes} selecionadaId={criacao.id} aoSelecionar={aoEscolherVersao} />
        </div>
      )}
      <button
        type="button"
        onClick={aoAbrir}
        title={rascunho ? 'Editar rascunho' : 'Ver a configuração desta versão'}
        className="block w-full rounded-lg text-left"
      >
        {cabecalho}
      </button>

      {rascunho && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => gerar.mutate(criacao.id)}
            disabled={gerar.isPending}
            className="apertar h-9 w-full rounded-full bg-azul font-semibold text-white hover:bg-azul-forte disabled:bg-preenchimento disabled:text-rotulo-3"
          >
            {gerar.isPending ? 'Enviando…' : 'Gerar'}
          </button>
          {gerar.isError && (
            <p role="alert" className="text-nota text-vermelho-texto">
              {gerar.error.message}
            </p>
          )}
        </div>
      )}

      {criacao.situacao === 'gerando' && (
        <div className="mt-3">
          <ProgressoCriacao iniciadaEm={criacao.iniciada_em} estimativaSegundos={criacao.estimativa_segundos} />
        </div>
      )}

      {criacao.situacao === 'falhou' && (
        <div className="mt-3 space-y-2">
          {criacao.erro && (
            <p role="alert" className="rounded-xl bg-vermelho/10 px-3 py-2 text-vermelho-texto">
              {criacao.erro}
            </p>
          )}
          <button
            type="button"
            onClick={aoNovaVersao}
            disabled={criandoVersao}
            className="apertar h-7 rounded-full bg-azul/12 px-3 font-semibold text-azul hover:bg-azul/20 disabled:opacity-60"
          >
            {criandoVersao ? 'Criando…' : 'Nova versão a partir desta'}
          </button>
        </div>
      )}

      {criacao.situacao !== 'pronto' && criacao.situacao !== 'apagado' && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={aoApagar} className="apertar rounded-md px-1.5 py-0.5 text-nota font-medium text-vermelho-texto hover:bg-vermelho/10">
            Apagar
          </button>
        </div>
      )}

      {criacao.situacao === 'pronto' && (
        <div className="mt-3 space-y-3">
          <ProgressoCriacao iniciadaEm={criacao.iniciada_em} estimativaSegundos={criacao.estimativa_segundos} pronto />
          {criacao.brolls.map((broll) => (
            <PlayerBroll
              key={broll.id}
              broll={broll}
              aoUsarComoReferencia={() => aoUsarComoReferencia(broll)}
              usandoComoReferencia={brollVirandoReferencia === broll.id}
              aoNovaVersao={criandoVersao ? undefined : aoNovaVersao}
              aoApagar={aoApagar}
            />
          ))}
          <p className="text-nota text-rotulo-2">
            {[
              criacao.tempo_gasto_segundos !== null
                ? `Pronto em ${criacao.tempo_gasto_segundos.toLocaleString('pt-BR')} s`
                : null,
              criacao.custo_usd !== null
                ? `custou US$ ${criacao.custo_usd.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      )}
    </div>
  )
}

function ReferenciasDaSessao({ sessao }: { sessao: SessaoCompleta }) {
  const apagar = useApagarReferencia(sessao.id)
  const [removendo, setRemovendo] = useState<Referencia | null>(null)
  const imagens = sessao.referencias.filter((r) => r.tipo === 'imagem')
  if (imagens.length === 0) return null
  return (
    <section className="pb-2">
      <h3 className="mb-2 px-1 text-mini font-semibold text-rotulo-2">Referências da sessão</h3>
      <div className="flex flex-wrap gap-2">
        {imagens.map((referencia) => (
          <div key={referencia.id} className="group relative">
            <a
              href={referencia.url}
              target="_blank"
              rel="noopener noreferrer"
              title={referencia.nome_original ?? 'Imagem de referência'}
              className="block rounded-xl"
            >
              <img
                src={referencia.url}
                alt={referencia.nome_original ?? 'Imagem de referência'}
                className="h-16 w-16 rounded-xl object-cover shadow-cartao transition-transform duration-200 ease-apple hover:scale-105"
              />
            </a>
            <button
              type="button"
              onClick={() => {
                apagar.reset()
                setRemovendo(referencia)
              }}
              aria-label={`Remover ${referencia.nome_original ?? 'imagem'}`}
              title="Remover referência"
              className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-rotulo text-fundo shadow-cartao group-hover:flex focus:flex"
            >
              <IconeFechar className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {removendo && (
        <Confirmacao
          mensagem={
            <p>
              Remover a referência <strong className="font-semibold">“{removendo.nome_original ?? 'imagem'}”</strong>? O arquivo é apagado. Não
              dá para desfazer.
            </p>
          }
          botao="Remover"
          ocupado={apagar.isPending}
          erro={apagar.isError ? apagar.error.message : null}
          aoCancelar={() => setRemovendo(null)}
          aoConfirmar={() => apagar.mutate(removendo.id, { onSuccess: () => setRemovendo(null) })}
        />
      )}
    </section>
  )
}
