# Arquitetura

## Resumo para quem não é técnico

O FillFrame tem duas partes que rodam no seu computador: a **tela** (o que você vê no navegador) e o **motor** (que guarda tudo e conversa com a OpenRouter). A tela nunca fala direto com a OpenRouter nem vê a sua chave: ela sempre pede ao motor. Tudo o que você cria fica numa única pasta do projeto (`backend/data/`), e copiar essa pasta é o seu backup. Nenhuma imagem ou vídeo é gerado sem você clicar em **Gerar**, mesmo que a LLM tenha preparado tudo. Para usar, você abre dois terminais e roda um comando em cada um.

## Verificação de consistência (feita antes das decisões)

| # | Achado | Resolução |
|---|---|---|
| 1 | Sobre o celular, `visao.md` dizia "basta funcionar" e `usuarios.md` dizia "não previsto". | Alinhado: só computador, localhost. `visao.md` corrigido. |
| 2 | `visao.md` dizia que o login era necessário por causa dos créditos, e `usuarios.md` decidiu que não há login. | Já corrigido em `visao.md`: sem login, protegido por rodar só em `127.0.0.1`. |
| 3 | A transcrição de áudio estava "a decidir no plano". | Decidido aqui (seção 2). `visao.md` atualizado. |
| 4 | "Usar como referência" parte de um **broll**, mas a Referência apontava para uma Criação (e uma criação pode ter vários brolls). | Campo trocado para `broll_origem_id` em `dados.md`. |
| 5 | `dados.md` tinha a regra de apagar referência, mas `telas.md` não tinha a ação nem a operação. | Acrescentadas em `telas.md` (*assumido*). |
| 6 | O versionamento (voltar a uma versão e partir dela) não tinha ação de tela nem operação. | Acrescentados em `telas.md` o seletor de versões e a operação "criar nova versão" (*assumido*). |
| 7 | Os caminhos da pasta de dados e do `.env` não estavam fixados. | Fixados em `backend/data/` e `backend/.env`. Os arquivos foram atualizados e o `.env` foi movido. |
| 8 | Entrada de usuários: existe um único usuário, sem login, e não há como outras pessoas entrarem. | Coerente com o fora de escopo. Nada a fazer. |
| 9 | Perguntas sobre funcionar sem internet e importar dados. | Já respondidas em `visao.md` (não e não). Nenhuma pergunta necessária. |

**Itens "assumido" ainda não confirmados pelo usuário** (valem até ele dizer o contrário):
- Galeria com opção "todas as sessões".
- Aviso na tela quando a chave da OpenRouter falta ou é inválida.
- Apagar com confirmação.
- Critério de sucesso.
- Referência usada numa criação não pode ser apagada.
- Exclusão lógica de criação com versões filhas.
- Sem backup automático.
- Sem limpeza automática de arquivos.
- Operação "criar nova versão".
- Remover referência.

## 1. Separação

```
fillframe-web/
├── backend/    API (Python). Único lugar com a chave, o banco e os arquivos.
├── frontend/   Tela (navegador). Só fala com a API do backend.
└── spec/       Especificação.
```

**Por quê:** cada parte pode ser trocada ou corrigida sem mexer na outra. A tela nunca tem acesso à chave nem aos dados diretamente.

## 2. Stack

### Backend

- **Python 3.12 + FastAPI.** É simples, rápido e já valida as entradas automaticamente, e tem streaming (SSE) para o chat.
- **SQLite** (arquivo único `backend/data/fillframe.db`). As entidades têm relacionamentos (sessão → criações → brolls, versões em árvore, N↔N com referências), então um banco relacional num arquivo só é o certo.
- **SQLAlchemy 2** para falar com o banco, e **Alembic** para evoluir o banco sem perder dados. O Alembic permite mudar a estrutura do banco depois sem apagar o que já foi criado.
- **httpx** para chamar a OpenRouter. Ele permite várias chamadas ao mesmo tempo sem travar o app.
- **uv** para instalar e rodar o backend: um comando instala tudo e roda.

### Frontend

- **React + TypeScript + Vite.** É a opção mais madura e documentada, e o mesmo código funciona no computador e no celular, caso isso seja preciso no futuro.
- **Tailwind CSS** para o visual: layout de chat e painel dividido sem arquivos de estilo espalhados.
- **TanStack Query** para buscar dados da API e atualizar o andamento das criações sozinho, com cache e nova tentativa automática.
- Gravação de áudio com o **MediaRecorder** nativo do navegador, sem biblioteca extra.

### LLM e transcrição

- **LLM do chat:** via OpenRouter (chat completions com tool calling). As LLMs permitidas ficam configuradas no `.env`: `anthropic/claude-opus-5.5` como padrão e o modelo MiniMax mais recente, resolvido pelo catálogo como o modelo de texto mais novo da `minimax` com suporte a tools. Os ids exatos são confirmados no catálogo quando o app inicia.
- **Áudio:** se a LLM da sessão aceita áudio como entrada (o catálogo da OpenRouter informa `input_modalities`), o áudio vai direto para ela. Se não aceita, o backend transcreve primeiro com um modelo da OpenRouter que aceite áudio (configurável em `.env`) e manda o texto. A transcrição fica salva na mensagem. **Por quê:** funciona com qualquer LLM escolhida e usa uma chave só.

## 3. Autenticação e autorização

- **Entrada:** sem login (decisão de `usuarios.md`).
- **Proteção:** o backend escuta **somente em `127.0.0.1`**, e o frontend (Vite) também. Ninguém na rede consegue acessar. O CORS só aceita a origem local do frontend. Na prática, o frontend usa o proxy do Vite (`/api` → backend), então tudo fica na mesma origem.
- **Identificação de quem chama:** não há. Existe um papel único (dono) que pode fazer todas as ações.
- **Isolamento:** a unidade é a **sessão**. Todas as rotas de itens ficam aninhadas na sessão (`/sessoes/{id}/...`), e a camada de acesso a dados sempre filtra por `sessao_id`. Um item de outra sessão devolve 404, e uma criação não aceita referências de outra sessão.
- **Futuro:** se o app for para a internet, entra autenticação e um `user_id` na Sessão. Como todo acesso já passa pela sessão, o filtro é acrescentado num lugar só. Essa mudança começa pela spec.
- **Por quê:** não há senha para guardar nem tela de login, e o risco de outra pessoa gastar os créditos fica eliminado pelo acesso só local.

## 4. Proteção de dados

- **Segredo:** a chave fica só em `backend/.env`, nunca é devolvida por nenhuma rota e nunca aparece em log.
- **Arquivos:**
  - Ficam em `backend/data/sessoes/{sessao_id}/referencias/` e `.../brolls/` (e miniaturas).
  - O banco guarda caminhos relativos. Os arquivos são servidos por id (`/arquivos/...`), e o backend confere se o caminho resolvido está dentro de `backend/data/`.
  - Os nomes no disco são gerados pelo app, nunca o nome original do upload.
- **Uploads:**
  - Tipo validado pelo conteúdo, não só pela extensão.
  - Limites: imagem até 20 MB (png, jpeg, webp); texto até 2 MB (txt, md, json, código em texto); áudio até 25 MB (webm, mp3, wav, m4a).
- **Exclusão:**
  - Sessão: física, em cascata (banco e pasta da sessão).
  - Criação com versões filhas: lógica (`apagado`, arquivos removidos, registro mantido para a árvore).
  - Criação sem filhas: física.
  - Referência ligada a uma criação: bloqueada, com mensagem.
- **Backup:** tudo fica em **`backend/data/`** (banco `backend/data/fillframe.db` + arquivos). Copiar essa pasta com o backend parado é o backup completo. A pasta fica fora do git.

## 5. Organização interna

### Backend: por assunto, com camadas dentro de cada assunto

```
backend/
├── pyproject.toml
├── .env / .env.example
├── alembic/                  migrações do banco
├── data/                     banco + arquivos (fora do git)
└── app/
    ├── main.py               cria o app, CORS, rotas, inicia/retoma tarefas
    ├── config.py             lê o .env
    ├── db.py                 conexão SQLite (sessão do banco)
    ├── openrouter/           cliente único da OpenRouter (chat, imagens, vídeos, catálogo)
    ├── arquivos/             salvar/ler/apagar arquivos em data/, validação de upload
    ├── sessoes/              rotas.py · servico.py · repositorio.py · modelos.py · esquemas.py
    ├── chat/                 mensagens, streaming, montagem do contexto, tools da LLM, transcrição
    ├── referencias/
    ├── criacoes/             rascunhos, versões, validação contra o modelo, estimativa de tempo
    ├── geracao/              executor em segundo plano (imagens e vídeos)
    ├── brolls/               galeria e arquivos gerados
    └── modelos/              catálogo (LLM, imagem, vídeo) com cache no banco
```

- `rotas.py` só recebe e responde.
- `servico.py` tem as regras de negócio.
- `repositorio.py` só acessa o banco.
- `esquemas.py` define o formato de entrada e saída da API.

### Frontend: telas, componentes e API separados

```
frontend/src/
├── api/            um arquivo por assunto (sessoes.ts, chat.ts, criacoes.ts…), única porta para o backend
├── telas/          Sessao.tsx (a tela única)
├── componentes/    HistoricoSessoes, Chat, Mensagem, GravadorAudio, Painel, AbaCriacao,
│                   ConfigCriacao, SeletorModelo, ProgressoCriacao, SeletorVersoes,
│                   PlayerBroll, AbaGaleria
└── utils/
```

**Por quê:** quando algo muda (ex.: a OpenRouter muda um detalhe da API de vídeo), só um lugar é mexido (`openrouter/` ou `geracao/`), e o resto do app não percebe.

## 6. Contrato da API

Todas as rotas ficam sob `/api` e só o frontend chama. Os erros são sempre `{ "erro": "mensagem em português" }`, com o código HTTP adequado.

### Sistema

| Operação | Rota | Recebe | Devolve | Regras |
|---|---|---|---|---|
| Situação do app | `GET /api/status` | – | `{chave_configurada, chave_valida, catalogo_atualizado_em}` | Testa a chave na OpenRouter (com cache curto). Alimenta o aviso de primeiro acesso. |

### Sessões

| Operação | Rota | Recebe | Devolve | Regras |
|---|---|---|---|---|
| Listar sessões | `GET /api/sessoes` | – | lista `{id, nome, llm, ultimo_uso_em}` | Ordena por `ultimo_uso_em` desc. |
| Criar sessão | `POST /api/sessoes` | `{nome?, llm?}` | sessão | A LLM precisa estar entre as permitidas. Padrão do `.env`. |
| Abrir sessão | `GET /api/sessoes/{id}` | – | sessão + mensagens + referências + criações (com brolls) | 404 se não existir. |
| Renomear / trocar LLM | `PATCH /api/sessoes/{id}` | `{nome?, llm?}` | sessão | Nome de 1 a 120 caracteres. LLM entre as permitidas. |
| Apagar sessão | `DELETE /api/sessoes/{id}` | – | 204 | Cancela o acompanhamento de criações `gerando` dela e apaga banco e pasta. |

### Chat

| Operação | Rota | Recebe | Devolve | Regras |
|---|---|---|---|---|
| Enviar mensagem | `POST /api/sessoes/{id}/mensagens` | `{texto?, audio_referencia_id?, referencia_ids[]}` | **SSE**: `texto` (pedaços), `tool` (rascunho criado ou alterado, com id), `fim`, `erro` | Precisa de texto ou áudio. As referências devem ser da sessão. Transcreve o áudio se preciso. Monta o contexto da sessão. Salva as mensagens. Atualiza `ultimo_uso_em`. |
| Listar LLMs | `GET /api/modelos/llm` | – | lista permitida com `{id, nome, aceita_audio, aceita_imagem}` | Vem do catálogo em cache. |

**Tools que a LLM pode usar** (executadas pelo backend, nunca pelo frontend):

| Tool | Faz | Não pode |
|---|---|---|
| `listar_modelos` | lista modelos de imagem ou vídeo com capacidades e preço (com filtros) | – |
| `preparar_criacao` | cria rascunho (tipo, modelo, prompt, orientação, duração, resolução, referências) | iniciar geração |
| `ajustar_criacao` | edita um rascunho, ou cria um rascunho de nova versão a partir de uma criação | iniciar geração |
| `ver_criacoes` | lista as criações e versões da sessão, com situação | – |

A saída das tools é validada pelas mesmas regras das rotas de criação. Se um parâmetro for inválido, a tool devolve o erro para a própria LLM corrigir.

**Contexto enviado à LLM:**
- Prompt de sistema (papel de diretor de brolls para vídeos de programação, vertical e horizontal, regra de nunca gerar sozinho).
- Mensagens da sessão.
- Imagens de referência como entrada de imagem, quando a LLM aceita.
- Arquivos de texto inline.
- Resumo das criações e versões da sessão.

Se passar do limite de contexto da LLM, as mensagens mais antigas entram resumidas.

### Referências

| Operação | Rota | Recebe | Devolve | Regras |
|---|---|---|---|---|
| Enviar referência | `POST /api/sessoes/{id}/referencias` | multipart: arquivo + `tipo` | referência | Validação de tipo e tamanho (seção 4). |
| Listar referências | `GET /api/sessoes/{id}/referencias` | – | lista | Só da sessão. |
| Usar broll como referência | `POST /api/sessoes/{id}/referencias/de-broll` | `{broll_id}` | referência (`origem=gerada`) | O broll precisa ser da sessão e ser imagem. |
| Apagar referência | `DELETE /api/sessoes/{id}/referencias/{rid}` | – | 204 ou 409 | 409 se estiver ligada a alguma criação. |

### Criações

| Operação | Rota | Recebe | Devolve | Regras |
|---|---|---|---|---|
| Criar rascunho | `POST /api/sessoes/{id}/criacoes` | `{tipo, modelo, prompt, orientacao, duracao?, resolucao?, parametros_extras?, referencias[{id, papel}]}` | criação `rascunho` | O modelo existe no catálogo e é do tipo certo. Os parâmetros são validados contra as capacidades. As referências são da sessão e o papel é compatível com o modelo. |
| Editar rascunho | `PATCH /api/sessoes/{id}/criacoes/{cid}` | os mesmos campos, parciais | criação | Só em `rascunho`, com as mesmas validações. |
| Nova versão | `POST /api/sessoes/{id}/criacoes/{cid}/versoes` | campos a mudar (opcional) | nova criação `rascunho` com `versao_de_id=cid`, mesma `raiz_id`, `numero_versao` seguinte | Parte de qualquer versão, exceto `apagado`. |
| Gerar | `POST /api/sessoes/{id}/criacoes/{cid}/gerar` | – | criação `gerando` com `iniciada_em` e `estimativa_segundos` | Só em `rascunho`. Revalida contra o catálogo atual. Única rota que dispara geração. Enfileira no executor. |
| Andamento | `GET /api/sessoes/{id}/criacoes?situacao=gerando,pronto,falhou` | filtros | lista com `{id, situacao, iniciada_em, estimativa_segundos, erro, brolls}` | O frontend consulta a cada 2 s enquanto houver `gerando`. |
| Versões | `GET /api/sessoes/{id}/criacoes/{cid}/versoes` | – | árvore de versões da raiz | – |
| Apagar criação | `DELETE /api/sessoes/{id}/criacoes/{cid}` | – | 204 | Com versões filhas vira `apagado` (lógica). Sem filhas é física. Se estiver `gerando`, para o acompanhamento. |

### Brolls e galeria

| Operação | Rota | Recebe | Devolve | Regras |
|---|---|---|---|---|
| Galeria | `GET /api/brolls?sessao_id=&tipo=&orientacao=` | filtros (sem `sessao_id` traz todas as sessões) | lista com miniatura, sessão, criação e versão | Ordem: mais recentes primeiro. |
| Arquivo | `GET /api/arquivos/brolls/{bid}` e `/api/arquivos/referencias/{rid}` | `?download=1` opcional | o arquivo (com suporte a Range para o player de vídeo) | Caminho validado dentro de `data/`. |

### Modelos (catálogo)

| Operação | Rota | Recebe | Devolve | Regras |
|---|---|---|---|---|
| Listar modelos de imagem | `GET /api/modelos/imagem` | busca opcional | `{id, nome, descricao, capacidades, precos, tempo_medio_segundos}` | Cache no banco, atualizado ao iniciar se tiver mais de 24 h e sob demanda. |
| Listar modelos de vídeo | `GET /api/modelos/video` | busca opcional | idem | Idem. |
| Atualizar catálogo | `POST /api/modelos/atualizar` | – | `{atualizado_em}` | Busca `/images/models`, `/videos/models` e `/models` na OpenRouter. |

**Estimativa de tempo:** é a média de `tempo_gasto_segundos` das últimas 10 criações `pronto` do mesmo modelo, preferindo as de mesmo tipo, duração e resolução. Sem histórico, o padrão é 30 s para imagem e 120 s para vídeo (*assumido*). No frontend, a barra vai até 95% da estimativa e para ali, e o contador segue até o status real mudar.

## 7. Processamento em segundo plano

Não há tarefa agendada nem aviso, só o **executor de gerações** dentro do próprio processo do backend (tarefas assíncronas, sem servidor extra).

- **Imagem:** chama `POST /api/v1/images`, salva cada item de `data[]` como Broll (decodifica o base64 e gera miniatura) e registra custo e tempo.
- **Vídeo:**
  1. Chama `POST /api/v1/videos` e guarda `id_job_openrouter`.
  2. Consulta o status a cada 10 s.
  3. Em `completed`, baixa cada `unsigned_urls[i]` com a chave e salva como Broll, com miniatura.
  4. Em `failed`, `cancelled` ou `expired`, marca a criação como `falhou` com o erro.
- **Limite de simultaneidade:** até 4 gerações ao mesmo tempo (configurável). As demais esperam em `gerando`, com `iniciada_em` marcado só quando realmente começam.
- **Reinício do backend:**
  - Vídeos `gerando` com `id_job_openrouter` voltam a ser acompanhados.
  - Imagens `gerando` viram `falhou` ("interrompida"). A OpenRouter não cobra imagem que não foi entregue.
- **Por quê:** não precisa de fila nem de serviço extra, e o acompanhamento continua mesmo com a aba fechada. Não usamos webhook porque o app roda em localhost, e a OpenRouter não alcança o seu computador.

## 8. Segredos

- `backend/.env`: valores reais, fora do git (já criado com a sua chave).
- `backend/.env.example`: mesmas variáveis, sem valores, versionado.

```
OPENROUTER_API_KEY=
FILLFRAME_LLM_PADRAO=anthropic/claude-opus-5.5
FILLFRAME_LLMS_PERMITIDAS=anthropic/claude-opus-5.5,minimax:ultimo
FILLFRAME_MODELO_TRANSCRICAO=
FILLFRAME_GERACOES_SIMULTANEAS=4
```

**Por quê:** trocar a chave ou o modelo padrão não exige mexer no código.

## 9. Execução local

Pré-requisitos, instalados uma vez: **uv** e **Node.js 20+**.

Terminal 1, backend (instala dependências, aplica migrações e sobe em `127.0.0.1:8000`):
```bash
cd backend && uv run fillframe
```

Terminal 2, frontend (sobe em `http://127.0.0.1:5173`):
```bash
cd frontend && npm install && npm run dev
```

Depois é só abrir `http://127.0.0.1:5173` no navegador. O `npm install` só é necessário na primeira vez.

**Por quê:** é um comando por parte, sem Docker e sem banco para instalar.
