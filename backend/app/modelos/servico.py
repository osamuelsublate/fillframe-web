"""Catálogo de modelos: normaliza o que vem da OpenRouter e guarda em cache no banco."""

import asyncio
import contextlib
import logging
from datetime import timedelta

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db import AbrirBanco, agora
from app.modelos import repositorio
from app.modelos.modelos import ModeloCatalogo
from app.openrouter import catalogo

log = logging.getLogger("fillframe")

VALIDADE_CACHE = timedelta(hours=24)
ERRO_OPENROUTER = "Não foi possível falar com a OpenRouter. A lista mostrada é a última salva."
LLM_MINIMAX_ULTIMO = "minimax:ultimo"

_trava_atualizacao = asyncio.Lock()


# ---------- Normalização ----------


def _valores(parametro: dict | None) -> list:
    if parametro and parametro.get("type") == "enum":
        return list(parametro.get("values") or [])
    return []


def _maximo(parametro: dict | None) -> int | None:
    if parametro and parametro.get("type") == "range":
        return parametro.get("max")
    return None


def _minimo(parametro: dict | None) -> int | None:
    if parametro and parametro.get("type") == "range":
        return parametro.get("min")
    return None


def _resumo_preco(itens: list[tuple[float, str]]) -> dict | None:
    """Resume vários preços da mesma unidade em {valor_min, valor_max, unidade} (em US$)."""
    if not itens:
        return None
    unidade = itens[0][1]
    valores = [v for v, u in itens if u == unidade]
    return {"valor_min": min(valores), "valor_max": max(valores), "unidade": unidade}


def normalizar_imagem(cru: dict) -> ModeloCatalogo:
    endpoints = cru.get("endpoints") or []
    parametros = (
        (endpoints[0].get("supported_parameters") if endpoints else None) or cru.get("supported_parameters") or {}
    )

    referencias = parametros.get("input_references")
    max_referencias = _maximo(referencias) or 0

    capacidades = {
        "proporcoes": [p for p in _valores(parametros.get("aspect_ratio")) if p != "auto"],
        "resolucoes": _valores(parametros.get("resolution")),
        "duracoes": [],
        "tamanhos": [],
        "aceita_referencia": max_referencias > 0,
        "min_referencias": _minimo(referencias) or 0,
        "max_referencias": max_referencias,
        "aceita_primeiro_quadro": False,
        "aceita_ultimo_quadro": False,
        "gera_audio": False,
        "max_imagens": _maximo(parametros.get("n")) or 1,
        "entradas": (cru.get("architecture") or {}).get("input_modalities") or [],
        "parametros": parametros,
        "criado": cru.get("created") or 0,
    }

    unidades = {"image": ("imagem", 1), "megapixel": ("megapixel", 1), "token": ("1M tokens", 1_000_000)}
    itens: list[tuple[float, str]] = []
    precos_crus = []
    for endpoint in endpoints:
        for preco in endpoint.get("pricing") or []:
            precos_crus.append({"provedor": endpoint.get("provider_slug"), **preco})
            if preco.get("billable") == "output_image" and preco.get("unit") in unidades:
                nome, fator = unidades[preco["unit"]]
                itens.append((float(preco["cost_usd"]) * fator, nome))

    return ModeloCatalogo(
        categoria="imagem",
        id=cru["id"],
        nome=cru.get("name") or cru["id"],
        descricao=cru.get("description") or "",
        capacidades=capacidades,
        precos={"resumo": _resumo_preco(itens), "itens": precos_crus},
    )


def _preco_video(skus: dict) -> dict | None:
    por_unidade: dict[str, list[tuple[float, str]]] = {}
    for chave, valor in (skus or {}).items():
        if "continuation" in chave or "video_input" in chave or "minimum" in chave:
            continue
        try:
            numero = float(valor)
        except (TypeError, ValueError):
            continue
        if chave.startswith("cents_per_megapixel_second"):
            item = (numero / 100, "megapixel·segundo")
        elif chave.startswith(("cents_per_second", "cents_per_video_output_second")):
            item = (numero / 100, "segundo")
        elif "duration_seconds" in chave:
            item = (numero, "segundo")
        elif chave.startswith("video_tokens"):
            item = (numero * 1_000_000, "1M tokens")
        else:
            continue
        por_unidade.setdefault(item[1], []).append(item)

    for unidade in ("segundo", "1M tokens", "megapixel·segundo"):
        if unidade in por_unidade:
            return _resumo_preco(por_unidade[unidade])
    return None


def normalizar_video(cru: dict) -> ModeloCatalogo:
    quadros = cru.get("supported_frame_images") or []
    capacidades = {
        "proporcoes": cru.get("supported_aspect_ratios") or [],
        "resolucoes": cru.get("supported_resolutions") or [],
        "duracoes": cru.get("supported_durations") or [],
        "tamanhos": cru.get("supported_sizes") or [],
        # A OpenRouter não informa, na listagem de vídeo, se o modelo aceita imagens de referência.
        "aceita_referencia": None,
        "min_referencias": 0,
        "max_referencias": None,
        "aceita_primeiro_quadro": "first_frame" in quadros,
        "aceita_ultimo_quadro": "last_frame" in quadros,
        "gera_audio": bool(cru.get("generate_audio")),
        "max_imagens": None,
        "entradas": ["text", "image"] if quadros else ["text"],
        "parametros": {
            "seed": bool(cru.get("seed")),
            "passthrough": cru.get("allowed_passthrough_parameters") or [],
        },
        "criado": cru.get("created") or 0,
    }
    skus = cru.get("pricing_skus") or {}
    return ModeloCatalogo(
        categoria="video",
        id=cru["id"],
        nome=cru.get("name") or cru["id"],
        descricao=cru.get("description") or "",
        capacidades=capacidades,
        precos={"resumo": _preco_video(skus), "itens": skus},
    )


def normalizar_llm(cru: dict) -> ModeloCatalogo | None:
    """Só entram LLMs que respondem texto e aceitam tools (o chat depende delas)."""
    arquitetura = cru.get("architecture") or {}
    if "text" not in (arquitetura.get("output_modalities") or []):
        return None
    if "tools" not in (cru.get("supported_parameters") or []):
        return None
    entradas = arquitetura.get("input_modalities") or []
    return ModeloCatalogo(
        categoria="llm",
        id=cru["id"],
        nome=cru.get("name") or cru["id"],
        descricao=cru.get("description") or "",
        capacidades={
            "entradas": entradas,
            "aceita_audio": "audio" in entradas,
            "aceita_imagem": "image" in entradas,
            "contexto": cru.get("context_length"),
            "criado": cru.get("created") or 0,
        },
        precos={"itens": cru.get("pricing") or {}},
    )


# ---------- Atualização do cache ----------


async def atualizar_catalogo() -> None:
    """Busca tudo na OpenRouter e troca o cache. Se algo falhar, o cache antigo fica como está."""
    async with _trava_atualizacao:
        try:
            imagens, videos, llms = await asyncio.gather(
                catalogo.buscar_modelos_imagem(),
                catalogo.buscar_modelos_video(),
                catalogo.buscar_llms(),
            )
        except (httpx.HTTPError, KeyError, ValueError) as erro:
            log.warning("Falha ao atualizar o catálogo da OpenRouter: %s", type(erro).__name__)
            raise HTTPException(status_code=502, detail=ERRO_OPENROUTER) from erro

        momento = agora()
        modelos = [normalizar_imagem(m) for m in imagens] + [normalizar_video(m) for m in videos]
        modelos += [m for m in (normalizar_llm(c) for c in llms) if m is not None]
        for modelo in modelos:
            modelo.atualizado_em = momento

        with AbrirBanco() as banco:
            repositorio.substituir_tudo(banco, modelos)
        log.info("Catálogo atualizado: %d modelos", len(modelos))


def catalogo_vencido() -> bool:
    with AbrirBanco() as banco:
        ultima = repositorio.ultima_atualizacao(banco)
    return ultima is None or agora() - ultima > VALIDADE_CACHE


async def atualizar_se_vencido() -> None:
    """Chamado ao iniciar o backend, em segundo plano (não trava a subida)."""
    if not catalogo_vencido():
        return
    # Sem internet: segue com o cache que houver.
    with contextlib.suppress(HTTPException):
        await atualizar_catalogo()


# ---------- Consultas ----------


def listar(banco: Session, categoria: str, busca: str | None = None) -> list[ModeloCatalogo]:
    modelos = repositorio.listar(banco, categoria)
    if busca and busca.strip():
        termo = busca.strip().lower()
        modelos = [m for m in modelos if termo in m.id.lower() or termo in m.nome.lower()]
    # Mais novos primeiro, como a própria OpenRouter mostra.
    return sorted(modelos, key=lambda m: m.capacidades.get("criado", 0), reverse=True)


def ultima_atualizacao(banco: Session):
    return repositorio.ultima_atualizacao(banco)


def resolver_llm(banco: Session, llm: str) -> str | None:
    """Troca "minimax:ultimo" pelo id real: a LLM mais nova da MiniMax com suporte a tools."""
    if llm != LLM_MINIMAX_ULTIMO:
        return llm
    minimax = [m for m in repositorio.listar(banco, "llm") if m.id.startswith("minimax/")]
    if not minimax:
        return None
    return max(minimax, key=lambda m: m.capacidades.get("criado", 0)).id
