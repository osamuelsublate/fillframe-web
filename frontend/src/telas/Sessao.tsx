import { useCallback, useEffect, useRef, useState } from 'react'
import { ErroApi } from '../api/cliente'
import { useCriarSessao, useSessao, useSessoes, type SessaoCompleta } from '../api/sessoes'
import { useStatus } from '../api/sistema'
import AvisoChave from '../componentes/AvisoChave'
import Chat, { SeletorLlm, type AnexoExterno } from '../componentes/Chat'
import HistoricoSessoes from '../componentes/HistoricoSessoes'
import { IconeLateral, IconePainel } from '../componentes/Icones'
import Painel, { type Destaque } from '../componentes/Painel'

function sessaoDaUrl(): string | null {
  return new URLSearchParams(window.location.search).get('sessao')
}

// Tela única: histórico à esquerda, chat no centro, painel à direita.
export default function Sessao() {
  const [historicoAberto, setHistoricoAberto] = useState(true)
  const [painelAberto, setPainelAberto] = useState(true)
  // Criação em destaque no painel (quando a LLM prepara um rascunho ou a pessoa clica em "revisar").
  const [destaque, setDestaque] = useState<Destaque | null>(null)
  // Imagem que a Galeria mandou para a caixa do chat (`vez` muda a cada envio).
  const [anexoExterno, setAnexoExterno] = useState<AnexoExterno | null>(null)
  const [sessaoId, setSessaoId] = useState<string | null>(sessaoDaUrl)
  const [aviso, setAviso] = useState<string | null>(null)
  const criandoPrimeira = useRef(false)

  const sessoes = useSessoes()
  const sessao = useSessao(sessaoId)
  const criarSessao = useCriarSessao()

  // A sessão aberta fica na URL (?sessao=id), para sobreviver ao recarregar.
  const abrir = useCallback((id: string | null, substituir = false) => {
    setSessaoId(id)
    const url = id ? `?sessao=${encodeURIComponent(id)}` : window.location.pathname
    if (substituir) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
  }, [])

  // Voltar/avançar do navegador.
  useEffect(() => {
    const aoNavegar = () => setSessaoId(sessaoDaUrl())
    window.addEventListener('popstate', aoNavegar)
    return () => window.removeEventListener('popstate', aoNavegar)
  }, [])

  // Sem sessão na URL: abre a de uso mais recente, ou cria uma nova se não houver nenhuma.
  useEffect(() => {
    if (sessaoId !== null || !sessoes.data) return
    if (sessoes.data.length > 0) {
      abrir(sessoes.data[0].id, true)
    } else if (!criandoPrimeira.current) {
      criandoPrimeira.current = true
      criarSessao.mutate({}, { onSuccess: (nova) => abrir(nova.id, true) })
    }
  }, [sessaoId, sessoes.data, abrir, criarSessao])

  // Sessão da URL não existe: avisa e volta para a última sessão.
  useEffect(() => {
    if (sessao.error instanceof ErroApi && sessao.error.status === 404) {
      setAviso(sessao.error.message)
      abrir(null, true)
    }
  }, [sessao.error, abrir])

  useEffect(() => {
    if (!aviso) return
    const tempo = window.setTimeout(() => setAviso(null), 5000)
    return () => window.clearTimeout(tempo)
  }, [aviso])

  function novaSessao() {
    criarSessao.mutate({}, { onSuccess: (nova) => abrir(nova.id) })
  }

  return (
    <div className="flex h-full overflow-hidden">
      {historicoAberto && (
        <aside className="flex w-64 shrink-0 flex-col border-r border-stone-200 bg-stone-100">
          <div className="flex h-12 items-center justify-between px-3">
            <span className="font-semibold tracking-tight">FillFrame</span>
            <BotaoIcone titulo="Fechar histórico" aoClicar={() => setHistoricoAberto(false)}>
              <IconeLateral className="h-5 w-5" />
            </BotaoIcone>
          </div>
          <HistoricoSessoes
            sessoes={sessoes.data}
            carregando={sessoes.isPending}
            erro={sessoes.isError ? sessoes.error.message : null}
            sessaoAbertaId={sessaoId}
            criando={criarSessao.isPending}
            aoAbrir={(id) => id !== sessaoId && abrir(id)}
            aoCriar={novaSessao}
            // Apagou a sessão aberta: vai para a próxima do histórico (ou cria uma nova).
            aoApagar={(id) => id === sessaoId && abrir(null, true)}
          />
        </aside>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-stone-200 px-3">
          <div className="flex min-w-0 items-center gap-2">
            {!historicoAberto && (
              <BotaoIcone titulo="Abrir histórico" aoClicar={() => setHistoricoAberto(true)}>
                <IconeLateral className="h-5 w-5" />
              </BotaoIcone>
            )}
            <span className="truncate text-sm text-stone-600">{sessao.data?.nome ?? ''}</span>
          </div>
          <div className="flex items-center gap-2">
            {sessao.data && <SeletorLlm key={sessao.data.id} sessao={sessao.data} />}
            {!painelAberto && (
              <BotaoIcone titulo="Abrir painel" aoClicar={() => setPainelAberto(true)}>
                <IconePainel className="h-5 w-5" />
              </BotaoIcone>
            )}
          </div>
        </header>

        {aviso && (
          <div
            role="alert"
            className="absolute top-14 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 shadow-sm"
          >
            {aviso}
          </div>
        )}

        <div className="min-h-0 flex-1">
          <AreaChat
            sessao={sessao.data}
            anexoExterno={anexoExterno}
            aoRevisarCriacao={(criacaoId, editar) => {
              setPainelAberto(true)
              setDestaque((atual) => ({ criacaoId, editar, vez: (atual?.vez ?? 0) + 1 }))
            }}
          />
        </div>
      </main>

      {painelAberto && (
        <Painel
          sessao={sessao.data}
          destaque={destaque}
          aoMandarParaChat={(referencia) =>
            setAnexoExterno((atual) => ({ referencia, vez: (atual?.vez ?? 0) + 1 }))
          }
          cabecalho={
            <BotaoIcone titulo="Fechar painel" aoClicar={() => setPainelAberto(false)}>
              <IconePainel className="h-5 w-5" />
            </BotaoIcone>
          }
        />
      )}
    </div>
  )
}

type PropsAreaChat = {
  sessao: SessaoCompleta | undefined
  anexoExterno: AnexoExterno | null
  aoRevisarCriacao: (criacaoId: string, editar: boolean) => void
}

function AreaChat({ sessao, anexoExterno, aoRevisarCriacao }: PropsAreaChat) {
  const status = useStatus()

  if (status.isPending) {
    return <div className="flex h-full items-center justify-center text-sm text-stone-500">Carregando…</div>
  }

  if (status.isError) {
    return <AvisoChave titulo="Backend fora do ar" mensagem={status.error.message} />
  }

  if (!status.data.chave_configurada || !status.data.chave_valida) {
    return (
      <AvisoChave
        titulo="Chave da OpenRouter"
        mensagem="A chave da OpenRouter não está configurada (ou é inválida). Coloque-a em backend/.env e reinicie o backend."
      />
    )
  }

  if (!sessao) {
    return <div className="flex h-full items-center justify-center text-sm text-stone-500">Carregando…</div>
  }

  // key: ao trocar de sessão, o chat começa do zero (rascunho e resposta em andamento).
  return (
    <Chat key={sessao.id} sessao={sessao} anexoExterno={anexoExterno} aoRevisarCriacao={aoRevisarCriacao} />
  )
}

type PropsBotaoIcone = {
  titulo: string
  aoClicar: () => void
  children: React.ReactNode
}

function BotaoIcone({ titulo, aoClicar, children }: PropsBotaoIcone) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={aoClicar}
      className="rounded-md p-1.5 text-stone-500 hover:bg-stone-200 hover:text-stone-900"
    >
      {children}
    </button>
  )
}
