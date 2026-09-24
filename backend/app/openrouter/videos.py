"""Vídeos na OpenRouter: enviar o pedido, consultar o andamento e baixar o resultado."""

from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.openrouter.cliente import URL_BASE, obter_cliente
from app.openrouter.erros import ErroOpenRouter, erro_de_conexao, mensagem_de_erro

TEMPO_LIMITE = httpx.Timeout(connect=15.0, read=120.0, write=60.0, pool=15.0)
TEMPO_LIMITE_DOWNLOAD = httpx.Timeout(connect=15.0, read=300.0, write=60.0, pool=15.0)
HOST_OPENROUTER = urlparse(URL_BASE).hostname
SITUACOES_FINAIS_COM_ERRO = {"failed", "cancelled", "expired"}


@dataclass
class AndamentoVideo:
    situacao: str  # pending / in_progress / completed / failed / cancelled / expired
    urls: list[str]
    erro: str | None
    custo_usd: float | None


async def enviar_video(
    modelo: str,
    prompt: str,
    duracao: int | None,
    resolucao: str | None,
    proporcao: str | None,
    extras: dict | None = None,
    quadros: dict[str, str] | None = None,
    referencias: list[str] | None = None,
) -> str:
    """Envia o pedido e devolve o id do job na OpenRouter.

    `quadros`: {"first_frame" | "last_frame": data URL}; `referencias`: imagens de referência (data URL).
    """
    corpo: dict = {"model": modelo, "prompt": prompt}
    if quadros:
        corpo["frame_images"] = [
            {"type": "image_url", "image_url": {"url": url}, "frame_type": tipo} for tipo, url in quadros.items()
        ]
    if referencias:
        corpo["input_references"] = [{"type": "image_url", "image_url": {"url": url}} for url in referencias]
    if duracao:
        corpo["duration"] = duracao
    if resolucao:
        corpo["resolution"] = resolucao
    if proporcao:
        corpo["aspect_ratio"] = proporcao
    for chave, valor in (extras or {}).items():
        corpo.setdefault(chave, valor)

    try:
        resposta = await obter_cliente().post("/videos", json=corpo, timeout=TEMPO_LIMITE)
    except httpx.HTTPError as erro:
        raise erro_de_conexao(erro) from erro
    if resposta.status_code not in (200, 202):
        raise ErroOpenRouter(mensagem_de_erro(resposta.content, resposta.status_code))

    job = resposta.json().get("id")
    if not job:
        raise ErroOpenRouter("A OpenRouter aceitou o pedido, mas não devolveu o id do vídeo.")
    return job


async def consultar_video(job: str) -> AndamentoVideo:
    """Levanta httpx.HTTPError em falha de rede (quem chama tenta de novo depois)."""
    resposta = await obter_cliente().get(f"/videos/{job}", timeout=TEMPO_LIMITE)
    if resposta.status_code == 404:
        return AndamentoVideo("expired", [], "A OpenRouter não encontrou mais este vídeo.", None)
    if resposta.status_code != 200:
        raise ErroOpenRouter(mensagem_de_erro(resposta.content, resposta.status_code))

    dados = resposta.json()
    erro = dados.get("error")
    if isinstance(erro, dict):
        erro = erro.get("message")
    custo = (dados.get("usage") or {}).get("cost")
    return AndamentoVideo(
        situacao=dados.get("status") or "pending",
        urls=list(dados.get("unsigned_urls") or []),
        erro=str(erro) if erro else None,
        custo_usd=float(custo) if custo is not None else None,
    )


async def baixar_video(job: str, indice: int, url: str | None) -> tuple[bytes, str]:
    """Baixa o vídeo pronto. A chave só vai para a própria OpenRouter, nunca para outro endereço."""
    if not url or urlparse(url).hostname != HOST_OPENROUTER:
        url = f"/videos/{job}/content?index={indice}"
    try:
        resposta = await obter_cliente().get(url, timeout=TEMPO_LIMITE_DOWNLOAD, follow_redirects=False)
        if resposta.is_redirect:
            # Redireciona para um armazenamento externo: segue sem a chave.
            async with httpx.AsyncClient(timeout=TEMPO_LIMITE_DOWNLOAD) as externo:
                resposta = await externo.get(resposta.headers["location"])
    except httpx.HTTPError as erro:
        raise ErroOpenRouter("O vídeo ficou pronto, mas não deu para baixar. Confira a internet.") from erro
    if resposta.status_code != 200:
        raise ErroOpenRouter(mensagem_de_erro(resposta.content, resposta.status_code))
    formato = resposta.headers.get("content-type", "video/mp4").split(";")[0].strip()
    return resposta.content, formato
