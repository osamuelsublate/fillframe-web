"""Geração de imagens na OpenRouter (POST /images, sem streaming)."""

import base64
from dataclasses import dataclass

import httpx

from app.openrouter.cliente import obter_cliente
from app.openrouter.erros import ErroOpenRouter, mensagem_de_erro

# Algumas imagens demoram bastante (modelos grandes, 4K).
TEMPO_LIMITE = httpx.Timeout(connect=15.0, read=600.0, write=60.0, pool=15.0)


@dataclass
class ImagemGerada:
    conteudo: bytes
    formato: str  # ex.: image/png


@dataclass
class ResultadoImagens:
    imagens: list[ImagemGerada]
    custo_usd: float | None


async def gerar_imagens(
    modelo: str,
    prompt: str,
    proporcao: str | None = None,
    resolucao: str | None = None,
    extras: dict | None = None,
    referencias: list[str] | None = None,
) -> ResultadoImagens:
    """`referencias`: imagens de referência como data URL (base64)."""
    corpo: dict = {"model": modelo, "prompt": prompt, "n": 1}
    if proporcao:
        corpo["aspect_ratio"] = proporcao
    if resolucao:
        corpo["resolution"] = resolucao
    if referencias:
        corpo["input_references"] = [{"type": "image_url", "image_url": {"url": url}} for url in referencias]
    for chave, valor in (extras or {}).items():
        corpo.setdefault(chave, valor)

    try:
        resposta = await obter_cliente().post("/images", json=corpo, timeout=TEMPO_LIMITE)
    except httpx.HTTPError as erro:
        raise ErroOpenRouter("Não foi possível falar com a OpenRouter. Confira a internet.") from erro

    if resposta.status_code != 200:
        raise ErroOpenRouter(mensagem_de_erro(resposta.content, resposta.status_code))

    dados = resposta.json()
    imagens = []
    for item in dados.get("data") or []:
        if item.get("b64_json"):
            imagens.append(
                ImagemGerada(base64.b64decode(item["b64_json"]), item.get("media_type") or "image/png")
            )
        elif item.get("url"):
            baixada = await obter_cliente().get(item["url"], timeout=TEMPO_LIMITE)
            baixada.raise_for_status()
            imagens.append(ImagemGerada(baixada.content, baixada.headers.get("content-type", "image/png")))

    if not imagens:
        raise ErroOpenRouter("A OpenRouter respondeu, mas não mandou nenhuma imagem.")

    custo = (dados.get("usage") or {}).get("cost")
    return ResultadoImagens(imagens=imagens, custo_usd=float(custo) if custo is not None else None)
