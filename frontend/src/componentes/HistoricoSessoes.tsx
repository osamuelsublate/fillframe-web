import { useEffect, useRef, useState } from 'react'
import { useApagarSessao, useRenomearSessao, type SessaoResumo } from '../api/sessoes'
import { tempoRelativo } from '../utils/tempo'
import Confirmacao from './Confirmacao'
import { IconeNovo, IconeReticencias } from './Icones'

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
      <div className="px-2.5 pb-1">
        <button
          type="button"
          onClick={aoCriar}
          disabled={criando}
          className="apertar flex h-8 w-full items-center gap-2 rounded-md px-2 font-medium text-azul hover:bg-preenchimento-2 disabled:opacity-60"
        >
          <IconeNovo className="h-4.5 w-4.5" />
          Nova sessão
        </button>
      </div>

      {aviso && (
        <p role="alert" className="mx-3 mb-2 rounded-md bg-vermelho/10 px-2.5 py-1.5 text-nota text-vermelho-texto">
          {aviso}
        </p>
      )}

      <nav aria-label="Sessões" className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        <h2 className="px-2 pt-3 pb-1 text-mini font-semibold text-rotulo-2">Sessões</h2>
        {carregando && <p className="px-2 py-1 text-rotulo-2">Carregando…</p>}
        {erro && <p className="px-2 py-1 text-vermelho-texto">{erro}</p>}
        {!carregando && sessoes?.length === 0 && <p className="px-2 py-1 text-rotulo-2">Nenhuma sessão ainda.</p>}
        <ul className="space-y-px">
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
                    className={`w-full rounded-md py-1.5 pr-8 pl-2 text-left transition-colors duration-150 ${
                      aberta ? 'bg-azul text-white' : 'hover:bg-preenchimento-2'
                    }`}
                  >
                    <span className="block truncate font-medium">{sessao.nome}</span>
                    <span className={`block text-mini ${aberta ? 'text-white/80' : 'text-rotulo-2'}`}>
                      usado {tempoRelativo(sessao.ultimo_uso_em)}
                    </span>
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
                    aria-haspopup="menu"
                    aria-expanded={menuAberto === sessao.id}
                    className={`apertar absolute top-1/2 right-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full ${
                      aberta ? 'text-white hover:bg-white/20' : 'text-rotulo-2 hover:bg-preenchimento hover:text-rotulo'
                    } ${menuAberto === sessao.id ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                  >
                    <IconeReticencias className="h-4 w-4" />
                  </button>
                )}

                {menuAberto === sessao.id && (
                  <div
                    role="menu"
                    className="surgir absolute top-full right-1 z-20 mt-1 w-40 rounded-lg bg-elevado p-1 shadow-flutuante"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuAberto(null)
                        setAviso(null)
                        setRenomeando(sessao.id)
                      }}
                      className="block w-full rounded px-2 py-1 text-left hover:bg-azul hover:text-white"
                    >
                      Renomear
                    </button>
                    <div className="mx-2 my-1 h-px bg-separador" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuAberto(null)
                        apagar.reset()
                        setApagando(sessao)
                      }}
                      className="block w-full rounded px-2 py-1 text-left text-vermelho-texto hover:bg-vermelho hover:text-white"
                    >
                      Apagar…
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {apagando && (
        <Confirmacao
          titulo="Apagar sessão?"
          mensagem={
            <p>
              A sessão <strong className="font-semibold text-rotulo">“{apagando.nome}”</strong> e todos os brolls dela
              serão apagados. Não dá para desfazer.
            </p>
          }
          botao="Apagar"
          ocupado={apagar.isPending}
          erro={apagar.isError ? apagar.error.message : null}
          aoConfirmar={confirmarApagar}
          aoCancelar={() => setApagando(null)}
        />
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
      className="w-full rounded-md bg-fundo px-2 py-2 font-medium shadow-cartao outline-3 outline-azul/50"
    />
  )
}
