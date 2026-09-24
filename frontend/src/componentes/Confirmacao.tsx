import type { ReactNode } from 'react'

type Props = {
  mensagem: ReactNode
  botao: string // ex.: "Apagar"
  ocupado: boolean
  erro: string | null
  aoConfirmar: () => void
  aoCancelar: () => void
}

// Diálogo de confirmação para ações que não dá para desfazer.
export default function Confirmacao({ mensagem, botao, ocupado, erro, aoConfirmar, aoCancelar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div role="alertdialog" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div className="space-y-2 text-sm leading-relaxed">{mensagem}</div>
        {erro && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {erro}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={aoCancelar}
            disabled={ocupado}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aoConfirmar}
            disabled={ocupado}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {ocupado ? 'Apagando…' : botao}
          </button>
        </div>
      </div>
    </div>
  )
}
