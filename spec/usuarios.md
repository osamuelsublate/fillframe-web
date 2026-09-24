# Usuários

## Tipos de usuário

### Dono (único tipo)

- **Contexto:** o criador de conteúdo da Asimov Academy (Instagram com quase 100 mil seguidores). Usa o FillFrame para gerar brolls para os vídeos de programação dele.
- **Familiaridade com tecnologia:** alta. Usa termos técnicos (LLM, tool, API, localhost), mas não quer programar o app.
- **O que faz no app:** tudo. Conversa com a LLM no chat, envia referências (áudio, imagens, arquivos de texto), escolhe modelos de imagem e de vídeo, acompanha o timer e a barra de progresso, vê a galeria e baixa os brolls.

## Regras de visibilidade

Não se aplicam, porque existe um só usuário e ele vê e faz tudo.

## Quem administra

O próprio dono. Não há pessoas para organizar ou remover.

## Forma de entrada

Sem login. Ele abre o endereço local (localhost) e já cai no app.

## Escala e dispositivo principal

- 1 pessoa.
- Computador, no navegador, rodando na própria máquina (localhost). *Assumido:* uso no celular não está previsto.

## Implicações técnicas

- **Autenticação:** nenhuma. Isso só é aceitável porque o app roda apenas localmente. O backend deve escutar somente em `127.0.0.1` (nunca em `0.0.0.0`), para que ninguém na mesma rede consiga acessar o app nem gastar os créditos da OpenRouter. Se um dia o app for para a internet, a autenticação passa a ser obrigatória, e essa mudança começa pela spec.
- **Autorização por papel:** não há. Com um único papel, a matriz papel x ação é: Dono → todas as ações.
- **Acesso anônimo:** na prática, todo acesso é anônimo, e a proteção vem de o app só estar disponível na máquina local. O frontend continua sem acesso direto à chave ou à OpenRouter: tudo passa pela API do backend.
- **Isolamento de dados:** não há separação por usuário. Existe um único espaço de dados (conversas, referências, imagens, vídeos, galeria). O modelo de dados não precisa de `user_id` por enquanto, mas deve ser possível acrescentá-lo depois sem reescrever o app.
- **Hospedagem:** nenhuma, porque tudo roda na máquina do usuário. O banco é local e leve (arquivo, sem servidor) e os arquivos gerados ficam numa pasta local. O app precisa subir com um comando simples. Sem preocupação com escala.
- **Segurança mínima que continua valendo:** a chave fica em `.env`, fora do git. O backend valida todas as entradas (inclusive tipo e tamanho dos arquivos de referência) e as regras de negócio (validação de parâmetros por modelo, controle de jobs) ficam no backend. O CORS aceita só a origem local do frontend.
