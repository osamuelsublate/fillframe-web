# Matriz de cobertura

Conferida em 2026-09-24 contra spec/visao.md, spec/usuarios.md, spec/telas.md, spec/dados.md e spec/arquitetura.md.

## Telas (spec/telas.md)

| Tela / área | Criação | Refinamentos |
|---|---|---|
| Tela única "Sessão" (layout) | 1.1 | 6.1 |
| Área: Histórico de sessões | 1.2 | 5.3 |
| Área: Chat | 2.2 | 3.4, 4.1, 4.3, 5.2 |
| Área: Painel, aba Criação | 2.1 (painel + seletor de modelos) | 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 5.1, 5.4 |
| Área: Painel, aba Galeria | 5.2 (a aba vazia existe desde 2.1) | 5.4 |
| Fluxo de primeiro acesso | 1.1 (aviso de chave), 1.2 (sessão nova) | 2.2 (pergunta inicial) |

## Operações da API (spec/arquitetura.md, seção 6)

| Operação | Onda |
|---|---|
| `GET /api/status` | 1.1 |
| `GET /api/sessoes` | 1.2 |
| `POST /api/sessoes` | 1.2 |
| `GET /api/sessoes/{id}` | 1.2 (ampliada em 2.2, 3.1 e 4.1) |
| `PATCH /api/sessoes/{id}` | 2.2 (usada para renomear na 5.3) |
| `DELETE /api/sessoes/{id}` | 5.3 |
| `POST /api/sessoes/{id}/mensagens` (SSE) | 2.2 (tools na 3.4, anexos na 4.1, áudio na 4.3) |
| `GET /api/modelos/llm` | 2.2 |
| `POST /api/sessoes/{id}/referencias` | 4.1 |
| `GET /api/sessoes/{id}/referencias` | 4.1 |
| `POST /api/sessoes/{id}/referencias/de-broll` | 4.2 |
| `DELETE /api/sessoes/{id}/referencias/{rid}` | 5.4 |
| `POST /api/sessoes/{id}/criacoes` | 3.1 |
| `PATCH /api/sessoes/{id}/criacoes/{cid}` | 3.1 |
| `POST /api/sessoes/{id}/criacoes/{cid}/versoes` | 5.1 |
| `POST /api/sessoes/{id}/criacoes/{cid}/gerar` | 3.2 |
| `GET /api/sessoes/{id}/criacoes` (andamento) | 3.1 (brolls incluídos na 3.2) |
| `GET /api/sessoes/{id}/criacoes/{cid}/versoes` | 5.1 |
| `DELETE /api/sessoes/{id}/criacoes/{cid}` | 5.4 |
| `GET /api/brolls` (galeria) | 5.2 |
| `GET /api/arquivos/brolls/{bid}` | 3.2 |
| `GET /api/arquivos/referencias/{rid}` | 4.1 |
| `GET /api/modelos/imagem` | 2.1 (tempo médio na 3.5) |
| `GET /api/modelos/video` | 2.1 (tempo médio na 3.5) |
| `POST /api/modelos/atualizar` | 2.1 |
| Tool `listar_modelos` | 3.4 |
| Tool `preparar_criacao` | 3.4 (referências na 4.2) |
| Tool `ajustar_criacao` | 3.4 (nova versão na 5.1, referências na 4.2) |
| Tool `ver_criacoes` | 3.4 (versões na 5.1) |

## Entidades (spec/dados.md)

| Entidade | Criada na onda |
|---|---|
| Sessão | 1.2 |
| Catálogo de modelos | 2.1 |
| Mensagem | 2.2 |
| Criação | 3.1 |
| Broll | 3.2 |
| Referência | 4.1 |
| Referência usada na criação | 4.2 |

## Regras de negócio (spec/telas.md)

| Regra | Ondas que a citam |
|---|---|
| Gerar só com ação do usuário | 3.2, 3.4 |
| Validar a configuração contra o modelo | 3.1, 3.3, 4.2 |
| Validar uploads | 4.1, 4.3 |
| Estimar o tempo | 3.5 |
| Contexto da LLM | 2.2, 3.4, 4.1 |
| Apagar | 5.3, 5.4 |
| Isolamento por sessão (spec/dados.md, spec/arquitetura.md) | 3.1, 4.1, 4.2, 6.2 |
| Referência usada não pode ser apagada (spec/dados.md) | 5.4 |
| Exclusão lógica de criação com versões (spec/dados.md) | 5.4 |

## Funções essenciais (spec/visao.md)

| Função | Ondas |
|---|---|
| Chat com LLM forte que aceita áudio, imagens e arquivos de texto | 2.2, 4.1, 4.3 |
| A LLM usa tools para gerar imagens e vídeos e controla as execuções | 3.4 (a geração em si é acionada pelo usuário, conforme spec/telas.md) |
| Seção de modelos de imagem e de vídeo com todos os modelos da OpenRouter | 2.1 |
| Brolls vertical e horizontal | 3.1, 3.3 |
| Imagem gerada como referência para vídeo | 4.2 |
| Timer e barra de progresso | 3.2 (contador), 3.5 (barra com estimativa) |
| Galeria com download | 3.2 e 3.3 (download), 5.2 (galeria) |

## Funções adiadas (não podem estar no plano)

| Função adiada | No plano? |
|---|---|
| Aviso quando a criação termina (som ou notificação) | não |
| Editar o vídeo final | não |
| Postar no Instagram | não |
| Contas para outras pessoas | não |

## Processamento em segundo plano (spec/arquitetura.md, seção 7)

| Item | Onda |
|---|---|
| Executor de geração de imagem | 3.2 |
| Executor de vídeo (envio, consulta a cada 10 s, download) | 3.3 |
| Limite de gerações simultâneas | 3.3 |
| Retomada ao reiniciar (vídeos continuam, imagens viram falhou) | 3.3 |
| Cancelar acompanhamento ao apagar | 5.3 (sessão), 5.4 (criação) |
| Atualização do catálogo ao iniciar (cache > 24 h) | 2.1 |

## Conferência
- Toda tela e área tem uma onda de criação: ok.
- Toda operação da API está em exatamente uma onda (as ampliações posteriores são refinamentos da mesma operação): ok.
- Toda entidade é criada em exatamente uma onda: ok.
- Toda regra de negócio aparece em pelo menos uma tarefa: ok.
- Toda função essencial está coberta: ok.
- Nenhuma função adiada está no plano: ok.
- Todo item de segundo plano tem onda: ok.
