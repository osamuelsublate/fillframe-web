"""Erros da OpenRouter com mensagens em português para a tela."""

import json


class ErroOpenRouter(Exception):
    """Erro vindo da OpenRouter, com uma mensagem que pode ir para a tela."""


def mensagem_de_erro(corpo: bytes | str, status: int) -> str:
    try:
        dados = json.loads(corpo)
        detalhe = (dados.get("error") or {}).get("message")
    except (ValueError, AttributeError):
        detalhe = None
    if status == 401:
        return "A OpenRouter recusou a chave. Confira a chave em backend/.env."
    if status == 402:
        return "Sem créditos na OpenRouter para essa chamada."
    if status == 429:
        return "A OpenRouter está limitando as chamadas agora. Tente de novo em instantes."
    return f"A OpenRouter devolveu um erro: {detalhe}" if detalhe else f"A OpenRouter devolveu um erro ({status})."
