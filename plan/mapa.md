# Mapa do produto

Usuário único: o **dono**. As atividades seguem a ordem do uso real (spec/telas.md, "Fluxo de uso diário"). Sob cada atividade estão as funcionalidades, da mais essencial para o refinamento, com a onda em que entram.

## Espinha dorsal

Abrir e escolher a sessão → Conversar com a LLM → Anexar referências → Escolher modelos → Preparar a criação → Gerar e acompanhar → Ver, baixar e reaproveitar → Organizar sessões e galeria

### 1. Abrir e escolher a sessão
- App sobe com um comando por parte e mostra a tela única, com aviso de chave (1.1)
- Banco criado na primeira execução; abrir na última sessão usada ou numa nova (1.2)
- Histórico na lateral, ordenado pelo último uso; nova sessão; abrir sessão (1.2)
- *Refinamento:* renomear sessão (5.3)
- *Refinamento:* apagar sessão com confirmação (5.3)

### 2. Conversar com a LLM
- Chat de texto com resposta aparecendo aos poucos e conversa guardada (2.2)
- Escolher a LLM da sessão: Opus 5.5 ou MiniMax (2.2)
- *Refinamento:* gravar e enviar áudio, com transcrição quando a LLM não aceita áudio (4.3)

### 3. Anexar referências
- Anexar imagens e arquivos de texto no chat; a LLM enxerga (4.1)
- Referências da sessão visíveis no painel (4.1)
- *Refinamento:* remover referência não usada (5.4)

### 4. Escolher modelos
- Catálogo de modelos de imagem e vídeo com preço e capacidades, busca e cache (2.1)
- *Refinamento:* tempo médio de cada modelo (3.5)

### 5. Preparar a criação
- Configurar e salvar rascunho de imagem manualmente, com validação contra o modelo (3.1)
- Configuração de vídeo (duração, áudio) (3.3)
- A LLM prepara e ajusta rascunhos via tools, sem nunca gerar (3.4)
- *Variação:* referências na criação, com papel (estilo, primeiro quadro, último quadro) (4.2)
- *Refinamento:* nova versão a partir de qualquer versão (5.1)

### 6. Gerar e acompanhar
- Gerar imagem com o botão, contador de tempo e resultado (3.2)
- Gerar vídeo, com acompanhamento em segundo plano, retomada ao reiniciar e várias ao mesmo tempo (3.3)
- *Refinamento:* barra de progresso com estimativa pelo tempo médio (3.5)
- *Refinamento:* mensagens de erro claras da OpenRouter (6.1)

### 7. Ver, baixar e reaproveitar
- Ver a imagem e baixar (3.2)
- Player de vídeo e baixar (3.3)
- Usar imagem gerada como referência para vídeo (4.2)
- *Refinamento:* navegar entre versões (5.1)
- *Refinamento:* apagar criação, lógica ou física (5.4)

### 8. Organizar sessões e galeria
- Galeria da sessão e de todas as sessões, com filtros, baixar e mandar para o chat (5.2)
- *Fechamento:* revisão das telas (6.1), conferência de segurança e limpeza (6.2)

## Fora do mapa (adiado, conforme spec/telas.md)
- Aviso quando a criação termina (som ou notificação do navegador)
- Editar o vídeo final (cortes, legendas, trilha)
- Postar direto no Instagram
- Contas e acesso para outras pessoas
