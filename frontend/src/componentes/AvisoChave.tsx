import { IconeAlerta } from './Icones'

type Props = {
  titulo: string
  mensagem: string
}

export default function AvisoChave({ titulo, mensagem }: Props) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="surgir flex max-w-sm flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-laranja/15">
          <IconeAlerta className="h-6 w-6 text-laranja" />
        </span>
        <p className="mt-3 text-titulo font-semibold">{titulo}</p>
        <p className="mt-1.5 leading-relaxed text-rotulo-2">{mensagem}</p>
      </div>
    </div>
  )
}
