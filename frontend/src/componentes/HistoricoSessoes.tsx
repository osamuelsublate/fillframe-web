import { useEffect, useRef, useState } from 'react'
import { useApagarSessao, useRenomearSessao, type SessaoResumo } from '../api/sessoes'
import { tempoRelativo } from '../utils/tempo'

type Props = {
  sessoes: SessaoResumo[] | undefined
  carregando: boolean
  erro: string | null
  sessaoAbertaId: string | null
  criando: boolean
  aoAbrir: (id: string) => void
  aoCriar: () => void
  aoApagar: (id: string) => void
}

export default function HistoricoSessoes({
  sessoes,
  carregando,
  erro,
  sessaoAbertaId,
  criando,
  aoAbrir,
  aoCriar,
  aoApagar,
}: Props) {
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [apagando, setApagando] = useState<SessaoResumo | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const renomear = useRenomearSessao()
  const apagar = useApagarSessao()

  // O aviso some sozinho depois de alguns segundos.
  useEffect(() => {
    if (!aviso) return
    const tempo = window.setTimeout(() => setAviso(null), 4000)
    return () => window.clearTimeout(tempo)
  }, [aviso])

  // Clique fora fecha o menu.
  useEffect(() => {
    if (!menuAberto) return
    const fechar = () => setMenuAberto(null)
    window.addEventListener('click', fechar)
    return () => window.removeEventListener('click', fechar)
  }, [menuAberto])

  function salvarNome(sessao: SessaoResumo, nome: string) {
    setRenomeando(null)
    const limpo = nome.trim()
    if (!limpo) {
      setAviso('O nome não pode ficar vazio')
      return
    }
    setAviso(null)
    if (limpo !== sessao.nome) {
      renomear.mutate({ id: sessao.id, nome: limpo }, { onError: (falha) => setAviso(falha.message) })
    }
  }

  function confirmarApagar() {
    if (!apagando) return
    const id = apagando.id
    apagar.mutate(id, {
      onSuccess: () => {
        setApagando(null)
        aoApagar(id)
      },
    })
  }

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

      {aviso && (
        <p role="alert" className="mx-3 mb-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
          {aviso}
        </p>
      )}

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
              <li key={sessao.id} className="group relative">
                {renomeando === sessao.id ? (
                  <CampoNome
                    nomeAtual={sessao.nome}
                    aoSalvar={(nome) => salvarNome(sessao, nome)}
                    aoCancelar={() => setRenomeando(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => aoAbrir(sessao.id)}
                    aria-current={aberta ? 'page' : undefined}
                    className={`w-full rounded-md py-1.5 pr-8 pl-2 text-left ${
                      aberta ? 'bg-stone-300/70' : 'hover:bg-stone-200'
                    }`}
                  >
                    <span className="block truncate text-sm">{sessao.nome}</span>
                    <span className="block text-xs text-stone-500">usado {tempoRelativo(sessao.ultimo_uso_em)}</span>
                  </button>
                )}

                {renomeando !== sessao.id && (
                  <button
                    type="button"
                    onClick={(evento) => {
                      evento.stopPropagation()
                      setMenuAberto(menuAberto === sessao.id ? null : sessao.id)
                    }}
                    aria-label={`Opções da sessão ${sessao.nome}`}
                    aria-expanded={menuAberto === sessao.id}
                    className={`absolute top-1.5 right-1 rounded px-1.5 text-stone-500 hover:bg-stone-300 hover:text-stone-900 ${
                      menuAberto === sessao.id ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                    }`}
                  >
                    …
                  </button>
                )}

                {menuAberto === sessao.id && (
                  <div
                    role="menu"
                    className="absolute top-8 right-1 z-20 w-36 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 text-sm shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuAberto(null)
                        setAviso(null)
                        setRenomeando(sessao.id)
                      }}
                      className="block w-full px-3 py-1.5 text-left hover:bg-stone-100"
                    >
                      Renomear
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuAberto(null)
                        apagar.reset()
                        setApagando(sessao)
                      }}
                      className="block w-full px-3 py-1.5 text-left text-red-700 hover:bg-red-50"
                    >
                      Apagar
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {apagando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div role="alertdialog" aria-labelledby="titulo-apagar" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <p id="titulo-apagar" className="text-sm leading-relaxed">
              Apagar a sessão <strong>“{apagando.nome}”</strong> e todos os brolls dela? Não dá para desfazer.
            </p>
            {apagar.isError && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {apagar.error.message}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApagando(null)}
                disabled={apagar.isPending}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarApagar}
                disabled={apagar.isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {apagar.isPending ? 'Apagando…' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type PropsCampoNome = {
  nomeAtual: string
  aoSalvar: (nome: string) => void
  aoCancelar: () => void
}

// Edição do nome na própria linha: Enter (ou clicar fora) salva, Esc cancela.
function CampoNome({ nomeAtual, aoSalvar, aoCancelar }: PropsCampoNome) {
  const [nome, setNome] = useState(nomeAtual)
  const terminou = useRef(false) // salvo ou cancelado: o blur que vem depois não faz nada

  function terminar(salvar: boolean) {
    if (terminou.current) return
    terminou.current = true
    if (salvar) aoSalvar(nome)
    else aoCancelar()
  }

  return (
    <input
      autoFocus
      value={nome}
      maxLength={120}
      aria-label="Novo nome da sessão"
      onFocus={(evento) => evento.target.select()}
      onChange={(evento) => setNome(evento.target.value)}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter') terminar(true)
        if (evento.key === 'Escape') terminar(false)
      }}
      onBlur={() => terminar(true)}
      className="w-full rounded-md border border-stone-400 bg-white px-2 py-1.5 text-sm outline-none"
    />
  )
}
