import { useSyncExternalStore } from 'react'
import { assinarAvisos, avisosAtuais, fecharAviso } from '../utils/erros'

// Avisos de erro no canto da tela (para falhas que não aparecem num lugar próprio).
export default function Avisos() {
  const avisos = useSyncExternalStore(assinarAvisos, avisosAtuais)
  if (avisos.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          role="alert"
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-800 shadow-lg"
        >
          <span className="flex-1">{aviso.texto}</span>
          <button
            type="button"
            onClick={() => fecharAviso(aviso.id)}
            aria-label="Fechar aviso"
            className="text-stone-400 hover:text-stone-700"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
