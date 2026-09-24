# Fase 5: Versões, galeria e organização

Objetivo: pedir ajustes criando novas versões e voltar a qualquer versão anterior, encontrar e baixar todos os brolls na Galeria, renomear e apagar sessões, e apagar criações e referências.
Depende de: Fase 4

## Onda 5.1: Versões de um broll
Status: pendente
Objetivo: criar uma nova versão a partir de qualquer versão de uma criação (pelo painel ou pedindo à LLM), e navegar entre v1, v2, v3… para consultar.
Depende de: 3.4
Ler antes: spec/dados.md (entidade Criação: `versao_de_id`, `raiz_id`, `numero_versao`; "Histórico"); spec/arquitetura.md (tabela "Criações": "Nova versão" e "Versões"); spec/telas.md ("Aba Criação", seletor de versões; "Fluxo de uso diário" passo 6)
Escopo:
  Backend: backend/app/criacoes/, backend/app/chat/tools.py
  Frontend: frontend/src/componentes/SeletorVersoes.tsx, frontend/src/componentes/AbaCriacao.tsx, frontend/src/componentes/PlayerBroll.tsx, frontend/src/api/criacoes.ts
  Dados: Criação (usa `versao_de_id`, `raiz_id`, `numero_versao`)
  Não tocar: backend/app/geracao/, backend/app/referencias/
Tarefas:
1. `backend/app/criacoes/servico.py`: criar versão. Copia a configuração (e as referências vinculadas) da criação base, aplica as mudanças pedidas, `versao_de_id` = base, `raiz_id` = raiz da base, `numero_versao` = maior número da árvore + 1, situação `rascunho`. A base não pode estar `apagado`.
2. Rotas: `POST /api/sessoes/{id}/criacoes/{cid}/versoes` e `GET /api/sessoes/{id}/criacoes/{cid}/versoes` (árvore da raiz, com situação e miniatura de cada versão).
3. `backend/app/chat/tools.py`: `ajustar_criacao` numa criação que não é rascunho passa a criar uma nova versão (nunca sobrescreve); `ver_criacoes` informa as versões.
4. `SeletorVersoes.tsx`: no resultado, pílulas v1, v2, v3… e "partiu de v2" quando for o caso; clicar mostra a versão (prompt, configuração, resultado).
5. `PlayerBroll.tsx`: botão "Nova versão a partir desta" que abre o rascunho da nova versão. A `AbaCriacao.tsx` agrupa os cartões por raiz (mostra a versão mais recente com o selo "v3").
Aceite técnico:
* A partir de v1, depois de existir v2, criar outra versão gera v3 com `versao_de_id` = v1.
* Nenhuma versão existente é alterada ao criar outra.
Entrega: versionamento completo de cada broll.
Teste da pessoa:
1. Com um broll pronto, peça no chat: "deixa o fundo do app mais escuro". Aparece um rascunho "v2" desse broll. Gere.
2. No resultado, clique em "v1": aparece a versão original, com prompt e vídeo ou imagem.
3. Estando na v1, clique em "Nova versão a partir desta", mude o prompt e gere: vira a "v3 (partiu de v1)".
4. Tente editar a configuração da v1 já pronta: os campos ficam travados, com o aviso "Versões prontas não mudam. Crie uma nova versão."

## Onda 5.2: Galeria
Status: pendente
Objetivo: ver todos os brolls da sessão (ou de todas as sessões) com filtros, baixar e mandar de volta para o chat como referência.
Depende de: 4.2
Ler antes: spec/telas.md ("Aba Galeria"); spec/arquitetura.md (tabela "Brolls e galeria": "Galeria")
Escopo:
  Backend: backend/app/brolls/
  Frontend: frontend/src/componentes/AbaGaleria.tsx, frontend/src/api/brolls.ts, frontend/src/componentes/Chat.tsx (receber referência vinda da galeria)
  Dados: nenhuma nova (leitura de Broll, Criação e Sessão)
  Não tocar: backend/app/criacoes/, backend/app/geracao/, backend/app/chat/
Tarefas:
1. `backend/app/brolls/`: `GET /api/brolls?sessao_id=&tipo=&orientacao=`. Sem `sessao_id`, traz todas as sessões. Cada item leva a miniatura, a sessão (id e nome), a criação e o número da versão. Ordem: mais recentes primeiro. Brolls de criações `apagado` ficam de fora.
2. `frontend/src/api/brolls.ts` + `AbaGaleria.tsx`: grade de miniaturas (vídeo com a primeira imagem e o selo da duração), filtros Imagem/Vídeo e Vertical/Horizontal, alternância "Esta sessão / Todas as sessões" e nome da sessão em cada item quando estiver em "Todas".
3. Ações em cada item: "Baixar" (`?download=1`), abrir em tamanho grande (player) e "Mandar para o chat". Para imagens, usa `POST .../referencias/de-broll` e anexa a referência na caixa do chat. De outra sessão, fica desativado com a dica "Abra a sessão deste broll".
Aceite técnico:
* Os filtros combinados retornam corretamente, e a lista de "Todas as sessões" traz itens de pelo menos duas sessões.
* Sem erro no console.
Entrega: todos os brolls de um conteúdo reunidos num lugar só.
Teste da pessoa:
1. Abra o painel, aba Galeria: aparecem os brolls desta sessão.
2. Filtre "Vídeo" + "Vertical": só ficam os vídeos verticais.
3. Mude para "Todas as sessões": aparecem os brolls das outras sessões, com o nome de cada uma.
4. Numa imagem desta sessão, clique em "Mandar para o chat": ela aparece anexada na caixa de mensagem.
5. Filtre algo que não existe (ex.: Vídeo + Horizontal numa sessão sem vídeo horizontal): deve aparecer "Nenhum broll com esses filtros".

## Onda 5.3: Renomear e apagar sessões
Status: pendente
Objetivo: renomear sessões e apagar uma sessão inteira (com confirmação), incluindo os arquivos dela.
Depende de: 3.3
Ler antes: spec/telas.md ("Histórico de sessões", regra "Apagar"); spec/dados.md ("Exclusão lógica ou física": Sessão); spec/arquitetura.md (tabela "Sessões": "Apagar sessão")
Escopo:
  Backend: backend/app/sessoes/, backend/app/geracao/ (cancelar acompanhamento), backend/app/arquivos/ (apagar pasta da sessão)
  Frontend: frontend/src/componentes/HistoricoSessoes.tsx, frontend/src/api/sessoes.ts
  Dados: Sessão (exclusão física em cascata)
  Não tocar: backend/app/chat/, backend/app/criacoes/
Tarefas:
1. `backend/app/geracao/executor.py`: função para cancelar o acompanhamento local das criações de uma sessão (não há cancelamento na OpenRouter; o resultado é descartado).
2. `backend/app/sessoes/`: `DELETE /api/sessoes/{id}`. Regra **Apagar**: cancela o acompanhamento, apaga no banco em cascata (mensagens, referências, vínculos, criações, brolls) e remove `backend/data/sessoes/{id}/`, na ordem banco → pasta.
3. `HistoricoSessoes.tsx`: menu "…" em cada sessão com "Renomear" (edição na própria linha, usando o `PATCH` da 2.2) e "Apagar" (diálogo "Apagar a sessão 'X' e todos os brolls dela? Não dá para desfazer."). Ao apagar a sessão aberta, ir para a próxima do histórico (ou criar uma nova).
Aceite técnico:
* Depois de apagar, a pasta da sessão não existe mais e não sobram linhas órfãs no banco.
* Apagar uma sessão com vídeo `gerando` não quebra o executor.
Entrega: histórico organizado, só com o que importa.
Teste da pessoa:
1. Na lateral, abra o menu de uma sessão, escolha "Renomear", escreva "CORS no React" e confirme.
2. Crie uma sessão de teste com uma imagem gerada. Abra o menu, escolha "Apagar" e confirme.
3. A sessão some do histórico, e os brolls dela somem da Galeria em "Todas as sessões".
4. Tente renomear com o nome vazio: deve aparecer "O nome não pode ficar vazio" e o nome anterior volta.

## Onda 5.4: Apagar criações e referências
Status: pendente
Objetivo: apagar uma criação (preservando a árvore de versões quando há versões derivadas) e remover referências não usadas.
Depende de: 5.1, 4.2
Ler antes: spec/dados.md ("Exclusão lógica ou física": Criação e Referência); spec/arquitetura.md (tabela "Criações": "Apagar criação"; tabela "Referências": "Apagar referência"); spec/telas.md (regra "Apagar")
Escopo:
  Backend: backend/app/criacoes/, backend/app/referencias/, backend/app/arquivos/
  Frontend: frontend/src/componentes/AbaCriacao.tsx, frontend/src/componentes/PlayerBroll.tsx, frontend/src/componentes/AbaGaleria.tsx
  Dados: Criação (exclusão lógica ou física), Referência (exclusão física com bloqueio), Broll (segue a criação)
  Não tocar: backend/app/sessoes/, backend/app/chat/
Tarefas:
1. `backend/app/criacoes/`: `DELETE /api/sessoes/{id}/criacoes/{cid}`. Regra **Apagar**: com versões filhas, a exclusão é lógica (`apagado`, arquivos dos brolls removidos, registro mantido); sem filhas, é física (criação, vínculos, brolls e arquivos). Se estiver `gerando`, cancela o acompanhamento.
2. Ao apagar brolls, as referências geradas a partir deles continuam válidas (elas têm cópia própria do arquivo, criada na 4.2); só `broll_origem_id` passa a ficar vazio.
3. `backend/app/referencias/`: `DELETE /api/sessoes/{id}/referencias/{rid}`. Se estiver ligada a alguma criação, devolve 409 "Esta referência foi usada em uma criação e não pode ser apagada"; senão, apaga o registro e o arquivo.
4. Frontend: "Apagar" com confirmação no `PlayerBroll.tsx`, no cartão da `AbaCriacao.tsx` e no item da `AbaGaleria.tsx`; um "x" nas referências da sessão; versões `apagado` aparecem no seletor como "v2 (apagada)", sem resultado.
Aceite técnico:
* Apagar a v1 de uma árvore com v2 mantém a v2 funcionando, e o seletor mostra "v1 (apagada)".
* Apagar uma referência usada devolve 409.
Entrega: limpeza completa de itens dentro da sessão.
Teste da pessoa:
1. Apague uma imagem que não tem versões: ela some do painel e da Galeria.
2. Num broll com v1 e v2, apague a v1: a v2 continua, e o seletor mostra "v1 (apagada)".
3. Remova uma referência que nunca foi usada: ela some.
4. Tente remover uma referência que foi usada numa criação: deve aparecer "Esta referência foi usada em uma criação e não pode ser apagada".
