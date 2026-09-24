type Props = {
  titulo: string
  mensagem: string
}

export default function AvisoChave({ titulo, mensagem }: Props) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900 shadow-sm">
        <p className="font-semibold">{titulo}</p>
        <p className="mt-2 text-sm leading-relaxed">{mensagem}</p>
      </div>
    </div>
  )
}
