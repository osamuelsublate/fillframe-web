import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import Avisos from './componentes/Avisos'
import Sessao from './telas/Sessao'
import { avisar, mensagemDe } from './utils/erros'

// Toda falha de chamada ao backend aparece para a pessoa: num aviso no rodapé, ou no próprio
// lugar da tela quando a consulta/ação tem `meta: { erroNaTela: true }` (aí não repete o aviso).
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { erroNaTela?: boolean }
    mutationMeta: { erroNaTela?: boolean }
  }
}

const clienteQuery = new QueryClient({
  queryCache: new QueryCache({
    onError: (erro, consulta) => {
      if (!consulta.meta?.erroNaTela) avisar(mensagemDe(erro))
    },
  }),
  mutationCache: new MutationCache({
    onError: (erro, _variaveis, _contexto, mutacao) => {
      if (!mutacao.meta?.erroNaTela) avisar(mensagemDe(erro))
    },
  }),
  defaultOptions: {
    // Uma nova tentativa só: com o backend desligado, o aviso aparece logo.
    queries: { retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={clienteQuery}>
      <Sessao />
      <Avisos />
    </QueryClientProvider>
  </StrictMode>,
)
