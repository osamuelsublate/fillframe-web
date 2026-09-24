# Fase 6: Fechamento

Objetivo: usar o FillFrame no dia a dia com mensagens de erro claras em qualquer falha, tela revisada e a segurança conferida.
Depende de: Fase 5

## Onda 6.1: Mensagens de erro e revisão das telas
Status: pendente
Objetivo: toda ação que pode falhar mostra uma mensagem clara em português, e a tela única fica revisada no computador em tamanhos diferentes de janela.
Depende de: 5.2, 5.3, 5.4, 4.3, 3.5
Ler antes: spec/telas.md (tela única inteira, "Fluxo de primeiro acesso", "Fluxo de uso diário"); spec/usuarios.md ("Escala e dispositivo principal")
Escopo:
  Backend: backend/app/main.py (tratador global de erros), backend/app/openrouter/ (tradução de erros da OpenRouter)
  Frontend: frontend/src/componentes/ (todos, só ajustes), frontend/src/utils/erros.ts, frontend/src/telas/Sessao.tsx
  Dados: nenhuma
  Não tocar: estrutura do banco, regras de negócio já aprovadas
Tarefas:
1. `backend/app/openrouter/erros.py`: traduzir as respostas da OpenRouter para mensagens em português: 401 (chave inválida), 402 (sem créditos: "Sua conta da OpenRouter está sem créditos"), 429 (limite: "Muitas chamadas. Tente de novo em instantes"), 400 de parâmetros, 502 e timeout, e política de conteúdo.
2. `backend/app/main.py`: tratador global. Qualquer exceção inesperada vira `{erro: "Algo deu errado no FillFrame. Detalhes no terminal do backend."}`, com o log completo só no terminal.
3. `frontend/src/utils/erros.ts` + um aviso (toast) único: toda chamada da pasta `api/` mostra o `erro` do backend; backend desligado → "O FillFrame não está respondendo. Confira se o terminal do backend está aberto."
4. Revisar cada área no computador (1280 px, 1920 px e janela estreita de ~900 px, com o painel aberto e fechado): nada cortado, sem rolagem horizontal, chat e painel com rolagem própria. Estados vazios com texto (sessão sem mensagens, painel sem criações, galeria vazia). Estados de carregamento visíveis.
5. Percorrer o fluxo diário completo de spec/telas.md e anotar e corrigir os problemas de uso encontrados, sem mudar regra aprovada.
Aceite técnico:
* Simular 401, 402 e 429 (resposta falsa em teste) mostra as mensagens certas na tela.
* Nenhuma ação deixa a tela travada ou sem retorno.
* Sem erros no console no fluxo completo.
Entrega: app redondo para o uso diário.
Teste da pessoa:
1. Faça o fluxo completo: nova sessão → peça brolls por áudio → ajuste um rascunho → gere uma imagem → transforme em vídeo → crie uma v2 → baixe pela Galeria.
2. Diminua a janela do navegador para a metade da tela: tudo continua usável.
3. Pare o backend e tente mandar uma mensagem: deve aparecer "O FillFrame não está respondendo…".
4. Coloque uma chave inválida em `backend/.env`, reinicie e tente gerar: deve aparecer a mensagem de chave inválida (e o aviso de primeiro acesso).

## Onda 6.2: Conferência de segurança e limpeza
Status: pendente
Objetivo: conferir que o app só é acessível pelo seu computador, que a chave nunca vaza e que as entradas são validadas, remover código morto e deixar o README final.
Depende de: 6.1
Ler antes: spec/arquitetura.md (seções 3, 4 e 8); spec/dados.md ("Dados sensíveis", "Implicações técnicas"); spec/usuarios.md ("Implicações técnicas")
Escopo:
  Backend: backend/app/ (qualquer pasta, só correções de segurança e remoção de código morto)
  Frontend: frontend/src/ (só remoção de código morto)
  Dados: nenhuma
  Não tocar: comportamento aprovado das telas
Tarefas:
1. Acesso: confirmar que backend e frontend escutam só em 127.0.0.1 e que o CORS aceita só a origem local; tentar acessar pelo IP da máquina e confirmar que é recusado.
2. Segredos: procurar a chave no código, nos logs, nas respostas da API e no bundle do frontend (`npm run build` + busca por `sk-or-`); confirmar `.env` no `.gitignore` e o `backend/.env.example` completo.
3. Isolamento por sessão: revisar os repositórios para que toda consulta de mensagem, referência, criação e broll filtre por `sessao_id`; tentar ids cruzados entre sessões em cada rota (esperado 404 ou 400).
4. Validação de entrada: revisar os limites de tamanho e tipo de upload, os limites de texto (nome, prompt, mensagem) e os caminhos de arquivo (tentativa de `../` no banco não sai de `backend/data/`).
5. Limpeza: remover código, componentes, dependências e rotas sem uso; rodar lint e formatação (ruff no backend, eslint no frontend).
6. Atualizar o `README.md`: como iniciar, onde ficam os dados (`backend/data/`), como fazer backup (copiar a pasta com o app parado) e como trocar a chave.
Aceite técnico:
* Nenhuma ocorrência da chave fora de `backend/.env`.
* Todas as tentativas cruzadas entre sessões são recusadas.
* Lint sem erros; backend e frontend sobem limpos.
Entrega: primeira versão do FillFrame concluída.
Teste da pessoa:
1. Siga o README do zero (terminais fechados): o app sobe com os dois comandos.
2. Pelo celular, na mesma rede Wi-Fi, tente abrir o endereço do computador (ex.: http://192.168.x.x:5173). Não deve abrir.
3. Com o app parado, copie a pasta `backend/data/` para outro lugar: esse é o seu backup.
4. Tente anexar no chat um arquivo `.zip` renomeado para `.png`: deve aparecer "Tipo de arquivo não aceito".
