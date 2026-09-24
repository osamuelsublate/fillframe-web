"""Cliente único da OpenRouter. A chave nunca sai daqui: não vai para log nem para resposta."""

import time

import httpx

from app.config import obter_config

URL_BASE = "https://openrouter.ai/api/v1"
CACHE_VERIFICACAO_SEGUNDOS = 60

_cliente: httpx.AsyncClient | None = None
_cache_verificacao: tuple[float, bool] | None = None


def obter_cliente() -> httpx.AsyncClient:
    global _cliente
    if _cliente is None:
        chave = obter_config().openrouter_api_key.strip()
        _cliente = httpx.AsyncClient(
            base_url=URL_BASE,
            headers={
                "Authorization": f"Bearer {chave}",
                "X-Title": "FillFrame",
            },
            timeout=httpx.Timeout(30.0),
        )
    return _cliente


async def fechar_cliente() -> None:
    global _cliente
    if _cliente is not None:
        await _cliente.aclose()
        _cliente = None


async def verificar_chave() -> bool:
    """Confere se a chave é aceita pela OpenRouter. Guarda o resultado por 60 s."""
    global _cache_verificacao
    if not obter_config().chave_configurada:
        return False

    agora = time.monotonic()
    if _cache_verificacao and agora - _cache_verificacao[0] < CACHE_VERIFICACAO_SEGUNDOS:
        return _cache_verificacao[1]

    try:
        resposta = await obter_cliente().get("/key")
        valida = resposta.status_code == 200
    except httpx.HTTPError:
        # Sem internet ou OpenRouter fora do ar: não dá para afirmar que a chave é válida.
        valida = False

    _cache_verificacao = (agora, valida)
    return valida
