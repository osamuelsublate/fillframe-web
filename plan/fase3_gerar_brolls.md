# Fase 3: Gerar brolls

Objetivo: pedir brolls no chat, a LLM preparar a configuração no painel, você ajustar e clicar em Gerar, e acompanhar com contador e barra de progresso até a imagem ou o vídeo aparecer pronto (vertical ou horizontal), com opção de baixar.
Depende de: Fase 2

## Onda 3.1: Configurar uma criação (rascunho)
Status: concluída (2026-09-24)
Objetivo: montar no painel a configuração de uma imagem (modelo, prompt, vertical ou horizontal, resolução), com validação contra o que o modelo aceita, e salvá-la como rascunho da sessão.
Depende de: 2.1
Ler antes: spec/dados.md (entidade Criação); spec/arquitetura.md (tabela "Criações" da seção 6: "Criar rascunho" e "Editar rascunho"); spec/telas.md ("Aba Criação", regra "Validar a configuração contra o modelo")
Escopo:
  Backend: backend/app/criacoes/, backend/alembic/, backend/app/sessoes/ (incluir as criações em "abrir sessão")
  Frontend: frontend/src/api/criacoes.ts, frontend/src/componentes/AbaCriacao.tsx, frontend/src/componentes/ConfigCriacao.tsx, frontend/src/componentes/Painel.tsx
  Dados: Criação (cria, com todos os campos de spec/dados.md)
  Não tocar: backend/app/chat/, backend/app/modelos/ (só leitura via serviço)
Tarefas:
1. Migração: tabela `criacoes` com todos os campos (versão, raiz, situação, job, estimativa, tempos, custo); índice por `sessao_id`.
2. `backend/app/criacoes/validacao.py`: regra **Validar a configuração contra o modelo**. O modelo precisa existir no catálogo e ser do tipo certo; a proporção, a resolução e a duração precisam estar na lista do modelo. Mensagens em português que dizem o que é aceito (ex.: "O modelo X aceita apenas 16:9 e 1:1"). Orientação vertical → a proporção vertical aceita pelo modelo (9:16 preferido); horizontal → 16:9 preferido.
3. `backend/app/criacoes/` (serviço, repositório, rotas):
   3.1 `POST /api/sessoes/{id}/criacoes`: cria em `rascunho`, com `raiz_id` = o próprio id e `numero_versao` = 1.
   3.2 `PATCH /api/sessoes/{id}/criacoes/{cid}`: só em `rascunho` (senão 409 "Só é possível editar um rascunho").
   3.3 `GET /api/sessoes/{id}/criacoes` com filtro `?situacao=`.
   3.4 Toda busca de criação filtra por `sessao_id` (isolamento).
4. `GET /api/sessoes/{id}` passa a incluir as criações.
5. `frontend/src/api/criacoes.ts` + `componentes/ConfigCriacao.tsx`: tipo (por enquanto só imagem habilitada), SeletorModelo, prompt, botões Vertical / Horizontal, resolução (opções vindas do modelo), botão "Salvar rascunho", erros da API mostrados no campo.
6. `componentes/AbaCriacao.tsx`: lista de criações da sessão (cartões com prompt resumido, modelo e situação); clicar num rascunho abre a configuração para editar.
Aceite técnico:
* Criar com proporção não suportada devolve 400 com a lista aceita.
* Editar uma criação de outra sessão devolve 404.
* Sem erro no console.
Entrega: rascunhos de imagem configurados e salvos na sessão.
Teste da pessoa:
1. Abra o painel, aba Criação, e clique em "Nova criação".
2. Escolha um modelo de imagem, escreva um prompt, escolha Vertical e salve. Deve aparecer um cartão "Rascunho".
3. Clique no cartão, mude para Horizontal e salve: o cartão é atualizado.
4. Escolha um modelo que não aceita a resolução "4K" e tente salvar com ela (ou apague o prompt). Deve aparecer uma mensagem dizendo o que o modelo aceita (ou "O prompt é obrigatório").

## Onda 3.2: Gerar imagem e ver o resultado
Status: concluída (2026-09-24)
Objetivo: clicar em Gerar num rascunho de imagem, acompanhar o contador de tempo e ver a imagem pronta no painel, com botão para baixar.
Depende de: 3.1
Ler antes: spec/referencias/openrouter.md ("Imagens"); spec/dados.md (entidade Broll, "Armazenamento de arquivos"); spec/arquitetura.md (seção 4 "Arquivos", seção 7 "Imagem", tabela "Criações": "Gerar" e "Andamento", tabela "Brolls e galeria": "Arquivo" de broll); spec/telas.md (regra "Gerar só com ação do usuário")
Escopo:
  Backend: backend/app/geracao/, backend/app/arquivos/, backend/app/brolls/, backend/app/openrouter/ (chamada de imagens), backend/app/criacoes/ (rota gerar), backend/alembic/
  Frontend: frontend/src/api/criacoes.ts, frontend/src/componentes/ProgressoCriacao.tsx, frontend/src/componentes/PlayerBroll.tsx, frontend/src/componentes/AbaCriacao.tsx
  Dados: Broll (cria); Criação (passa a usar situação, início, fim, tempo, custo)
  Não tocar: backend/app/chat/, backend/app/sessoes/
Tarefas:
1. Migração: tabela `brolls`.
2. `backend/app/arquivos/`: salvar bytes em `backend/data/sessoes/{sessao}/brolls/` com nome gerado pelo app, miniatura de imagem com Pillow, caminho relativo no banco e resolução segura do caminho (sempre dentro de `backend/data/`).
3. `backend/app/openrouter/imagens.py`: `POST /api/v1/images` (sem streaming), devolvendo os bytes de cada `data[]`, o `media_type` e `usage.cost`.
4. `backend/app/geracao/executor.py`: executor assíncrono em processo. Recebe o id da criação, chama a OpenRouter, grava os Brolls, marca `pronto` com `concluida_em`, `tempo_gasto_segundos` e `custo_usd`; em caso de erro, marca `falhou` com a mensagem.
5. `POST /api/sessoes/{id}/criacoes/{cid}/gerar` em `backend/app/criacoes/`: regra **Gerar só com ação do usuário**. É a única rota que dispara geração; só aceita criação em `rascunho` (senão 409); revalida contra o catálogo; marca `gerando` com `iniciada_em` e enfileira no executor. O `GET .../criacoes` passa a incluir os brolls de cada criação.
6. `backend/app/brolls/rotas.py`: `GET /api/arquivos/brolls/{bid}` com suporte a Range e `?download=1` (nome amigável no download).
7. Frontend: botão **Gerar** no rascunho; `ProgressoCriacao.tsx` mostra o contador "0:42" calculado a partir de `iniciada_em` (a barra com estimativa entra na 3.5); consulta a cada 2 s enquanto houver `gerando`; `PlayerBroll.tsx` mostra a imagem pronta com botão "Baixar"; estado `falhou` com a mensagem de erro.
Aceite técnico:
* Uma geração real com um modelo barato (ex.: Seedream Lite) termina em `pronto`, com o arquivo em `backend/data/...` e o custo registrado.
* `GET /api/arquivos/brolls/{id}` com um caminho adulterado no banco não sai de `backend/data/`.
* Chamar `/gerar` duas vezes na mesma criação devolve 409 na segunda.
* Sem erro no console.
Entrega: primeira imagem gerada de verdade pelo app, com contador e download.
Teste da pessoa:
1. Abra um rascunho de imagem da onda anterior e clique em **Gerar**.
2. O contador começa a correr no cartão. Ao terminar, a imagem aparece no painel.
3. Clique em "Baixar": o arquivo é salvo no seu computador.
4. Crie um rascunho com um prompt que viole a política do modelo (ou desligue a internet) e gere. O cartão deve mostrar "Falhou" com o motivo.

## Onda 3.3: Gerar vídeo
Status: concluída (2026-09-24)
Objetivo: gerar vídeos (vertical ou horizontal, com duração escolhida) e assistir no player do painel, com o acompanhamento continuando mesmo com a aba fechada ou o backend reiniciado.
Depende de: 3.2
Ler antes: spec/referencias/openrouter.md ("Vídeos"); spec/arquitetura.md (seção 7 inteira); spec/telas.md ("Aba Criação", "Avisos")
Escopo:
  Backend: backend/app/geracao/, backend/app/openrouter/ (chamadas de vídeo), backend/app/criacoes/validacao.py (duração de vídeo), backend/app/main.py (retomada ao iniciar)
  Frontend: frontend/src/componentes/ConfigCriacao.tsx, frontend/src/componentes/PlayerBroll.tsx
  Dados: Criação (usa `id_job_openrouter` e `duracao_segundos`)
  Não tocar: backend/app/chat/, backend/app/sessoes/, backend/app/brolls/ (a rota de arquivo já serve vídeo)
Tarefas:
1. `backend/app/openrouter/videos.py`: enviar (`POST /api/v1/videos`), consultar (`GET /api/v1/videos/{id}`) e baixar (`unsigned_urls[i]` com a chave).
2. `backend/app/criacoes/validacao.py`: validar a duração contra `supported_durations`, e a resolução e a proporção contra as do vídeo (continuação da regra **Validar a configuração contra o modelo**).
3. `backend/app/geracao/executor.py`:
   3.1 Fluxo de vídeo: enviar, guardar `id_job_openrouter`, consultar a cada 10 s, baixar em `completed` e salvar como Broll; `failed`, `cancelled` e `expired` viram `falhou` com o erro.
   3.2 Limite de gerações simultâneas (FILLFRAME_GERACOES_SIMULTANEAS); as que esperam na fila só marcam `iniciada_em` quando começam de fato.
4. Retomada no `startup` do `backend/app/main.py`: vídeos `gerando` com `id_job_openrouter` voltam a ser acompanhados; imagens `gerando` viram `falhou` com "interrompida ao reiniciar".
5. Frontend: habilitar "Vídeo" no `ConfigCriacao.tsx`, com seletor de duração (valores do modelo) e opção de gerar áudio quando o modelo suporta; `PlayerBroll.tsx` com `<video controls>` (a primeira imagem do vídeo serve de miniatura) e botão "Baixar".
Aceite técnico:
* Um vídeo real curto (4 a 5 s, 720p, modelo barato) termina em `pronto` e toca no player (Range funcionando).
* Ao reiniciar o backend no meio de um vídeo, a geração é retomada e termina.
* Duração inválida devolve 400 com as durações aceitas.
Entrega: brolls em vídeo gerados e assistidos no painel.
Teste da pessoa:
1. Crie uma nova criação do tipo Vídeo, Vertical, com duração de 5 s, e clique em Gerar.
2. Feche a aba do navegador, espere 1 minuto e abra de novo: o contador continua correndo.
3. Quando terminar, o vídeo aparece no player na vertical. Dê play e baixe.
4. Gere dois vídeos ao mesmo tempo: cada um tem o seu contador.
5. Escolha uma duração que o modelo não aceita (se o seletor permitir) e tente gerar. Deve aparecer "O modelo X aceita apenas 4, 6 ou 8 segundos".

## Onda 3.4: A LLM prepara os brolls
Status: concluída (2026-09-24)
Objetivo: pedir brolls no chat e a LLM preparar os rascunhos no painel (modelo, prompt, formato, duração), que você revisa e gera. A LLM nunca gera sozinha.
Depende de: 2.2, 3.3
Ler antes: spec/arquitetura.md ("Tools que a LLM pode usar" e "Contexto enviado à LLM" da seção 6); spec/telas.md ("Fluxo de uso diário" passos 2 a 4, regras "Gerar só com ação do usuário" e "Contexto da LLM")
Escopo:
  Backend: backend/app/chat/ (tools e contexto), backend/app/openrouter/chat.py (tool calling com streaming)
  Frontend: frontend/src/api/chat.ts, frontend/src/componentes/Chat.tsx, frontend/src/componentes/Mensagem.tsx, frontend/src/componentes/Painel.tsx
  Dados: Mensagem (passa a usar `autor=tool` e `chamadas_de_tool`)
  Não tocar: backend/app/geracao/, backend/app/criacoes/rotas.py (as tools chamam o serviço de criações, não as rotas)
Tarefas:
1. `backend/app/chat/tools.py`: definições e execução de `listar_modelos`, `preparar_criacao`, `ajustar_criacao` (só para editar rascunho; a nova versão entra na 5.1) e `ver_criacoes`, chamando `criacoes/servico.py` e `modelos/servico.py`. Regra **Gerar só com ação do usuário**: não existe tool de gerar, e as tools não conseguem mudar a situação de uma criação. Um erro de validação volta para a LLM como resultado da tool.
2. `backend/app/openrouter/chat.py`: laço de tool calling com streaming (a LLM chama a tool, o backend executa e devolve, e a LLM continua), com limite de 8 rodadas por mensagem.
3. `backend/app/chat/servico.py`: regra **Contexto da LLM**. Incluir um resumo das criações da sessão (tipo, modelo, situação, prompt) e salvar as chamadas em `chamadas_de_tool`. O prompt de sistema orienta a LLM a preparar brolls "que se pareçam reais" para vídeos de programação.
4. SSE: novo evento `tool` com `{acao: "criacao_preparada" | "criacao_ajustada", criacao_id}`.
5. Frontend: ao receber o evento `tool`, abrir o painel na aba Criação com o rascunho em destaque; no chat, mostrar um aviso compacto "Rascunho preparado: [prompt resumido] → revisar".
Aceite técnico:
* Pedir "gere agora" à LLM não gera nada: o rascunho continua `rascunho`.
* Um rascunho criado por tool com proporção inválida faz a LLM corrigir e tentar de novo.
* Sem erro no console.
Entrega: o fluxo principal do app funcionando (conversar → a LLM prepara → você gera).
Teste da pessoa:
1. Numa sessão, escreva: "Preciso de 2 brolls verticais: um app de tarefas bonito e o mesmo app mostrando um erro de CORS no console".
2. A LLM responde e aparecem 2 rascunhos no painel, já configurados.
3. Ajuste o modelo de um deles e clique em Gerar.
4. Escreva "pode gerar o outro você mesmo". A LLM deve explicar que só você pode clicar em Gerar, e nada começa a gerar sozinho.

## Onda 3.5: Barra de progresso com tempo médio
Status: concluída (2026-09-24)
Objetivo: cada item em criação mostra uma barra de progresso baseada no tempo médio real daquele modelo, e o seletor de modelos mostra o tempo médio.
Depende de: 3.3
Ler antes: spec/arquitetura.md ("Estimativa de tempo" no fim da seção 6); spec/telas.md (regra "Estimar o tempo", "Aba Criação")
Escopo:
  Backend: backend/app/criacoes/ (estimativa), backend/app/modelos/ (tempo médio nas listas)
  Frontend: frontend/src/componentes/ProgressoCriacao.tsx, frontend/src/componentes/SeletorModelo.tsx
  Dados: Criação (usa `estimativa_segundos`)
  Não tocar: backend/app/geracao/, backend/app/chat/
Tarefas:
1. `backend/app/criacoes/estimativa.py`: regra **Estimar o tempo**. Média de `tempo_gasto_segundos` das últimas 10 criações `pronto` do mesmo modelo, preferindo mesmo tipo, duração e resolução; sem histórico, 30 s para imagem e 120 s para vídeo (*assumido*).
2. `POST .../gerar` passa a gravar `estimativa_segundos` no início.
3. `GET /api/modelos/imagem` e `/video` passam a preencher `tempo_medio_segundos` (null se não houver histórico).
4. `ProgressoCriacao.tsx`: barra que avança pelo tempo decorrido ÷ estimativa, até 95%, e para ali; o contador continua; ao ficar `pronto`, a barra completa. Texto "~1:40 estimado".
5. `SeletorModelo.tsx`: mostrar "tempo médio: 1:35" quando houver.
Aceite técnico:
* Depois de 2 gerações do mesmo modelo, a terceira recebe a média das duas.
* A barra não passa de 95% antes de o status real mudar.
Entrega: o progresso de cada broll mostra quanto falta, de forma realista.
Teste da pessoa:
1. Gere duas imagens com o mesmo modelo e anote quanto tempo cada uma levou.
2. Gere a terceira: a barra deve mostrar uma estimativa próxima da média das duas.
3. No seletor de modelos, esse modelo mostra "tempo médio".
4. Gere um vídeo com um modelo que nunca foi usado: a estimativa deve ser 2:00. Se o vídeo demorar mais, a barra para perto do fim e o contador continua até ficar pronto.
