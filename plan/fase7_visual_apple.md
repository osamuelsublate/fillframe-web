# Fase 7: Visual no estilo Apple

Objetivo: o FillFrame com cara de app da Apple no Mac (spec/telas.md, "Visual"), no modo claro e no escuro, sem mudar nenhuma função nem o layout aprovado.
Depende de: Fase 6

Por que três ondas: cada uma troca o visual de uma parte da tela e pode ser conferida sozinha no navegador. O modo escuro só é ligado na última, quando todas as partes já usam as cores novas; antes disso, uma parte antiga ficaria clara no meio da tela escura.

## Onda 7.1: Base do visual e moldura da tela
Status: concluída (2026-10-12)
Objetivo: as cores, a fonte, os raios e as animações da Apple ficam definidos num lugar só, e a moldura da tela (histórico, cabeçalhos, abas do painel, avisos e confirmações) já aparece no estilo novo.
Depende de: 6.2
Ler antes: spec/telas.md ("Visual", "Tela única: Sessão"); spec/arquitetura.md (seção 2, Frontend)
Escopo:
  Backend: nenhum
  Frontend: frontend/src/index.css, frontend/index.html, frontend/package.json (fonte Inter), frontend/src/telas/Sessao.tsx, frontend/src/componentes/HistoricoSessoes.tsx, Painel.tsx, Icones.tsx, Avisos.tsx, Confirmacao.tsx, AvisoChave.tsx, Segmentado.tsx (novo: controle segmentado, reaproveitado na 7.3)
  Dados: nenhuma
  Não tocar: comportamento das telas, chat e conteúdo das abas (ondas 7.2 e 7.3)
Tarefas:
1. `index.css`: variáveis de cor da Apple (azul, vermelho, verde, laranja, cinzas, textos primário a quaternário, fundos, separadores, preenchimentos) com versão clara e escura, ligadas ao tema do Tailwind com nomes em português (`fundo`, `superficie`, `lateral`, `rotulo`, `separador`, `azul`…). A versão escura fica escrita, mas desligada até a 7.3.
2. Fonte: SF Pro do sistema primeiro e Inter (pacote `@fontsource-variable/inter`) como reserva; tamanhos de Mac (13 px na interface).
3. Raios, sombras, curvas e durações de animação da Apple; anel de foco azul em todo elemento clicável; respeito a "reduzir movimento".
4. Moldura: barra lateral do histórico no estilo do Finder (sessão aberta em destaque, menu de opções arredondado), cabeçalhos de 52 px, abas Criação/Galeria como controle segmentado, botões de ícone discretos.
5. Avisos (toast), aviso de chave e diálogo de apagar no estilo de alerta da Apple; o histórico passa a usar o mesmo `Confirmacao` da Galeria.
Aceite técnico:
* Nenhuma cor solta (`stone-*`, `red-*`…) nos arquivos da onda: só as variáveis.
* `npm run build` e `npm run lint` sem erros; sem erros no console.
* Janela de 900 px, 1280 px e 1920 px sem nada cortado.
Entrega: a moldura do app já tem cara de Mac.
Teste da pessoa:
1. Abra http://127.0.0.1:5173 : a barra lateral está cinza clara, a sessão aberta aparece destacada e a letra mudou.
2. Passe o mouse numa sessão e clique nos três pontinhos: o menu abre arredondado. Clique em Apagar e depois em Cancelar: o alerta aparece no estilo da Apple e nada é apagado.
3. No painel, alterne entre Criação e Galeria: as abas são dois botões grudados, e o escolhido fica em destaque.
4. Feche e abra o histórico e o painel pelos ícones do topo.

## Onda 7.2: Chat
Status: concluída (2026-10-12)
Objetivo: a conversa no estilo das mensagens da Apple: balões azuis do usuário à direita, respostas da LLM em texto corrido, caixa de mensagem arredondada.
Depende de: 7.1
Ler antes: spec/telas.md ("Visual", área "Chat")
Escopo:
  Backend: nenhum
  Frontend: frontend/src/componentes/Chat.tsx, Mensagem.tsx, GravadorAudio.tsx, Icones.tsx (ícones novos do chat)
  Dados: nenhuma
  Não tocar: envio, streaming, anexos e gravação (só aparência)
Tarefas:
1. Mensagens: balão azul do usuário com texto branco, resposta da LLM sem balão, texto de 15 px, anexos como miniaturas arredondadas, aviso de rascunho preparado como cartão com botão "Revisar".
2. Caixa de mensagem: campo arredondado com botões de anexar, gravar e enviar (enviar em pílula azul); estado de gravação com vermelho da Apple.
3. Seletor da LLM no cabeçalho como menu discreto no estilo Mac.
4. Estados vazios, carregando e de erro do chat com as cores novas.
Aceite técnico:
* Nenhuma cor solta nos arquivos da onda.
* Build e lint sem erros; sem erros no console numa conversa com resposta aos poucos.
Entrega: conversar já parece usar um app da Apple.
Teste da pessoa:
1. Mande uma mensagem: ela aparece num balão azul à direita, e a resposta vem aos poucos em texto corrido à esquerda.
2. Anexe uma imagem e grave um áudio curto: a miniatura e o botão de gravar aparecem no estilo novo.
3. Troque a LLM no topo: o menu abre no estilo Mac.

## Onda 7.3: Painel e modo escuro
Status: concluída (2026-10-12)
Objetivo: as abas Criação e Galeria no estilo novo e o modo escuro ligado em todo o app, seguindo o computador.
Depende de: 7.2
Ler antes: spec/telas.md ("Visual", área "Painel")
Escopo:
  Backend: nenhum
  Frontend: frontend/src/componentes/AbaCriacao.tsx, ConfigCriacao.tsx, SeletorModelo.tsx, ProgressoCriacao.tsx, PlayerBroll.tsx, SeletorVersoes.tsx, AbaGaleria.tsx, frontend/src/index.css (ligar o escuro)
  Dados: nenhuma
  Não tocar: regras de geração, versões e galeria (só aparência)
Tarefas:
1. Cartões das criações com cantos arredondados, selos de status (pronto em verde, em criação em azul, falhou em vermelho), barra de progresso fina azul.
2. Configuração da criação no estilo de formulário agrupado da Apple; Imagem/Vídeo e Vertical/Horizontal como controles segmentados; botão **Gerar** em pílula azul.
3. Seletor de modelos, seletor de versões e player no estilo novo.
4. Galeria: filtros como controles segmentados, grade de miniaturas arredondadas.
5. Ligar o modo escuro pelo `prefers-color-scheme` e conferir todas as áreas nele (contraste AA).
6. Procurar em `frontend/src/` qualquer cor solta que tenha sobrado e trocar pela variável.
Aceite técnico:
* Nenhuma cor solta em `frontend/src/` (exceções de propósito: texto branco sobre o azul e etiquetas pretas translúcidas sobre as fotos da Galeria, iguais nos dois modos).
* Build e lint sem erros; fluxo completo sem erros no console, no claro e no escuro.
Entrega: o FillFrame inteiro no estilo Apple, claro e escuro.
Teste da pessoa:
1. Na aba Criação, abra um rascunho, ajuste o tipo e o formato e clique em **Gerar**: o contador e a barra azul aparecem no cartão.
2. Na Galeria, use os filtros e baixe um item.
3. Mude o computador para o modo escuro (Configurações do sistema → Aparência): o app fica escuro sozinho, tudo legível.
