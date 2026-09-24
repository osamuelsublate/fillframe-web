"""Busca o catálogo cru da OpenRouter: modelos de imagem, de vídeo e LLMs."""

import asyncio

from app.openrouter.cliente import obter_cliente

CHAMADAS_SIMULTANEAS = 8


async def _get(caminho: str) -> dict:
    resposta = await obter_cliente().get(caminho)
    resposta.raise_for_status()
    return resposta.json()


async def buscar_modelos_imagem() -> list[dict]:
    """Lista de modelos de imagem, cada um com `endpoints` (capacidades e preço por provedor)."""
    modelos = (await _get("/images/models"))["data"]
    limite = asyncio.Semaphore(CHAMADAS_SIMULTANEAS)

    async def com_endpoints(modelo: dict) -> dict:
        async with limite:
            try:
                dados = await _get(f"/images/models/{modelo['id']}/endpoints")
                return {**modelo, "endpoints": dados.get("endpoints") or []}
            except Exception:
                # Sem os detalhes do provedor, ficam as capacidades gerais do modelo.
                return {**modelo, "endpoints": []}

    return await asyncio.gather(*(com_endpoints(m) for m in modelos))


async def buscar_modelos_video() -> list[dict]:
    return (await _get("/videos/models"))["data"]


async def buscar_llms() -> list[dict]:
    return (await _get("/models"))["data"]
