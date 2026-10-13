type Opcao<T> = { valor: T; rotulo: string }

type Props<T> = {
  opcoes: Opcao<T>[]
  valor: T
  aoMudar: (valor: T) => void
  nome: string // lido pelos leitores de tela, ex.: "Abas do painel"
  pequeno?: boolean // filtros: letra e altura menores
}

// Controle segmentado da Apple: opções grudadas num trilho cinza, a escolhida em destaque.
export default function Segmentado<T>({ opcoes, valor, aoMudar, nome, pequeno = false }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={nome} className="inline-flex rounded-lg bg-preenchimento-2 p-0.5">
      {opcoes.map((opcao) => {
        const ativa = opcao.valor === valor
        return (
          <button
            key={String(opcao.valor)}
            type="button"
            role="radio"
            aria-checked={ativa}
            onClick={() => aoMudar(opcao.valor)}
            className={`apertar rounded-md font-medium ${pequeno ? 'px-2.5 py-0.5 text-nota' : 'min-w-20 px-3 py-1 text-ui'} ${
              ativa ? 'bg-elevado text-rotulo shadow-cartao' : 'text-rotulo-2 hover:text-rotulo'
            }`}
          >
            {opcao.rotulo}
          </button>
        )
      })}
    </div>
  )
}
