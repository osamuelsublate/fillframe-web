import { useSyncExternalStore } from 'react'
import { assinarAvisos, avisosAtuais, fecharAviso } from '../utils/erros'
import { IconeAlerta, IconeFechar } from './Icones'

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
          className="surgir pointer-events-auto flex items-start gap-2.5 rounded-xl bg-elevado px-3.5 py-3 shadow-flutuante"
        >
          <IconeAlerta className="mt-px h-4.5 w-4.5 shrink-0 text-vermelho" />
          <span className="flex-1">{aviso.texto}</span>
          <button
            type="button"
            onClick={() => fecharAviso(aviso.id)}
            aria-label="Fechar aviso"
            className="apertar -m-1 rounded-full p-1 text-rotulo-3 hover:bg-preenchimento-2 hover:text-rotulo"
          >
            <IconeFechar className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
