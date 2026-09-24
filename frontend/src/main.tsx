import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import Sessao from './telas/Sessao'

const clienteQuery = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={clienteQuery}>
      <Sessao />
    </QueryClientProvider>
  </StrictMode>,
)
