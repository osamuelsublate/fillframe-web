# Dados

Vocabulário do usuário: **sessão** (um conteúdo), **mensagem**, **referência**, **criação** (cada imagem ou vídeo pedido, com versões) e **broll** (o arquivo pronto).

## Entidades

### Sessão

| Atributo | Tipo | Obrigatório |
|---|---|---|
| id | identificador | sim |
| nome | texto curto (nome do conteúdo) | sim (padrão "Nova sessão") |
| llm | texto (id do modelo na OpenRouter) | sim |
| criada_em | data e hora | sim |
| ultimo_uso_em | data e hora (atualiza a cada mensagem ou criação) | sim |

### Mensagem

| Atributo | Tipo | Obrigatório |
|---|---|---|
| id | identificador | sim |
| sessao_id | referência a Sessão | sim |
| autor | escolha: `usuario` / `llm` / `tool` | sim |
| texto | texto longo | opcional (áudio pode vir sem texto) |
| audio_referencia_id | referência a Referência (áudio enviado) | opcional |
| transcricao | texto longo (se o áudio foi transcrito) | opcional |
| chamadas_de_tool | dados estruturados (o que a LLM pediu às tools e o resultado) | opcional |
| criada_em | data e hora | sim |

### Referência

| Atributo | Tipo | Obrigatório |
|---|---|---|
| id | identificador | sim |
| sessao_id | referência a Sessão | sim |
| tipo | escolha: `imagem` / `texto` / `audio` | sim |
| origem | escolha: `anexada` / `gerada` | sim |
| broll_origem_id | referência a Broll (quando uma imagem gerada virou referência) | opcional |
| mensagem_id | referência a Mensagem (onde foi anexada) | opcional |
| arquivo | caminho do arquivo local | sim |
| nome_original | texto | opcional |
| formato | texto (ex.: `image/png`, `audio/webm`, `text/markdown`) | sim |
| tamanho_bytes | número | sim |
| criada_em | data e hora | sim |

### Criação

Cada pedido de imagem ou vídeo. Um ajuste gera uma **nova versão** (outra Criação que aponta para a versão de onde partiu).

| Atributo | Tipo | Obrigatório |
|---|---|---|
| id | identificador | sim |
| sessao_id | referência a Sessão | sim |
| versao_de_id | referência a Criação (versão de onde partiu) | opcional (vazio na primeira versão) |
| raiz_id | referência a Criação (primeira versão da árvore) | sim (aponta para si mesma na primeira) |
| numero_versao | número (1, 2, 3… dentro da árvore) | sim |
| tipo | escolha: `imagem` / `video` | sim |
| modelo | texto (id do modelo na OpenRouter) | sim |
| prompt | texto longo | sim |
| orientacao | escolha: `vertical` / `horizontal` (+ proporção exata, ex. `9:16`) | sim |
| duracao_segundos | número | só vídeo |
| resolucao | texto (ex.: `720p`, `2K`) | opcional |
| parametros_extras | dados estruturados (qualidade, áudio no vídeo, seed, opções do provedor) | opcional |
| situacao | escolha: `rascunho` / `gerando` / `pronto` / `falhou` / `apagado` | sim |
| id_job_openrouter | texto (vídeos) | opcional |
| erro | texto | opcional |
| estimativa_segundos | número (média do modelo no momento do início) | opcional |
| iniciada_em | data e hora | opcional (vazio em rascunho) |
| concluida_em | data e hora | opcional |
| tempo_gasto_segundos | número | opcional |
| custo_usd | número decimal | opcional |
| criada_em | data e hora | sim |

### Referência usada na criação (ligação)

| Atributo | Tipo | Obrigatório |
|---|---|---|
| criacao_id | referência a Criação | sim |
| referencia_id | referência a Referência | sim |
| papel | escolha: `referencia` / `primeiro_quadro` / `ultimo_quadro` | sim |

### Broll

O arquivo pronto de uma criação. Uma criação pode ter mais de um broll, quando o modelo devolve várias imagens.

| Atributo | Tipo | Obrigatório |
|---|---|---|
| id | identificador | sim |
| criacao_id | referência a Criação | sim |
| indice | número | sim |
| arquivo | caminho do arquivo local | sim |
| formato | texto (`video/mp4`, `image/png`…) | sim |
| largura / altura | número | opcional |
| duracao_segundos | número | só vídeo |
| tamanho_bytes | número | sim |
| miniatura | caminho do arquivo local | opcional |
| criado_em | data e hora | sim |

### Catálogo de modelos (cache, não é dado do usuário)

| Atributo | Tipo | Obrigatório |
|---|---|---|
| id | texto (id na OpenRouter) | sim |
| categoria | escolha: `llm` / `imagem` / `video` | sim |
| nome, descricao | texto | sim |
| capacidades | dados estruturados (durações, resoluções, proporções, entradas aceitas, parâmetros) | sim |
| precos | dados estruturados | sim |
| atualizado_em | data e hora | sim |

O **tempo médio por modelo** não é guardado: é calculado a partir das criações `pronto` (tempo_gasto_segundos) do mesmo modelo e com parâmetros parecidos.

## Relacionamentos

- Sessão 1 → N Mensagem
- Sessão 1 → N Referência
- Sessão 1 → N Criação
- Criação 1 → N Criação (versões: `versao_de_id`, formando uma árvore; dá para partir de qualquer versão)
- Criação N ↔ N Referência (via "Referência usada na criação", com papel)
- Criação 1 → N Broll
- Broll 1 → 0..N Referência (um broll de imagem que virou referência, via `broll_origem_id`)
- Mensagem 1 → 0..1 Referência (áudio da mensagem)

## Exemplos preenchidos

**Sessão:** id `s_01`, nome "Vídeo: erro de CORS no React", llm `anthropic/claude-opus-5.5`, criada_em 2026-09-24 14:00, ultimo_uso_em 2026-09-24 15:20.

**Mensagem:** id `m_07`, sessao `s_01`, autor `usuario`, texto "Quero um take de um app de tarefas bonito mostrando um erro de CORS no console", áudio vazio, criada_em 2026-09-24 14:05.

**Referência:** id `r_03`, sessao `s_01`, tipo `imagem`, origem `anexada`, arquivo `backend/data/sessoes/s_01/referencias/r_03.png`, nome_original "print-app.png", formato `image/png`, tamanho 842 KB.

**Criação:** id `c_12`, sessao `s_01`, versao_de `c_10`, raiz `c_10`, numero_versao 2, tipo `video`, modelo `google/veo-3.1-fast`, prompt "Screen recording de um app de tarefas minimalista, o cursor clica em Salvar e aparece um erro de CORS no console do DevTools…", orientacao `vertical 9:16`, duracao 8 s, resolucao `1080p`, situacao `pronto`, estimativa 95 s, tempo_gasto 102 s, custo_usd 0.80.

**Referência usada na criação:** criacao `c_12`, referencia `r_05` (imagem gerada, broll_origem `b_15` da criação `c_09`), papel `primeiro_quadro`.

**Broll:** id `b_20`, criacao `c_12`, indice 0, arquivo `backend/data/sessoes/s_01/brolls/b_20.mp4`, formato `video/mp4`, 1080×1920, 8 s, 14 MB, miniatura `…/b_20.jpg`.

**Catálogo de modelos:** id `google/veo-3.1-fast`, categoria `video`, capacidades {durações [4, 6, 8], resoluções [720p, 1080p], proporções [16:9, 9:16]}, preços {"a partir de US$ 0.10/segundo"}, atualizado_em 2026-09-24 09:00.

## Dados sensíveis

- **Chave da OpenRouter:** não fica no banco. Fica só em `backend/.env`, lida pelo backend.
- **Conversas, áudios e referências:** são privados do dono. Ficam só na máquina local e só saem dela para a OpenRouter no momento de uma chamada.
- Não há senhas nem dados pessoais de terceiros.

## Dados com arquivos ou imagens

- Referência: imagens, arquivos de texto e áudios anexados.
- Mensagem: áudio gravado (guardado como Referência do tipo `audio`).
- Broll: imagens e vídeos gerados, com miniatura.

## Implicações técnicas

- **Dono dos dados e isolamento:** existe um único usuário, e a entidade que agrupa tudo é a **Sessão**. Toda Mensagem, Referência, Criação e Broll pertence a uma sessão. O backend sempre busca e altera dados a partir da sessão, validando que o item pertence a ela (ex.: uma criação só usa referências da própria sessão). Nenhuma tabela tem `user_id` agora, mas a Sessão é o lugar natural para acrescentá-lo no futuro.
- **Proteção adicional:** o segredo fica no `.env`, fora do git. O backend não expõe caminhos de arquivo absolutos: os arquivos são servidos por id, e o caminho é validado para ficar dentro da pasta de dados. O backend escuta só no localhost.
- **Armazenamento de arquivos:** ficam no disco local, numa pasta de dados do app organizada por sessão (`backend/data/sessoes/{id}/referencias`, `…/brolls`). O banco guarda só o caminho relativo e os metadados. A pasta `backend/data/` fica fora do git. Os vídeos da OpenRouter são baixados assim que ficam prontos, porque o link exige a chave e não é permanente.
- **Volume estimado:** ~4 conteúdos por semana × ~20 criações por sessão (contando versões), com vídeos de 5 a 30 MB. Isso dá cerca de 1 a 2 GB por semana, ou algo como 50 a 100 GB por ano. O banco em si é pequeno. *Assumido:* não há limpeza automática, e o espaço usado pode ser mostrado no futuro.
- **Histórico:** a **Criação** tem versionamento explícito, em árvore (`versao_de_id` / `raiz_id` / `numero_versao`). Nenhuma versão é sobrescrita e qualquer versão pode ser base de uma nova. Mensagens formam o histórico natural da sessão. As demais entidades guardam só o estado atual.
- **Exclusão lógica ou física:**
  - Sessão: exclusão **física** em cascata (mensagens, referências, criações, brolls e arquivos), com confirmação na tela.
  - Criação: se tiver versões filhas, a exclusão é **lógica** (situação `apagado` e arquivos removidos), para não quebrar a árvore. Sem filhas, a exclusão é física.
  - Referência: exclusão física. Se estiver ligada a alguma criação, o backend bloqueia e explica (*assumido*), para que a versão continue reproduzível.
  - Broll: segue a criação.
- **Backup:** banco + arquivos são os dados do usuário e ficam todos em `backend/data/` (banco em `backend/data/fillframe.db`). *Assumido:* o app não faz backup automático. Copiar a pasta `backend/data/` com o app parado é o backup completo.
