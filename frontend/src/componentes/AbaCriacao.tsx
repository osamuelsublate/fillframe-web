import { useEffect, useRef, useState } from 'react'
import { useGerarCriacao, type Criacao, type Situacao } from '../api/criacoes'
import type { SessaoCompleta } from '../api/sessoes'
import ConfigCriacao from './ConfigCriacao'
import type { Destaque } from './Painel'
import PlayerBroll from './PlayerBroll'
import ProgressoCriacao from './ProgressoCriacao'

const NOMES_SITUACAO: Record<Situacao, string> = {
  rascunho: 'Rascunho',
  gerando: 'Gerando',
  pronto: 'Pronto',
  falhou: 'Falhou',
  apagado: 'Apagado',
}

const CORES_SITUACAO: Record<Situacao, string> = {
  rascunho: 'bg-stone-100 text-stone-700',
  gerando: 'bg-amber-100 text-amber-800',
  pronto: 'bg-emerald-100 text-emerald-800',
  falhou: 'bg-red-100 text-red-800',
  apagado: 'bg-stone-100 text-stone-400',
}

type Props = {
  sessao: SessaoCompleta
  destaque: Destaque | null
}

// Aba Criação: lista das criações da sessão, ou a configuração de uma delas.
export default function AbaCriacao({ sessao, destaque }: Props) {
  // null: lista; 'nova': criação nova; id: editando esse rascunho.
  const [editando, setEditando] = useState<string | null>(null)
  const [vezVista, setVezVista] = useState(destaque?.vez)
  const lista = useRef<HTMLDivElement>(null)

  // Destaque novo: "revisar" abre o rascunho; um rascunho recém-preparado só fica marcado na lista.
  if (destaque && destaque.vez !== vezVista) {
    setVezVista(destaque.vez)
    const criacao = sessao.criacoes.find((c) => c.id === destaque.criacaoId)
    setEditando(destaque.editar && criacao?.situacao === 'rascunho' ? destaque.criacaoId : null)
  }
  const destacadaId = destaque && !editando ? destaque.criacaoId : null

  useEffect(() => {
    if (!destacadaId) return
    lista.current?.querySelector(`[data-criacao="${destacadaId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [destacadaId, destaque?.vez, sessao.criacoes.length])

  if (editando) {
    const criacao = sessao.criacoes.find((c) => c.id === editando) ?? null
    return (
      <ConfigCriacao
        key={editando}
        sessaoId={sessao.id}
        criacao={criacao}
        aoFechar={() => setEditando(null)}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-stone-200 p-3">
        <button
          type="button"
          onClick={() => setEditando('nova')}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50"
        >
          + Nova criação
        </button>
      </div>

      <div ref={lista} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {sessao.criacoes.length === 0 && (
          <p className="py-6 text-center text-sm text-stone-500">
            Nenhuma criação nesta sessão ainda.
          </p>
        )}
        {sessao.criacoes.map((criacao) => (
          <CartaoCriacao
            key={criacao.id}
            sessaoId={sessao.id}
            criacao={criacao}
            destacada={criacao.id === destacadaId}
            aoEditar={() => setEditando(criacao.id)}
          />
        ))}
      </div>
    </div>
  )
}

type PropsCartao = {
  sessaoId: string
  criacao: Criacao
  destacada: boolean
  aoEditar: () => void
}

function CartaoCriacao({ sessaoId, criacao, destacada, aoEditar }: PropsCartao) {
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
        <span className="truncate text-xs text-stone-500">{criacao.modelo}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CORES_SITUACAO[criacao.situacao]}`}>
          {NOMES_SITUACAO[criacao.situacao]}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm">{criacao.prompt}</p>
      <p className="mt-1.5 text-xs text-stone-500">{detalhes.join(' · ')}</p>
    </>
  )

  return (
    <div
      data-criacao={criacao.id}
      className={`rounded-lg border p-3 transition-shadow ${
        destacada ? 'border-stone-800 ring-2 ring-amber-300' : 'border-stone-200'
      }`}
    >
      {rascunho ? (
        <button type="button" onClick={aoEditar} title="Editar rascunho" className="block w-full text-left">
          {cabecalho}
        </button>
      ) : (
        cabecalho
      )}

      {rascunho && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => gerar.mutate(criacao.id)}
            disabled={gerar.isPending}
            className="w-full rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:bg-stone-300"
          >
            {gerar.isPending ? 'Enviando…' : 'Gerar'}
          </button>
          {gerar.isError && (
            <p role="alert" className="text-sm text-red-700">
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

      {criacao.situacao === 'falhou' && criacao.erro && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-800">
          {criacao.erro}
        </p>
      )}

      {criacao.situacao === 'pronto' && (
        <div className="mt-3 space-y-3">
          <ProgressoCriacao iniciadaEm={criacao.iniciada_em} estimativaSegundos={criacao.estimativa_segundos} pronto />
          {criacao.brolls.map((broll) => (
            <PlayerBroll key={broll.id} broll={broll} />
          ))}
          <p className="text-xs text-stone-500">
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
