import { useState } from 'react'
import type { Referencia } from '../api/referencias'
import type { SessaoCompleta } from '../api/sessoes'
import AbaCriacao from './AbaCriacao'
import AbaGaleria from './AbaGaleria'
import Segmentado from './Segmentado'

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
    <aside className="relative flex w-[min(28rem,45vw)] shrink-0 flex-col border-l border-separador bg-agrupado">
      <div className="flex h-13 shrink-0 items-center justify-between gap-2 border-b border-separador bg-fundo px-3">
        <Segmentado
          nome="Abas do painel"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: 'criacao', rotulo: 'Criação' },
            { valor: 'galeria', rotulo: 'Galeria' },
          ]}
        />
        {cabecalho}
      </div>

      {!sessao ? (
        <div className="flex flex-1 items-center justify-center text-rotulo-2">Carregando…</div>
      ) : aba === 'criacao' ? (
        // key: ao trocar de sessão, a aba volta para a lista.
        <AbaCriacao key={sessao.id} sessao={sessao} destaque={destaque} />
      ) : (
        <AbaGaleria key={sessao.id} sessao={sessao} aoMandarParaChat={aoMandarParaChat} />
      )}
    </aside>
  )
}
