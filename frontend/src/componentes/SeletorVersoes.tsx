import type { Criacao } from '../api/criacoes'

type Props = {
  versoes: Criacao[] // todas as versões do mesmo broll, em ordem
  selecionadaId: string
  aoSelecionar: (criacaoId: string) => void
}

// Pílulas v1, v2, v3… de um broll, e de qual versão a selecionada partiu.
export default function SeletorVersoes({ versoes, selecionadaId, aoSelecionar }: Props) {
  const selecionada = versoes.find((v) => v.id === selecionadaId)
  const origem = versoes.find((v) => v.id === selecionada?.versao_de_id)

  return (
    <div className="flex flex-wrap items-center gap-1">
      {versoes.map((versao) => {
        const ativa = versao.id === selecionadaId
        const apagada = versao.situacao === 'apagado'
        return (
          <button
            key={versao.id}
            type="button"
            onClick={() => aoSelecionar(versao.id)}
            disabled={apagada}
            aria-pressed={ativa}
            title={apagada ? 'Versão apagada' : `Ver a v${versao.numero_versao}`}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              ativa
                ? 'bg-stone-900 text-white'
                : apagada
                  ? 'bg-stone-50 text-stone-400'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            v{versao.numero_versao}
            {apagada && ' (apagada)'}
          </button>
        )
      })}
      {origem && <span className="ml-1 text-xs text-stone-500">partiu de v{origem.numero_versao}</span>}
    </div>
  )
}
