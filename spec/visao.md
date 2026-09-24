# Visão

## Nome provisório

FillFrame

## O que o app faz

FillFrame é um sistema web onde o usuário cria brolls (takes de aplicativos, erros que acontecem nos apps, diagramas que explicam conceitos, exemplos que parecem reais) para colocar nos vídeos de programação que ele publica nas redes sociais (Instagram com quase 100 mil seguidores, conteúdo da Asimov Academy). O centro do app é um chat com uma LLM forte, que recebe áudio, imagens e arquivos de texto como referência. A LLM controla todo o processo: usa tools para gerar imagens e vídeos com os modelos da OpenRouter, e uma imagem gerada pode servir de referência para um vídeo até chegar ao output final, na vertical ou na horizontal.

## Solução atual e por que falha

Hoje ele precisa gravar esses brolls por conta própria. Na maioria dos vídeos isso significa construir um app de verdade só para gravar a tela, reproduzir um erro ou montar um diagrama. Dá muito trabalho, e a IA já consegue gerar esse tipo de material com qualidade.

## Funções essenciais da primeira versão

- Chat com uma LLM forte (Opus 5.5 ou o último modelo da MiniMax) que aceita áudio, imagens e arquivos de texto como referência.
- A LLM usa tools para gerar imagens e vídeos com os modelos da OpenRouter e controla as execuções.
- Seção de modelos de imagem e seção de modelos de vídeo, com todos os modelos disponíveis na OpenRouter, para trocar de modelo e comparar os resultados.
- Brolls na vertical e na horizontal.
- Uma imagem gerada pode servir de referência para gerar um vídeo, seguindo o processo até o output final.
- Timer e barra de progresso enquanto uma imagem ou um vídeo está sendo gerado.
- Galeria com tudo o que foi gerado, com opção de baixar.

## Fora de escopo

- Editar o vídeo final (cortes, legendas, trilha).
- Postar direto no Instagram.
- Contas para equipe ou para outras pessoas.

## Perfil da pessoa

**Clara.** Descreve funções, fluxos e integrações por conta própria, traz a documentação e usa termos técnicos. Pode receber propostas prontas para confirmar.

Vocabulário: "broll", "takes", "vertical / horizontal", "modelo" (de imagem, de vídeo, LLM), "chat", "tool", "referência", "output final", "timer / barra de progresso", "sistema web", "apps bonitos", "erros que acontecem nos apps", "diagramas", "sessão" (um fluxo de trabalho = um conteúdo, com N brolls), "conteúdo", "histórico de sessão".

## Implicações técnicas

- **Tipo de uso:** pessoal. Um único usuário (o dono). Sem login, porque o app roda só no localhost (ver `spec/usuarios.md`).
- **Dispositivo:** computador (sistema web usado no navegador do desktop). O app roda só no localhost e o celular não está previsto (alinhado com `spec/usuarios.md`).
- **Integrações externas:** OpenRouter para as três coisas: a LLM do chat (chat completions com tool calling), a geração de imagens (`POST /api/v1/images`, síncrona, com streaming opcional) e a geração de vídeos (`POST /api/v1/videos`, assíncrona, com consulta de status). A lista de modelos vem da própria API (`/images/models` e `/videos/models`), nunca é fixada no código. Detalhes em `spec/referencias/openrouter.md`.
- **Chave de API:** fica só no backend, em `backend/.env`. O frontend nunca vê a chave e nunca chama a OpenRouter diretamente.
- **Áudio no chat:** se a LLM escolhida não aceitar áudio, o backend transcreve o áudio antes de enviar para ela (decidido em `spec/arquitetura.md`).
- **Jobs longos:** as gerações rodam no backend como tarefas acompanhadas (estado, tempo decorrido, progresso). O frontend consulta o backend para mostrar o timer e a barra de progresso. Os parâmetros (duração, resolução, proporção) são validados no backend contra as capacidades de cada modelo.
- **Armazenamento:** as imagens e os vídeos gerados, e os arquivos de referência enviados, são guardados pelo backend, porque os links de vídeo da OpenRouter exigem a chave e não são permanentes.
- **Sem internet:** não precisa funcionar. Depende da OpenRouter.
- **Importação de dados:** nenhuma.
