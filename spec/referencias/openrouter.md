# OpenRouter: resumo da API (referência técnica)

Fonte: docs da OpenRouter passadas pelo usuário em 2026-09-24. Índice completo: https://openrouter.ai/docs/llms.txt

Autenticação: header `Authorization: Bearer $OPENROUTER_API_KEY` (chave em `.env`, nunca no código).

## Imagens (síncrono)

- Listar modelos: `GET /api/v1/images/models` → `id`, `architecture.input_modalities`, `supported_parameters` (descritores `enum` / `range` / `boolean`), `supports_streaming`, `endpoints`.
- Capacidades por provedor: `GET /api/v1/images/models/{id}/endpoints` → `supported_parameters` definitivos, `pricing`, `allowed_passthrough_parameters`.
- Gerar: `POST /api/v1/images` com `model`, `prompt` e, opcionalmente, `n` (1-10), `resolution` (512/1K/2K/4K), `aspect_ratio` (1:1, 16:9, 9:16…), `size`, `quality`, `output_format`, `background`, `seed`, `stream`, `input_references` (URL ou data URL base64), `provider`.
- Resposta: `data[].b64_json` + `media_type`, e `usage.cost` em USD.
- Streaming SSE (se `supports_streaming`): eventos `image_generation.partial_image`, `image_generation.completed`, `error`, e depois `[DONE]`. Serve para mostrar progresso.
- Cobrança tudo ou nada: se a geração falhar, a API devolve 502 e nada é cobrado.

## Vídeos (assíncrono)

- Listar modelos: `GET /api/v1/videos/models` → `supported_durations`, `supported_resolutions`, `supported_aspect_ratios`, `supported_sizes`, `pricing_skus`, `allowed_passthrough_parameters`.
- Validar duração, resolução e proporção contra o modelo antes de enviar (senão a API devolve 400).
- Enviar: `POST /api/v1/videos` com `model`, `prompt` e, opcionalmente, `duration`, `resolution`, `aspect_ratio`, `size`, `frame_images` (`first_frame` / `last_frame`, image-to-video), `input_references` (reference-to-video), `generate_audio`, `seed`, `callback_url` (HTTPS), `provider`. Resposta 202 com `id`, `polling_url` e `status`.
- Consultar: `GET /api/v1/videos/{id}` → status `pending` | `in_progress` | `completed` | `failed` (também `cancelled` e `expired` via webhook).
- Baixar: `GET /api/v1/videos/{id}/content?index=0` com o mesmo header de autenticação. Os links não são pré-assinados.
- Webhook opcional: eventos `video.generation.completed|failed|cancelled|expired`, header `X-OpenRouter-Idempotency-Key` e assinatura HMAC em `X-OpenRouter-Signature` (`t=…,v1=…`, calculada sobre `{t},{raw_body}`).
- Vídeo não é elegível a Zero Data Retention.
- Tempo típico de geração: de 30 s a vários minutos. A doc recomenda consultar a cada ~30 s.

## LLM (chat)

- Chat completions padrão da OpenRouter, com tool calling. Modelo principal a definir entre Opus 5.5 (`anthropic/claude-opus-5.5`) e o último modelo da MiniMax.
