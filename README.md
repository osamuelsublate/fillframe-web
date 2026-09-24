# FillFrame

Crie brolls (takes de apps, erros, diagramas e exemplos que parecem reais), na vertical e na horizontal, conversando com uma LLM que usa os modelos de imagem e vídeo da OpenRouter.

Tudo roda no seu computador. Só você acessa.

## O que precisa estar instalado (uma vez só)

- **uv**, que instala e roda o backend: https://docs.astral.sh/uv/getting-started/installation/
- **Node.js 20 ou mais novo**, que roda a tela: https://nodejs.org

## A chave da OpenRouter

A chave fica no arquivo `backend/.env` (use o `backend/.env.example` como modelo). Esse arquivo nunca vai para o Git.

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

Para desligar, aperte `Ctrl+C` em cada terminal.

## Onde ficam os seus dados

Tudo o que você cria fica em `backend/data/`. Para fazer backup, copie essa pasta com o app desligado.
