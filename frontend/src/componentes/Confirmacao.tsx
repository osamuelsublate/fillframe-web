import { useEffect, useId, type ReactNode } from 'react'

type Props = {
  titulo?: string // ex.: "Apagar sessão?"
  mensagem: ReactNode
  botao: string // ex.: "Apagar"
  ocupado: boolean
  erro: string | null
  aoConfirmar: () => void
  aoCancelar: () => void
}

// Diálogo de confirmação para ações que não dá para desfazer, no formato de alerta da Apple.
export default function Confirmacao({ titulo, mensagem, botao, ocupado, erro, aoConfirmar, aoCancelar }: Props) {
  const idTitulo = useId()
  const idMensagem = useId()

  // Esc cancela, como nos alertas do Mac.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !ocupado) aoCancelar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [ocupado, aoCancelar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-veu p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titulo ? idTitulo : undefined}
        aria-describedby={idMensagem}
        className="surgir w-full max-w-[300px] rounded-2xl bg-elevado p-5 text-center shadow-flutuante"
      >
        {titulo && (
          <h2 id={idTitulo} className="text-ui font-semibold">
            {titulo}
          </h2>
        )}
        <div id={idMensagem} className={`space-y-2 ${titulo ? 'mt-1.5 text-nota text-rotulo-2' : 'text-ui'}`}>
          {mensagem}
        </div>
        {erro && (
          <p role="alert" className="mt-3 text-nota text-vermelho-texto">
            {erro}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={aoCancelar}
            disabled={ocupado}
            className="apertar h-8 flex-1 rounded-lg bg-preenchimento-2 font-medium hover:bg-preenchimento disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aoConfirmar}
            disabled={ocupado}
            className="apertar h-8 flex-1 rounded-lg bg-vermelho font-medium text-white hover:brightness-95 disabled:opacity-60"
          >
            {ocupado ? 'Apagando…' : botao}
          </button>
        </div>
      </div>
    </div>
  )
}
