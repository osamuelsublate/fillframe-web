# Fase 1: Esqueleto

Objetivo: abrir o FillFrame no navegador, ver se a chave da OpenRouter está funcionando, criar sessões e alternar entre elas pelo histórico.
Depende de: nenhuma

## Onda 1.1: App rodando e situação da chave
Status: concluída (2026-09-24)
Objetivo: backend e frontend sobem com um comando cada, e a tela única mostra o layout (histórico, chat e painel) e avisa se a chave da OpenRouter falta ou é inválida.
Depende de: nenhuma
Ler antes: spec/arquitetura.md (seções 1, 2, 3, 5, 8, 9 e a tabela "Sistema" da seção 6); spec/usuarios.md ("Forma de entrada" e "Implicações técnicas"); spec/telas.md ("Fluxo de primeiro acesso")
Escopo:
  Backend: backend/pyproject.toml, backend/app/main.py, backend/app/config.py, backend/app/openrouter/ (só verificação da chave), backend/app/sistema/ (rota de status)
  Frontend: frontend/ inteiro (criação do projeto), frontend/src/api/sistema.ts, frontend/src/telas/Sessao.tsx, frontend/src/componentes/AvisoChave.tsx
  Dados: nenhuma
  Não tocar: backend/.env (já existe com a chave real), spec/
Tarefas:
1. Criar o projeto backend com uv em `backend/pyproject.toml`: dependências fastapi, uvicorn, httpx, pydantic-settings, sqlalchemy, alembic, pillow, python-multipart. Criar o script `fillframe` (`[project.scripts]`) que roda o uvicorn em `127.0.0.1:8000`, com reload.
2. `backend/app/config.py`: ler `backend/.env` (OPENROUTER_API_KEY, FILLFRAME_LLM_PADRAO, FILLFRAME_LLMS_PERMITIDAS, FILLFRAME_MODELO_TRANSCRICAO, FILLFRAME_GERACOES_SIMULTANEAS), com padrões para tudo menos a chave. Conferir que `backend/.env.example` lista as mesmas variáveis sem valores.
3. `backend/app/openrouter/cliente.py`: cliente httpx único com o header de autenticação e a função `verificar_chave()` (chamada leve à OpenRouter, com cache de 60 s). A chave nunca aparece em log nem em resposta.
4. `backend/app/sistema/rotas.py` e `backend/app/main.py`: `GET /api/status` → `{chave_configurada, chave_valida, catalogo_atualizado_em: null}`; erros no formato `{ "erro": "..." }`; CORS só para `http://127.0.0.1:5173`.
5. Criar o frontend com Vite, React e TypeScript em `frontend/`: Tailwind CSS e TanStack Query; `vite.config.ts` com host `127.0.0.1`, porta 5173 e proxy `/api` → `http://127.0.0.1:8000`; pastas `src/api`, `src/telas`, `src/componentes`, `src/utils`.
6. `frontend/src/telas/Sessao.tsx`: layout da tela única, com a lateral do histórico (abre e fecha), o chat no centro e o painel à direita (abre e fecha), ainda com textos de lugar vazio. `frontend/src/api/sistema.ts` + `componentes/AvisoChave.tsx`: se a chave falta ou é inválida, mostrar no lugar do chat o aviso "A chave da OpenRouter não está configurada (ou é inválida). Coloque-a em backend/.env e reinicie o backend."
7. Criar `README.md` na raiz com os pré-requisitos (uv, Node 20+) e os dois comandos de `spec/arquitetura.md` seção 9, em linguagem simples.
Aceite técnico:
* `cd backend && uv run fillframe` sobe sem erro e escuta só em 127.0.0.1 (conferir que não responde pelo IP da rede).
* `GET /api/status` responde `chave_configurada: true, chave_valida: true` com a chave atual, e `chave_configurada: false` com a variável vazia.
* `cd frontend && npm install && npm run dev` sobe, e a tela carrega sem erro no console.
* `git status` não mostra `.env` nem `node_modules`.
Entrega: o app abre no navegador com o layout de chat e painel, e mostra se a chave está ok.
Teste da pessoa:
1. Siga o README: abra dois terminais e rode um comando em cada.
2. Abra http://127.0.0.1:5173 no navegador.
3. Deve aparecer a tela do FillFrame com a lateral de sessões, o chat no meio e o painel à direita, e dá para abrir e fechar a lateral e o painel.
4. Pare o backend, apague temporariamente a chave em `backend/.env`, suba o backend de novo e recarregue a página. Deve aparecer o aviso de que a chave não está configurada. Depois, coloque a chave de volta.

## Onda 1.2: Sessões e histórico
Status: concluída (2026-09-24)
Objetivo: o app cria o banco sozinho, abre na última sessão usada (ou numa nova), e a lateral lista as sessões pela ordem de uso e cria novas.
Depende de: 1.1
Ler antes: spec/dados.md (entidade Sessão, "Implicações técnicas"); spec/arquitetura.md (seção 4 "Backup", seção 5, tabela "Sessões" da seção 6); spec/telas.md ("Histórico de sessões", "Fluxo de primeiro acesso", "Fluxo de uso diário" passo 1)
Escopo:
  Backend: backend/app/db.py, backend/alembic/, backend/app/sessoes/, backend/app/main.py (registrar rotas e migrar ao iniciar)
  Frontend: frontend/src/api/sessoes.ts, frontend/src/componentes/HistoricoSessoes.tsx, frontend/src/telas/Sessao.tsx
  Dados: Sessão (cria)
  Não tocar: backend/app/openrouter/, backend/app/sistema/
Tarefas:
1. `backend/app/db.py`: engine SQLite em `backend/data/fillframe.db`, criando a pasta `backend/data/` se não existir, com chaves estrangeiras ativadas.
2. Alembic em `backend/alembic/` + migração inicial com a tabela `sessoes` (id, nome, llm, criada_em, ultimo_uso_em), aplicada automaticamente quando o backend inicia (`alembic upgrade head` no startup ou no script `fillframe`).
3. `backend/app/sessoes/` (modelos, esquemas, repositório, serviço, rotas):
   3.1 `GET /api/sessoes`, ordenado por `ultimo_uso_em` desc.
   3.2 `POST /api/sessoes`: nome padrão "Nova sessão" e LLM padrão do `.env`; valida que a LLM está em FILLFRAME_LLMS_PERMITIDAS (a resolução de "minimax:ultimo" fica para a onda 2.1: por enquanto aceita o texto literal).
   3.3 `GET /api/sessoes/{id}`: devolve a sessão (depois, mensagens, referências e criações entram aqui); 404 com `{erro: "Sessão não encontrada"}`.
4. `frontend/src/api/sessoes.ts` com TanStack Query: listar, criar, abrir.
5. `componentes/HistoricoSessoes.tsx`: lista com o nome e "usado há X"; botão "Nova sessão"; a sessão aberta fica destacada.
6. `telas/Sessao.tsx`: ao abrir o app, entra na sessão com o último uso mais recente, ou cria uma nova se não houver nenhuma; a sessão aberta fica na URL (`?sessao=id`), para sobreviver ao recarregar.
Aceite técnico:
* Apagar `backend/data/` e subir o backend recria o banco sem erro.
* As três rotas respondem, e o 404 volta no formato padrão.
* A tela carrega sem erro no console.
Entrega: sessões reais, guardadas no banco, com histórico na lateral.
Teste da pessoa:
1. Abra http://127.0.0.1:5173.
2. O app já abre numa sessão "Nova sessão". Clique em "Nova sessão" duas vezes.
3. Devem aparecer três sessões na lateral. Clique numa delas: ela fica destacada.
4. Pare os dois terminais, suba de novo e abra o app: as sessões continuam lá.
5. Abra http://127.0.0.1:5173/?sessao=nao-existe: deve aparecer a mensagem "Sessão não encontrada" e o app volta para a última sessão.
