import { useState } from 'react'
import type { Referencia } from '../api/referencias'
import type { SessaoCompleta } from '../api/sessoes'
import AbaCriacao from './AbaCriacao'
import AbaGaleria from './AbaGaleria'

type Aba = 'criacao' | 'galeria'

// `vez` muda a cada pedido, mesmo que seja a mesma criação de novo.
export type Destaque = { criacaoId: string; editar: boolean; vez: number }

type Props = {
  sessao: SessaoCompleta | undefined
  destaque: Destaque | null
  aoMandarParaChat: (referencia: Referencia) => void
  cabecalho: React.ReactNode
}

// Painel da direita, com as abas Criação e Galeria.
export default function Painel({ sessao, destaque, aoMandarParaChat, cabecalho }: Props) {
  const [aba, setAba] = useState<Aba>('criacao')
  const [vezVista, setVezVista] = useState(destaque?.vez)

  // Um novo destaque traz a aba Criação para a frente.
  if (destaque && destaque.vez !== vezVista) {
    setVezVista(destaque.vez)
    setAba('criacao')
  }

  return (
    <aside className="relative flex w-[28rem] shrink-0 flex-col border-l border-stone-200 bg-white">
      <div className="flex h-12 items-center justify-between border-b border-stone-200 px-3">
        <div className="flex gap-1 text-sm">
          <BotaoAba ativa={aba === 'criacao'} aoClicar={() => setAba('criacao')}>
            Criação
          </BotaoAba>
          <BotaoAba ativa={aba === 'galeria'} aoClicar={() => setAba('galeria')}>
            Galeria
          </BotaoAba>
        </div>
        {cabecalho}
      </div>

      {!sessao ? (
        <div className="flex flex-1 items-center justify-center text-sm text-stone-500">Carregando…</div>
      ) : aba === 'criacao' ? (
        // key: ao trocar de sessão, a aba volta para a lista.
        <AbaCriacao key={sessao.id} sessao={sessao} destaque={destaque} />
      ) : (
        <AbaGaleria key={sessao.id} sessao={sessao} aoMandarParaChat={aoMandarParaChat} />
      )}
    </aside>
  )
}

function BotaoAba({
  ativa,
  aoClicar,
  children,
}: {
  ativa: boolean
  aoClicar: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={`rounded-md px-2.5 py-1 ${
        ativa ? 'bg-stone-100 font-medium text-stone-900' : 'text-stone-500 hover:text-stone-900'
      }`}
    >
      {children}
    </button>
  )
}
