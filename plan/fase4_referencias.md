# Fase 4: Referências e áudio

Objetivo: mandar imagens, arquivos de texto e áudio no chat, usar referências (inclusive uma imagem gerada) para criar imagens e vídeos, e falar com a LLM por áudio.
Depende de: Fase 3

## Onda 4.1: Anexar imagens e arquivos de texto no chat
Status: concluída (2026-09-24)
Objetivo: anexar imagens e arquivos de texto numa mensagem; a LLM passa a enxergá-los, e as imagens aparecem como referências da sessão no painel.
Depende de: 2.2
Ler antes: spec/dados.md (entidade Referência); spec/arquitetura.md (seção 4 "Uploads", tabela "Referências" da seção 6: "Enviar referência" e "Listar referências"; "Arquivo" de referência na tabela "Brolls e galeria"; "Contexto enviado à LLM"); spec/telas.md (regras "Validar uploads" e "Contexto da LLM")
Escopo:
  Backend: backend/app/referencias/, backend/app/arquivos/ (validação de upload), backend/app/chat/ (contexto com referências), backend/alembic/
  Frontend: frontend/src/api/referencias.ts, frontend/src/componentes/Chat.tsx, frontend/src/componentes/AbaCriacao.tsx (seção de referências)
  Dados: Referência (cria)
  Não tocar: backend/app/geracao/, backend/app/criacoes/
Tarefas:
1. Migração: tabela `referencias` (todos os campos de spec/dados.md, incluindo `broll_origem_id` anulável).
2. `backend/app/arquivos/upload.py`: regra **Validar uploads**. Tipo detectado pelo conteúdo; imagem png/jpeg/webp até 20 MB; texto (txt, md, json e código em texto, UTF-8) até 2 MB; recusa com mensagem clara. Salvar em `backend/data/sessoes/{sessao}/referencias/`.
3. `backend/app/referencias/`: `POST /api/sessoes/{id}/referencias` (multipart), `GET /api/sessoes/{id}/referencias` e `GET /api/arquivos/referencias/{rid}` (caminho seguro, só da pasta de dados). `GET /api/sessoes/{id}` passa a incluir as referências.
4. `backend/app/chat/`: `POST .../mensagens` aceita `referencia_ids[]` (todas precisam ser da sessão, senão 400) e as vincula à mensagem; regra **Contexto da LLM**: imagens entram como partes de imagem (se `aceita_imagem`) e textos entram inline com o nome do arquivo.
5. Frontend: botão de clipe e arrastar-e-soltar no `Chat.tsx`, com prévia dos anexos antes de enviar e miniaturas na mensagem enviada; na `AbaCriacao.tsx`, uma seção "Referências da sessão" com as miniaturas das imagens.
Aceite técnico:
* Um `.exe` renomeado para `.png` é recusado.
* Uma referência de outra sessão em `referencia_ids` devolve 400.
* A LLM descreve corretamente uma imagem anexada.
Entrega: referências no chat e no painel, entendidas pela LLM.
Teste da pessoa:
1. No chat, anexe um print de um app e um arquivo `.md` com um roteiro, e escreva "use isso como base para os brolls".
2. A LLM responde citando o conteúdo da imagem e do roteiro.
3. No painel, aba Criação, o print aparece em "Referências da sessão".
4. Tente anexar um PDF ou uma imagem com mais de 20 MB: deve aparecer "Tipo de arquivo não aceito" ou "Imagem acima de 20 MB".

## Onda 4.2: Referências nas criações e imagem virando vídeo
Status: concluída (2026-09-24)
Objetivo: escolher referências para uma criação (como estilo, primeiro quadro ou último quadro) e transformar uma imagem gerada em referência para um vídeo.
Depende de: 4.1, 3.4
Ler antes: spec/referencias/openrouter.md (`input_references` de imagens, `frame_images` e `input_references` de vídeos); spec/dados.md (entidade "Referência usada na criação"); spec/arquitetura.md (tabela "Referências": "Usar broll como referência"; tabela "Criações": regras de referência); spec/telas.md (regra "Validar a configuração contra o modelo", parte do número de referências; "Fluxo de uso diário" passo 6)
Escopo:
  Backend: backend/app/criacoes/ (vínculo e validação), backend/app/referencias/ (a partir de broll), backend/app/geracao/ (enviar referências), backend/app/chat/tools.py (parâmetro de referências), backend/alembic/
  Frontend: frontend/src/componentes/ConfigCriacao.tsx, frontend/src/componentes/PlayerBroll.tsx, frontend/src/api/referencias.ts
  Dados: Referência usada na criação (cria); Referência (passa a usar `origem=gerada` e `broll_origem_id`)
  Não tocar: backend/app/sessoes/, backend/app/modelos/
Tarefas:
1. Migração: tabela `criacao_referencias` (criacao_id, referencia_id, papel).
2. `backend/app/criacoes/validacao.py`: as referências precisam ser da mesma sessão; o papel precisa ser compatível com o modelo (`primeiro_quadro` e `ultimo_quadro` só em vídeo que aceita quadros; `referencia` só se o modelo aceita referência); respeitar o número máximo de referências (continuação da regra **Validar a configuração contra o modelo**). Criar e editar rascunho passam a aceitar `referencias[{id, papel}]`.
3. `backend/app/geracao/`: enviar as referências como data URL base64. Em imagem: `input_references`. Em vídeo: `frame_images` (com `frame_type`) ou `input_references`.
4. `backend/app/referencias/`: `POST /api/sessoes/{id}/referencias/de-broll` → cria uma Referência `origem=gerada` com uma **cópia** do arquivo do broll na pasta de referências e `broll_origem_id` apontando para ele (a cópia mantém a referência válida mesmo se o broll for apagado depois) (o broll precisa ser da sessão e ser imagem; senão 400).
5. `backend/app/chat/tools.py`: `preparar_criacao` e `ajustar_criacao` aceitam referências da sessão com papel.
6. Frontend: no `ConfigCriacao.tsx`, escolher referências da sessão e o papel de cada uma (só os papéis que o modelo aceita); no `PlayerBroll.tsx`, botão "Usar como referência" em imagens prontas, que cria a referência e abre uma nova criação de vídeo com ela como primeiro quadro.
Aceite técnico:
* Um vídeo gerado com `primeiro_quadro` começa visualmente na imagem escolhida.
* Uma referência de outra sessão devolve 400; `ultimo_quadro` num modelo sem suporte devolve 400 com a explicação.
Entrega: o processo completo imagem → vídeo até o output final.
Teste da pessoa:
1. Gere uma imagem vertical de um app bonito.
2. No resultado, clique em "Usar como referência": abre uma nova criação de vídeo com essa imagem como primeiro quadro.
3. Escreva o prompt ("o cursor rola a lista de tarefas e clica em concluir") e gere: o vídeo começa exatamente na imagem.
4. Escolha um modelo de vídeo que não aceita último quadro e tente marcar uma referência como "último quadro". A opção não aparece, ou aparece a mensagem "Este modelo não aceita último quadro".

## Onda 4.3: Áudio no chat
Status: concluída (2026-09-24)
Objetivo: gravar áudio no chat e mandar para a LLM, que entende o que foi falado (direto ou por transcrição).
Depende de: 4.1
Ler antes: spec/arquitetura.md (seção 2 "LLM e transcrição", seção 4 "Uploads"); spec/dados.md (Mensagem: `audio_referencia_id` e `transcricao`); spec/telas.md ("Chat", regra "Validar uploads")
Escopo:
  Backend: backend/app/chat/ (áudio e transcrição), backend/app/openrouter/ (transcrição), backend/app/arquivos/upload.py (tipos de áudio)
  Frontend: frontend/src/componentes/GravadorAudio.tsx, frontend/src/componentes/Chat.tsx, frontend/src/componentes/Mensagem.tsx
  Dados: Mensagem (passa a usar `audio_referencia_id` e `transcricao`); Referência (tipo `audio`)
  Não tocar: backend/app/criacoes/, backend/app/geracao/
Tarefas:
1. `backend/app/arquivos/upload.py`: aceitar áudio webm, mp3, wav e m4a até 25 MB (regra **Validar uploads**).
2. `backend/app/openrouter/transcricao.py`: transcrever com o modelo em FILLFRAME_MODELO_TRANSCRICAO. Se estiver vazio, usar o Gemini Flash Lite mais novo do catálogo; na falta dele, o primeiro modelo do catálogo que aceita áudio como entrada (*assumido*; ajustado na execução após testes).
3. `backend/app/chat/servico.py`: mensagem com `audio_referencia_id` e sem texto é válida; se a LLM da sessão `aceita_audio`, o áudio vai como parte de áudio; senão, transcreve antes e salva em `transcricao`. Em ambos os casos, a transcrição (quando existe) entra no contexto.
4. `componentes/GravadorAudio.tsx`: botão de microfone com MediaRecorder, tempo de gravação, cancelar e enviar (sobe como referência `audio` e depois envia a mensagem).
5. `Mensagem.tsx`: player de áudio na mensagem e texto transcrito abaixo, recolhível.
Aceite técnico:
* Com Opus (se não aceitar áudio), a transcrição é gerada e salva; com uma LLM que aceita áudio, o áudio vai direto.
* Permissão de microfone negada mostra uma mensagem clara.
Entrega: conversa por voz com a LLM.
Teste da pessoa:
1. Clique no microfone, permita o acesso e fale "quero um broll horizontal de um diagrama explicando como funciona uma API REST". Clique em enviar.
2. O áudio aparece no chat com o texto transcrito, e a LLM responde ao pedido (e prepara o rascunho).
3. Clique no microfone e depois em cancelar: nada é enviado.
4. Bloqueie o microfone no navegador e tente gravar: deve aparecer "Permita o acesso ao microfone para gravar áudio".
