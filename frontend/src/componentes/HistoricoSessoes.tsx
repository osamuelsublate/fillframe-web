import type { SessaoResumo } from '../api/sessoes'
import { tempoRelativo } from '../utils/tempo'

type Props = {
  sessoes: SessaoResumo[] | undefined
  carregando: boolean
  erro: string | null
  sessaoAbertaId: string | null
  criando: boolean
  aoAbrir: (id: string) => void
  aoCriar: () => void
}

export default function HistoricoSessoes({
  sessoes,
  carregando,
  erro,
  sessaoAbertaId,
  criando,
  aoAbrir,
  aoCriar,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={aoCriar}
          disabled={criando}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-left text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
        >
          + Nova sessão
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {carregando && <p className="px-2 py-1 text-sm text-stone-500">Carregando…</p>}
        {erro && <p className="px-2 py-1 text-sm text-red-700">{erro}</p>}
        {!carregando && sessoes?.length === 0 && (
          <p className="px-2 py-1 text-sm text-stone-500">Nenhuma sessão ainda.</p>
        )}
        <ul className="space-y-0.5">
          {sessoes?.map((sessao) => {
            const aberta = sessao.id === sessaoAbertaId
            return (
              <li key={sessao.id}>
                <button
                  type="button"
                  onClick={() => aoAbrir(sessao.id)}
                  aria-current={aberta ? 'page' : undefined}
                  className={`w-full rounded-md px-2 py-1.5 text-left ${
                    aberta ? 'bg-stone-300/70' : 'hover:bg-stone-200'
                  }`}
                >
                  <span className="block truncate text-sm">{sessao.nome}</span>
                  <span className="block text-xs text-stone-500">
                    usado {tempoRelativo(sessao.ultimo_uso_em)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
