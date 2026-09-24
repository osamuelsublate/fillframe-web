"""Erros da OpenRouter traduzidos para mensagens em português, prontas para a tela."""

import json

import httpx

# Palavras que indicam que o pedido foi barrado por política de conteúdo do modelo.
SINAIS_DE_POLITICA = ("moderation", "content policy", "content_policy", "safety", "flagged", "violat", "prohibited")


class ErroOpenRouter(Exception):
    """Erro vindo da OpenRouter, com uma mensagem que pode ir para a tela."""


def _detalhe(corpo: bytes | str) -> str | None:
    try:
        dados = json.loads(corpo)
    except (ValueError, TypeError):
        return None
    erro = dados.get("error") if isinstance(dados, dict) else None
    if isinstance(erro, dict):
        detalhe = erro.get("message")
        # Alguns provedores mandam o motivo real em metadata.raw.
        bruto = (erro.get("metadata") or {}).get("raw")
        if bruto and isinstance(bruto, str) and len(bruto) < 400 and (not detalhe or detalhe == "Provider returned error"):
            detalhe = bruto
        return detalhe
    return erro if isinstance(erro, str) else None


def traduzir(status: int, detalhe: str | None) -> str:
    """Mensagem para a tela a partir do código HTTP e do texto de erro da OpenRouter."""
    texto = (detalhe or "").lower()
    if status == 401:
        return "A chave da OpenRouter é inválida. Confira a chave em backend/.env e reinicie o backend."
    if status == 402:
        return "Sua conta da OpenRouter está sem créditos. Adicione créditos em openrouter.ai e tente de novo."
    if status == 429:
        return "Muitas chamadas. Tente de novo em instantes."
    if status == 403 or any(sinal in texto for sinal in SINAIS_DE_POLITICA):
        return (
            "O pedido foi barrado pela política de conteúdo do modelo. Mude o prompt (ou a referência) "
            "e tente de novo."
        )
    if status == 408:
        return "A OpenRouter demorou demais para responder. Tente de novo."
    if status in (400, 422):
        return f"A OpenRouter recusou os parâmetros: {detalhe}" if detalhe else "A OpenRouter recusou os parâmetros."
    if status == 404:
        return f"A OpenRouter não encontrou isso: {detalhe}" if detalhe else "A OpenRouter não encontrou o que foi pedido."
    if status in (500, 502, 503, 504):
        base = "O provedor do modelo falhou agora. Tente de novo em instantes ou escolha outro modelo."
        return f"{base} ({detalhe})" if detalhe and detalhe != "Provider returned error" else base
    return f"A OpenRouter devolveu um erro: {detalhe}" if detalhe else f"A OpenRouter devolveu um erro ({status})."


def mensagem_de_erro(corpo: bytes | str, status: int) -> str:
    return traduzir(status, _detalhe(corpo))


def erro_no_meio(erro: dict) -> str:
    """Erro que chega dentro do streaming (a resposta já tinha começado)."""
    codigo = erro.get("code")
    return traduzir(codigo if isinstance(codigo, int) else 500, erro.get("message"))


def erro_de_conexao(erro: httpx.HTTPError, acao: str = "") -> ErroOpenRouter:
    """Falha de rede ou tempo esgotado ao falar com a OpenRouter."""
    sufixo = f" {acao}" if acao else ""
    if isinstance(erro, httpx.TimeoutException):
        return ErroOpenRouter(f"A OpenRouter demorou demais para responder{sufixo}. Tente de novo.")
    return ErroOpenRouter(f"Não foi possível falar com a OpenRouter{sufixo}. Confira a internet.")
