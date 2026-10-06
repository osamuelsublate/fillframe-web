# FillFrame

Crie brolls (takes de apps, erros, diagramas e exemplos que parecem reais), na vertical e na horizontal, conversando com uma LLM que prepara as imagens e os vídeos com os modelos da OpenRouter. Você revisa e clica em **Gerar**: nada é gerado sozinho.

Tudo roda no seu computador. Só você acessa: o app não abre pela rede (nem pelo celular no mesmo Wi-Fi).

## O que precisa estar instalado (uma vez só)

- **uv**, que instala e roda o backend: https://docs.astral.sh/uv/getting-started/installation/
- **Node.js 20 ou mais novo**, que roda a tela: https://nodejs.org

## A chave da OpenRouter

A chave fica em `backend/.env`, que nunca vai para o Git. O modelo de como o arquivo deve ser é o `backend/.env.example`:

```
OPENROUTER_API_KEY=sua-chave-aqui
FILLFRAME_LLM_PADRAO=anthropic/claude-opus-5.5
FILLFRAME_LLMS_PERMITIDAS=anthropic/claude-opus-5.5,minimax:ultimo
FILLFRAME_MODELO_TRANSCRICAO=
FILLFRAME_GERACOES_SIMULTANEAS=4
```

- **Trocar a chave:** abra `backend/.env`, troque o valor de `OPENROUTER_API_KEY`, salve e reinicie o backend (`Ctrl+C` no terminal dele e o comando de novo).
- `FILLFRAME_MODELO_TRANSCRICAO`: modelo que transcreve os áudios. Vazio = o app escolhe um (Gemini Flash Lite).
- `FILLFRAME_GERACOES_SIMULTANEAS`: quantas imagens/vídeos podem gerar ao mesmo tempo.

## Como abrir o app

Abra **dois terminais** na pasta do projeto.

**Terminal 1, o motor (backend):**

```bash
cd backend && uv run fillframe
```

**Terminal 2, a tela (frontend):**

```bash
cd frontend && npm install && npm run dev
```

O `npm install` só é necessário na primeira vez. Depois disso, basta `cd frontend && npm run dev`.

Depois, abra **http://127.0.0.1:5173** no navegador.

Para desligar, aperte `Ctrl+C` em cada terminal (espere o terminal do backend voltar antes de ligar de novo: se houver um vídeo sendo enviado, ele termina o envio primeiro).

## Onde ficam os seus dados

Tudo o que você cria fica em **`backend/data/`**:

- `backend/data/fillframe.db`: o banco (sessões, conversas, criações, versões).
- `backend/data/sessoes/`: os arquivos (imagens, vídeos, referências e áudios de cada sessão).

## Backup

Com o app **desligado** (os dois terminais parados), copie a pasta `backend/data/` inteira para outro lugar. Essa cópia é o backup completo. Para voltar um backup, desligue o app e coloque a pasta copiada no lugar de `backend/data/`.

O app não faz backup sozinho e não apaga nada sozinho: vídeos ocupam espaço, então de tempos em tempos apague pelo próprio app as sessões que não usa mais.

## Se algo der errado

- **"O FillFrame não está respondendo"**: o terminal do backend está fechado ou parou. Rode `cd backend && uv run fillframe` de novo.
- **Aviso da chave da OpenRouter**: a chave em `backend/.env` está vazia ou é inválida.
- **"Sua conta da OpenRouter está sem créditos"**: adicione créditos em openrouter.ai.
- Detalhes técnicos de qualquer erro aparecem no terminal do backend.
