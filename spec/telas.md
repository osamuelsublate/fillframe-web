# Telas

## Conceito central: sessão

Cada **sessão** representa um fluxo de trabalho: um **conteúdo** que ele vai gravar. Dentro de uma sessão são criados N brolls, e o contexto da sessão (conversa, referências, brolls já gerados) é usado na construção de todos os brolls daquele conteúdo. As sessões ficam guardadas num **histórico de sessões**, ordenado pelo último uso.

## Telas da primeira versão

O app tem **uma tela só**, no estilo do layout do Claude: um chat principal e, quando algo precisa ser visual, um painel que divide a mesma tela.

### Tela única: Sessão

- **Objetivo:** criar os brolls de um conteúdo conversando com a LLM e acompanhar tudo sem trocar de tela.
- **Quem acessa:** o dono (único usuário).
- **Áreas:**

**1. Histórico de sessões (lateral esquerda, abre e fecha)**
- Mostra a lista de sessões ordenada pelo último uso, com o nome de cada uma.
- Ações disponíveis: nova sessão, abrir sessão, renomear sessão, apagar sessão.

**2. Chat (centro, área principal)**
- Mostra a conversa da sessão com a LLM, com as respostas aparecendo aos poucos.
- Ações disponíveis:
  - Escrever mensagem.
  - Gravar e enviar áudio.
  - Anexar imagens e arquivos de texto como referência.
  - Escolher a LLM da sessão (Opus 5.5 ou o último modelo da MiniMax).

**3. Painel (direita, abre dividindo a tela quando algo precisa ser visual)**
- **Aba Criação:**
  - As referências em imagem da sessão. Dá para remover uma referência que ainda não foi usada (*assumido*, a partir da regra em `spec/dados.md`).
  - A configuração antes de gerar. A LLM já deixa preenchida e ele ajusta: tipo (imagem ou vídeo), modelo (qualquer modelo de imagem ou vídeo da OpenRouter, com preço e o que cada um aceita), vertical ou horizontal, duração, resolução, prompt e referências usadas.
  - O botão **Gerar**. Só o usuário aciona. A LLM prepara, mas nunca dispara uma geração sozinha.
  - O acompanhamento de cada item em criação: contador de tempo e barra de progresso. A barra se baseia na média de tempo das últimas criações daquele modelo. Várias criações podem rodar ao mesmo tempo, cada uma com o seu contador.
  - O resultado: player do vídeo ou a imagem, com baixar, usar como referência (a imagem vira referência para um vídeo) e apagar. Um seletor de versões (v1, v2, v3…) permite voltar a uma versão anterior para consultar ou partir dela para uma nova versão.
- **Aba Galeria:**
  - Os brolls e as imagens da sessão atual, com filtro de imagem ou vídeo e de vertical ou horizontal.
  - Ações disponíveis: baixar, mandar de volta para o chat como referência, apagar.
  - *Assumido:* existe uma opção "todas as sessões" para ver tudo o que já foi gerado.

## Fluxo de primeiro acesso

1. Ele abre o localhost e o app já cai numa sessão nova e vazia, sem login e sem tutorial.
2. O chat pede que ele conte qual é o conteúdo que vai gravar.
3. *Assumido:* se a chave da OpenRouter não estiver configurada ou for inválida, o app mostra um aviso claro no lugar do chat.

## Fluxo de uso diário (dono)

1. Ele abre o app e vê a última sessão usada. Pode criar uma sessão nova para um novo conteúdo ou continuar uma do histórico.
2. Descreve no chat os brolls que precisa (texto ou áudio) e anexa referências.
3. A LLM propõe os brolls e prepara a configuração de cada um no painel.
4. Ele revisa, ajusta modelo, formato e duração e clica em **Gerar**.
5. Acompanha o contador e a barra de progresso. Enquanto isso, pode continuar conversando ou preparar o próximo broll.
6. Quando fica pronto, ele assiste no player, pede ajustes no chat (gerando nova versão), usa a imagem como referência para um vídeo ou baixa o broll.
7. No fim, a Galeria da sessão reúne todos os brolls daquele conteúdo.

## Funções da primeira versão (lista fechada)

1. Sessões: criar, abrir, renomear e apagar, com histórico ordenado pelo último uso.
2. Chat com LLM (Opus 5.5 ou o último modelo da MiniMax), com respostas aparecendo aos poucos e usando o contexto da sessão.
3. Envio de áudio, imagens e arquivos de texto no chat.
4. Painel lateral com as abas Criação e Galeria.
5. A LLM prepara a configuração de geração de imagem ou vídeo, e o usuário ajusta e aciona **Gerar**.
6. Escolha entre todos os modelos de imagem e de vídeo da OpenRouter, com preço e capacidades de cada um.
7. Vertical e horizontal.
8. Imagem gerada usada como referência para vídeo.
9. Contador de tempo e barra de progresso por item, com estimativa baseada na média de tempo de cada modelo.
10. Várias criações ao mesmo tempo.
11. Player de vídeo, visualização de imagem e baixar.
12. Galeria por sessão e geral, com filtros.
13. Apagar sessões e itens (*assumido*, com confirmação antes de apagar).

## Funções adiadas

- Aviso quando a criação termina (som ou notificação do navegador). Por enquanto ele acompanha pelo contador na tela.
- Editar o vídeo final (cortes, legendas, trilha).
- Postar direto no Instagram.
- Contas e acesso para outras pessoas.

## Critério de sucesso

*Assumido:* depois de uma semana, os brolls de pelo menos um conteúdo gravado vieram do FillFrame, sem ele precisar criar nenhum app só para gravar a tela.

## Implicações técnicas

### Operações que o backend expõe na API

| Ação na tela | Operação da API |
|---|---|
| Ver histórico | listar sessões (ordenadas pelo último uso) |
| Nova sessão | criar sessão |
| Abrir sessão | abrir sessão (mensagens, referências, gerações) |
| Renomear sessão | renomear sessão |
| Apagar sessão | apagar sessão (e os arquivos dela) |
| Enviar mensagem | enviar mensagem ao chat (resposta em streaming) |
| Gravar áudio | enviar áudio (transcrever, se a LLM não aceitar áudio) |
| Anexar referência | enviar arquivo de referência (imagem, texto ou áudio) |
| Ver referências | listar referências da sessão |
| Remover referência | apagar referência (bloqueado se já usada numa criação) |
| Escolher LLM | listar LLMs disponíveis / definir LLM da sessão |
| Ver modelos | listar modelos de imagem / listar modelos de vídeo (com capacidades e preço, em cache) |
| A LLM prepara a geração | criar rascunho de geração (via tool da LLM) |
| Ajustar configuração | editar rascunho de geração |
| Partir de uma versão | criar nova versão (rascunho) a partir de uma criação — *assumido*, vem do versionamento em `spec/dados.md` |
| Clicar em Gerar | iniciar geração |
| Acompanhar | consultar andamento das gerações da sessão |
| Ver resultado / baixar | obter arquivo gerado |
| Usar como referência | transformar item gerado em referência |
| Galeria | listar itens gerados (por sessão ou todos, com filtros) |
| Apagar item | apagar item gerado |

### Regras de negócio verificadas no backend

- **Gerar só com ação do usuário.** A tool da LLM só cria ou edita rascunhos. A geração só começa pela operação "iniciar geração", chamada pelo botão.
- **Validar a configuração contra o modelo.** Duração, resolução, proporção e número de referências são checados contra as capacidades do modelo escolhido (vindas de `/images/models`, `/videos/models` e dos endpoints) antes de chamar a OpenRouter.
- **Validar uploads.** Tipo e tamanho de áudio, imagem e texto.
- **Estimar o tempo.** A estimativa de cada item é a média do tempo real das últimas gerações concluídas do mesmo modelo, com parâmetros parecidos (tipo, duração, resolução). Sem histórico, usa um valor padrão por tipo. Se passar da estimativa, a barra fica perto do fim e o contador continua.
- **Contexto da LLM.** O contexto da sessão enviado à LLM inclui as mensagens, as referências e os resultados gerados na sessão.
- **Apagar.** Apagar sessão remove os itens e arquivos dela. A confirmação acontece na tela e o backend executa.

### Avisos

Nenhum aviso ativo na primeira versão. Não há processamento agendado (cron). Existe, porém, um **processamento em segundo plano** no backend: ele acompanha as gerações de vídeo na OpenRouter (consulta de status), baixa o arquivo quando fica pronto e registra o tempo gasto. Esse acompanhamento continua mesmo se a página for fechada.

### Upload de arquivos

Sim: áudio gravado no navegador, imagens e arquivos de texto. Tudo fica guardado localmente, vinculado à sessão.

### Tempo real

Sim, em dois pontos:
- As respostas da LLM aparecem aos poucos (streaming).
- O andamento das gerações (status, contador, barra) é atualizado com frequência. O contador e a barra são calculados no frontend a partir do horário de início e da estimativa que o backend fornece, e o status real vem do backend (SSE ou consulta periódica curta).
