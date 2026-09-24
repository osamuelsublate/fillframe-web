# Fase 2: Conexão com a OpenRouter

Objetivo: ver no painel todos os modelos de imagem e de vídeo da OpenRouter (com preço e o que cada um aceita) e conversar com a LLM no chat, escolhendo Opus 5.5 ou MiniMax.
Depende de: Fase 1

## Onda 2.1: Catálogo de modelos no painel
Status: concluída (2026-09-24)
Objetivo: o painel mostra a lista de modelos de imagem e de vídeo da OpenRouter, com busca, preço e capacidades, guardada em cache.
Depende de: 1.2
Ler antes: spec/referencias/openrouter.md (tudo); spec/dados.md (entidade Catálogo de modelos); spec/arquitetura.md (seção 2 "LLM e transcrição", tabela "Modelos (catálogo)" da seção 6); spec/telas.md ("Painel", item modelo)
Escopo:
  Backend: backend/app/openrouter/ (funções do catálogo), backend/app/modelos/, backend/alembic/ (nova migração), backend/app/sistema/ (preencher catalogo_atualizado_em)
  Frontend: frontend/src/api/modelos.ts, frontend/src/componentes/Painel.tsx, frontend/src/componentes/SeletorModelo.tsx
  Dados: Catálogo de modelos (cria)
  Não tocar: backend/app/sessoes/
Tarefas:
1. Migração: tabela `catalogo_modelos` (id, categoria, nome, descricao, capacidades JSON, precos JSON, atualizado_em).
2. `backend/app/openrouter/catalogo.py`: buscar `GET /images/models` (e `/endpoints` de cada modelo, para as capacidades definitivas e o preço), `GET /videos/models` e `GET /models` (LLMs de texto: `input_modalities`, suporte a tools).
3. `backend/app/modelos/servico.py`: normalizar as capacidades de imagem e de vídeo num formato comum (proporções, resoluções, durações, aceita referência, aceita primeiro/último quadro, máximo de referências) e gravar no cache; atualizar ao iniciar o backend se o cache tiver mais de 24 h (sem travar a subida); resolver `minimax:ultimo` como o modelo de texto mais novo do autor `minimax` com suporte a tools.
4. Rotas em `backend/app/modelos/rotas.py`: `GET /api/modelos/imagem`, `GET /api/modelos/video` (com `?busca=`; campo `tempo_medio_segundos` ainda `null`) e `POST /api/modelos/atualizar`. `GET /api/status` passa a informar `catalogo_atualizado_em`.
5. `frontend/src/api/modelos.ts` + `componentes/Painel.tsx` (aba "Criação" com área para o seletor e aba "Galeria" vazia) + `componentes/SeletorModelo.tsx`: alternar imagem/vídeo, busca, cartão com nome, preço, proporções, durações e resoluções, e botão "Atualizar lista".
Aceite técnico:
* Com o cache vazio, o backend sobe e busca o catálogo em segundo plano. `GET /api/modelos/video` traz os modelos com capacidades preenchidas.
* Sem internet, o catálogo em cache continua sendo servido e "Atualizar lista" devolve um erro claro.
* A tela carrega sem erro no console.
Entrega: o painel mostra todos os modelos de imagem e de vídeo da OpenRouter.
Teste da pessoa:
1. Abra o app e abra o painel da direita.
2. Na aba Criação, escolha "Vídeo": aparecem os modelos (Veo, Kling, Seedance…), com preço e as proporções aceitas (ex.: 9:16, 16:9).
3. Troque para "Imagem" e busque "seedream": só aparecem os modelos Seedream.
4. Desligue a internet e clique em "Atualizar lista". Deve aparecer "Não foi possível falar com a OpenRouter. A lista mostrada é a última salva." e a lista continua na tela.

## Onda 2.2: Chat com a LLM
Status: concluída (2026-09-24)
Objetivo: conversar com a LLM da sessão com a resposta aparecendo aos poucos, escolher entre Opus 5.5 e MiniMax, e ver a conversa guardada ao reabrir a sessão.
Depende de: 2.1
Ler antes: spec/dados.md (entidade Mensagem); spec/arquitetura.md (tabela "Chat" da seção 6, sem as tools; "Contexto enviado à LLM"); spec/telas.md ("Chat", "Fluxo de primeiro acesso" passo 2, regra "Contexto da LLM")
Escopo:
  Backend: backend/app/chat/, backend/app/openrouter/ (chat completions com streaming), backend/app/sessoes/ (PATCH e inclusão das mensagens em "abrir sessão"), backend/alembic/
  Frontend: frontend/src/api/chat.ts, frontend/src/componentes/Chat.tsx, frontend/src/componentes/Mensagem.tsx, frontend/src/telas/Sessao.tsx
  Dados: Mensagem (cria, sem os campos de áudio em uso ainda); Sessão (passa a atualizar `ultimo_uso_em`)
  Não tocar: backend/app/modelos/ (só leitura via serviço), backend/app/sistema/
Tarefas:
1. Migração: tabela `mensagens` (todos os campos de spec/dados.md, com `audio_referencia_id` e `transcricao` já presentes e anuláveis; `chamadas_de_tool` JSON).
2. `backend/app/openrouter/chat.py`: chat completions com `stream: true`, repassando os pedaços de texto (preparado para receber tools e partes de imagem nas ondas seguintes).
3. `backend/app/chat/servico.py`: montar o contexto (prompt de sistema de "diretor de brolls para vídeos de programação, vertical e horizontal; nunca gera sozinho, só prepara" + mensagens da sessão; regra **Contexto da LLM**, parte das mensagens); salvar a mensagem do usuário e a da LLM; atualizar `ultimo_uso_em`.
4. `backend/app/chat/rotas.py`: `POST /api/sessoes/{id}/mensagens` com resposta SSE (`texto`, `fim`, `erro`), validando que existe texto. `GET /api/modelos/llm`: LLMs permitidas, resolvidas pelo catálogo, com `aceita_audio` e `aceita_imagem`.
5. `backend/app/sessoes/`: `PATCH /api/sessoes/{id}` (`nome` de 1 a 120 caracteres, `llm` entre as permitidas); `GET /api/sessoes/{id}` passa a incluir as mensagens.
6. `frontend/src/api/chat.ts` (leitura do SSE) + `componentes/Chat.tsx` e `Mensagem.tsx`: lista de mensagens com markdown simples, caixa de texto (Enter envia, Shift+Enter quebra linha), texto da LLM aparecendo aos poucos e seletor de LLM no topo do chat. Com a sessão vazia, mostrar "Qual conteúdo você vai gravar? Me conta e eu te ajudo a planejar os brolls."
Aceite técnico:
* O SSE entrega os pedaços em ordem, e as duas mensagens ficam salvas.
* Um erro da OpenRouter (ex.: modelo inválido) chega como evento `erro` e aparece no chat, sem travar a tela.
* Sem erro no console.
Entrega: chat funcionando com a LLM escolhida, com a conversa guardada por sessão.
Teste da pessoa:
1. Abra uma sessão nova: aparece a pergunta sobre o conteúdo.
2. Escreva "Vou gravar um vídeo sobre erro de CORS no React, que brolls você sugere?". A resposta deve aparecer aos poucos.
3. Troque a LLM para MiniMax no topo do chat e mande outra mensagem: a resposta vem normalmente.
4. Troque de sessão e volte: a conversa continua lá, e essa sessão sobe para o topo do histórico.
5. Tente enviar uma mensagem vazia: o botão de enviar fica desativado.
