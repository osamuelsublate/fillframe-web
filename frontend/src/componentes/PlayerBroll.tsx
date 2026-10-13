import type { Broll } from '../api/criacoes'

type Props = {
  broll: Broll
  aoUsarComoReferencia?: () => void
  usandoComoReferencia?: boolean
  aoNovaVersao?: () => void
  aoApagar?: () => void
}

// Mostra o broll pronto (imagem ou vídeo) com o botão de baixar.
export default function PlayerBroll({
  broll,
  aoUsarComoReferencia,
  usandoComoReferencia = false,
  aoNovaVersao,
  aoApagar,
}: Props) {
  const ehVideo = broll.formato.startsWith('video/')

  return (
    <div className="space-y-2">
      <div className="flex justify-center overflow-hidden rounded-xl bg-preenchimento-3">
        {ehVideo ? (
          // preload="metadata": o primeiro quadro do vídeo serve de miniatura.
          <video src={broll.url} controls preload="metadata" playsInline className="max-h-[28rem] w-auto" />
        ) : (
          <a href={broll.url} target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real" className="block">
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
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 text-nota">
        <span className="text-rotulo-2">
          {broll.largura && broll.altura ? `${broll.largura}×${broll.altura} · ` : ''}
          {broll.duracao_segundos ? `${broll.duracao_segundos.toLocaleString('pt-BR')} s · ` : ''}
          {(broll.tamanho_bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {aoNovaVersao && (
            <button
              type="button"
              onClick={aoNovaVersao}
              title="Abre um rascunho novo com a mesma configuração, para você ajustar"
              className="apertar h-7 rounded-full bg-preenchimento-3 px-3 font-semibold text-rotulo hover:bg-preenchimento-2"
            >
              Nova versão a partir desta
            </button>
          )}
          {!ehVideo && aoUsarComoReferencia && (
            <button
              type="button"
              onClick={aoUsarComoReferencia}
              disabled={usandoComoReferencia}
              title="Cria um vídeo que começa nesta imagem"
              className="apertar h-7 rounded-full bg-preenchimento-3 px-3 font-semibold text-rotulo hover:bg-preenchimento-2 disabled:opacity-60"
            >
              {usandoComoReferencia ? 'Preparando…' : 'Usar como referência'}
            </button>
          )}
          <a
            href={`${broll.url}?download=1`}
            download
            className="apertar flex h-7 items-center rounded-full bg-azul px-3 font-semibold text-white hover:bg-azul-forte"
          >
            Baixar
          </a>
          {aoApagar && (
            <button
              type="button"
              onClick={aoApagar}
              className="apertar h-7 rounded-full px-3 font-semibold text-vermelho-texto hover:bg-vermelho/10"
            >
              Apagar
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
