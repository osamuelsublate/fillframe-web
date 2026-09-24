"""Transcrição de áudio com um modelo da OpenRouter que entende áudio."""

import base64

import httpx

from app.openrouter.cliente import obter_cliente
from app.openrouter.erros import ErroOpenRouter, erro_de_conexao, mensagem_de_erro

TEMPO_LIMITE = httpx.Timeout(connect=15.0, read=180.0, write=120.0, pool=15.0)

INSTRUCAO = (
    "Transcreva fielmente o áudio, no idioma falado (normalmente português do Brasil). "
    "Devolva só o texto transcrito, sem comentários, aspas ou marcações. "
    "O assunto é produção de vídeos sobre programação; termos comuns: broll (B-roll, takes de apoio), "
    "API, REST, CORS, React, FastAPI, Python, JavaScript, frontend, backend, deploy, prompt, vertical, "
    "horizontal. "
    "Se não houver fala, devolva exatamente: (sem fala)"
)


def parte_de_audio(conteudo: bytes, formato: str) -> dict:
    """Parte de conteúdo `input_audio` (o áudio vai em base64; a OpenRouter não aceita link)."""
    return {"type": "input_audio", "input_audio": {"data": base64.b64encode(conteudo).decode(), "format": formato}}


async def transcrever(modelo: str, conteudo: bytes, formato: str) -> str:
    corpo = {
        "model": modelo,
        "messages": [
            {"role": "system", "content": INSTRUCAO},
            {"role": "user", "content": [parte_de_audio(conteudo, formato)]},
        ],
        "temperature": 0,
        "max_tokens": 4000,
    }
    # Às vezes a resposta volta vazia (ex.: filtro do provedor): tenta mais uma vez antes de desistir.
    for _ in range(2):
        try:
            resposta = await obter_cliente().post("/chat/completions", json=corpo, timeout=TEMPO_LIMITE)
        except httpx.HTTPError as erro:
            raise erro_de_conexao(erro, "para transcrever o áudio") from erro
        if resposta.status_code != 200:
            raise ErroOpenRouter(mensagem_de_erro(resposta.content, resposta.status_code))

        escolhas = resposta.json().get("choices") or []
        texto = ((escolhas[0].get("message") or {}).get("content") or "").strip() if escolhas else ""
        if texto:
            return texto
    raise ErroOpenRouter("A transcrição voltou vazia.")
