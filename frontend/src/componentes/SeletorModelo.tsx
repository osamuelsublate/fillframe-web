import { useState } from 'react'
import { useAtualizarModelos, useModelos, type ModeloMidia, type TipoMidia } from '../api/modelos'
import { useStatus } from '../api/sistema'
import { textoPreco } from '../utils/preco'
import { minutosESegundos, tempoRelativo } from '../utils/tempo'

type Props = {
  tipo: TipoMidia
  modeloId: string | null
  aoEscolher: (modelo: ModeloMidia) => void
}

export default function SeletorModelo({ tipo, modeloId, aoEscolher }: Props) {
  const [busca, setBusca] = useState('')

  const modelos = useModelos(tipo, busca)
  const atualizar = useAtualizarModelos()
  const status = useStatus()
  const atualizadoEm = status.data?.catalogo_atualizado_em

  return (
    <div className="flex flex-col">
      <div className="space-y-2 border-b border-separador p-3">
        <div className="flex items-center gap-2">
          {atualizadoEm && (
            <p className="text-nota text-rotulo-2">Lista atualizada {tempoRelativo(atualizadoEm)}</p>
          )}
          <button
            type="button"
            onClick={() => atualizar.mutate()}
            disabled={atualizar.isPending}
            className="apertar ml-auto shrink-0 rounded-md px-2 py-1 text-nota font-medium text-azul hover:bg-azul/10 disabled:opacity-60"
          >
            {atualizar.isPending ? 'Atualizando…' : 'Atualizar lista'}
          </button>
        </div>

        <input
          type="search"
          aria-label="Buscar modelo"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder={tipo === 'imagem' ? 'Buscar modelo de imagem…' : 'Buscar modelo de vídeo…'}
          className="w-full rounded-lg bg-preenchimento-3 px-3 py-1.5 placeholder:text-rotulo-3 hover:bg-preenchimento-2"
        />

        {atualizar.isError && (
          <p role="alert" className="rounded-lg bg-vermelho/10 px-2.5 py-1.5 text-nota text-vermelho-texto">
            {atualizar.error.message}
          </p>
        )}
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto p-3">
        {modelos.isPending && <p className="text-rotulo-2">Carregando modelos…</p>}
        {modelos.isError && <p className="text-vermelho-texto">{modelos.error.message}</p>}
        {modelos.data?.length === 0 &&
          (busca.trim() ? (
            <p className="text-rotulo-2">Nenhum modelo encontrado para “{busca.trim()}”.</p>
          ) : (
            <p className="text-rotulo-2">Buscando os modelos na OpenRouter…</p>
          ))}
        {modelos.data?.map((modelo) => (
          <CartaoModelo
            key={modelo.id}
            modelo={modelo}
            tipo={tipo}
            selecionado={modelo.id === modeloId}
            aoSelecionar={() => aoEscolher(modelo)}
          />
        ))}
      </div>
    </div>
  )
}

type PropsCartao = {
  modelo: ModeloMidia
  tipo: TipoMidia
  selecionado: boolean
  aoSelecionar?: () => void
}

export function CartaoModelo({ modelo, tipo, selecionado, aoSelecionar }: PropsCartao) {
  const { capacidades } = modelo
  const extras: string[] = []
  if (capacidades.aceita_primeiro_quadro) extras.push('parte de uma imagem')
  if (capacidades.gera_audio) extras.push('gera áudio')
  if (tipo === 'imagem' && capacidades.aceita_referencia) {
    extras.push(`até ${capacidades.max_referencias} referências`)
  }

  return (
    <button
      type="button"
      onClick={aoSelecionar}
      title={modelo.descricao}
      aria-label={modelo.nome}
      className={`block w-full rounded-xl p-3 text-left transition-colors duration-150 ${
        selecionado ? 'bg-azul/10 shadow-[inset_0_0_0_1.5px_var(--ff-azul)]' : 'bg-preenchimento-3 hover:bg-preenchimento-2'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-semibold">{modelo.nome}</span>
      </div>
      <p className="mt-0.5 text-nota text-rotulo-2">
        {textoPreco(modelo.precos.resumo)}
        {modelo.tempo_medio_segundos !== null && (
          <span> · tempo médio: {minutosESegundos(modelo.tempo_medio_segundos)}</span>
        )}
      </p>

      <dl className="mt-2 space-y-1 text-nota">
        <Linha rotulo="Proporções" valores={capacidades.proporcoes} />
        {tipo === 'video' && (
          <Linha rotulo="Durações" valores={textoDuracoes(capacidades.duracoes)} />
        )}
        <Linha rotulo="Resoluções" valores={capacidades.resolucoes} />
      </dl>

      {extras.length > 0 && <p className="mt-2 text-nota text-rotulo-2">{extras.join(' · ')}</p>}
    </button>
  )
}

// [2, 3, 4, …, 30] vira "2 a 30s"; [4, 6, 8] fica "4s", "6s", "8s".
function textoDuracoes(lista: number[]): string[] {
  const duracoes = [...lista].sort((a, b) => a - b)
  const seguidas = duracoes.every((d, i) => i === 0 || d === duracoes[i - 1] + 1)
  if (duracoes.length > 4 && seguidas) return [`${duracoes[0]} a ${duracoes[duracoes.length - 1]}s`]
  return duracoes.map((d) => `${d}s`)
}

function Linha({ rotulo, valores }: { rotulo: string; valores: string[] }) {
  if (valores.length === 0) return null
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-rotulo-2">{rotulo}</dt>
      <dd className="flex flex-wrap gap-1">
        {valores.map((valor) => (
          <span key={valor} className="rounded-md bg-fundo px-1.5 py-0.5 font-medium shadow-cartao">
            {valor}
          </span>
        ))}
      </dd>
    </div>
  )
}
