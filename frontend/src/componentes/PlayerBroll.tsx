import type { Broll } from '../api/criacoes'

type Props = {
  broll: Broll
}

// Mostra o broll pronto (imagem ou vídeo) com o botão de baixar.
export default function PlayerBroll({ broll }: Props) {
  const ehVideo = broll.formato.startsWith('video/')

  return (
    <div className="space-y-2">
      <div className="flex justify-center overflow-hidden rounded-lg bg-stone-100">
        {ehVideo ? (
          // preload="metadata": o primeiro quadro do vídeo serve de miniatura.
          <video src={broll.url} controls preload="metadata" playsInline className="max-h-[28rem] w-auto" />
        ) : (
          <a href={broll.url} target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real">
            <img
              src={broll.url}
              alt="Imagem gerada"
              width={broll.largura ?? undefined}
              height={broll.altura ?? undefined}
              className="max-h-[28rem] w-auto object-contain"
            />
          </a>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span>
          {broll.largura && broll.altura ? `${broll.largura}×${broll.altura} · ` : ''}
          {broll.duracao_segundos ? `${broll.duracao_segundos.toLocaleString('pt-BR')} s · ` : ''}
          {(broll.tamanho_bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB
        </span>
        <a
          href={`${broll.url}?download=1`}
          download
          className="rounded-md border border-stone-300 px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-50"
        >
          Baixar
        </a>
      </div>
    </div>
  )
}
