"""Tools que a LLM pode usar no chat (spec/arquitetura.md, seção 6).

Regra "Gerar só com ação do usuário": não existe tool de gerar. As tools só criam e editam
rascunhos pelo serviço de criações, que nunca muda a situação de uma criação.
Erros de validação voltam para a própria LLM, como resultado da tool, para ela corrigir.
"""

import json

from fastapi import HTTPException
from pydantic import ValidationError

from app.criacoes import repositorio as repositorio_criacoes
from app.criacoes import servico as servico_criacoes
from app.criacoes.esquemas import CriacaoAlterar, CriacaoCriar
from app.criacoes.modelos import Criacao
from app.db import AbrirBanco
from app.erros import ErroDeCampo
from app.modelos import servico as servico_modelos

_CAMPOS_CRIACAO = {
    "tipo": {"type": "string", "enum": ["imagem", "video"]},
    "modelo": {"type": "string", "description": "id exato do modelo, como devolvido por listar_modelos"},
    "prompt": {
        "type": "string",
        "description": "Prompt detalhado, em inglês ou português, descrevendo a cena de forma realista.",
    },
    "orientacao": {"type": "string", "enum": ["vertical", "horizontal"]},
    "proporcao": {
        "type": "string",
        "description": "Opcional. Proporção exata (ex.: 9:16). Se omitida, o app escolhe a do formato.",
    },
    "duracao": {"type": "integer", "description": "Segundos. Obrigatória para vídeo; use um valor aceito pelo modelo."},
    "resolucao": {"type": "string", "description": "Opcional. Uma das resoluções aceitas pelo modelo."},
    "gerar_audio": {"type": "boolean", "description": "Só para vídeo, e só se o modelo gera áudio."},
}

DEFINICOES = [
    {
        "type": "function",
        "function": {
            "name": "listar_modelos",
            "description": (
                "Lista modelos de imagem ou de vídeo da OpenRouter com preço e capacidades "
                "(proporções, resoluções, durações, áudio). Use antes de escolher um modelo."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string", "enum": ["imagem", "video"]},
                    "busca": {"type": "string", "description": "Filtro opcional pelo nome (ex.: veo, seedream)."},
                },
                "required": ["tipo"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "preparar_criacao",
            "description": (
                "Cria um RASCUNHO de imagem ou vídeo no painel do usuário. Não gera nada: "
                "quem gera é o usuário, clicando em Gerar. Chame uma vez para cada broll."
            ),
            "parameters": {
                "type": "object",
                "properties": _CAMPOS_CRIACAO,
                "required": ["tipo", "modelo", "prompt", "orientacao"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ajustar_criacao",
            "description": (
                "Edita um rascunho existente (só funciona em criações com situação 'rascunho'). "
                "Mande apenas os campos que mudam. Não gera nada."
            ),
            "parameters": {
                "type": "object",
                "properties": {"criacao_id": {"type": "string"}, **_CAMPOS_CRIACAO},
                "required": ["criacao_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ver_criacoes",
            "description": "Lista as criações desta sessão com situação (rascunho, gerando, pronto, falhou).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _json(dados) -> str:
    return json.dumps(dados, ensure_ascii=False, default=str)


def resumo_criacao(criacao: Criacao) -> dict:
    return {
        "criacao_id": criacao.id,
        "tipo": criacao.tipo,
        "modelo": criacao.modelo,
        "situacao": criacao.situacao,
        "orientacao": criacao.orientacao,
        "proporcao": criacao.proporcao,
        "duracao": criacao.duracao_segundos,
        "resolucao": criacao.resolucao,
        "versao": criacao.numero_versao,
        "prompt": criacao.prompt if len(criacao.prompt) <= 300 else criacao.prompt[:300] + "…",
    }


def _texto_preco(resumo: dict | None) -> str:
    """Preço por extenso, com a unidade clara (unidades diferentes não se comparam direto)."""
    if not resumo:
        return "preço não informado"
    faixa = (
        f"US$ {resumo['valor_min']:.3f}"
        if resumo["valor_min"] == resumo["valor_max"]
        else f"US$ {resumo['valor_min']:.3f} a {resumo['valor_max']:.3f}"
    )
    unidade = resumo["unidade"]
    if unidade == "1M tokens":
        return f"{faixa} por 1 milhão de tokens de saída (uma imagem costuma usar de 1 mil a 5 mil tokens)"
    return f"{faixa} por {unidade}"


def _listar_modelos(argumentos: dict) -> tuple[str, None]:
    tipo = argumentos.get("tipo")
    if tipo not in ("imagem", "video"):
        return _json({"erro": "tipo precisa ser 'imagem' ou 'video'"}), None
    with AbrirBanco() as banco:
        modelos = servico_modelos.listar(banco, tipo, argumentos.get("busca"))
    lista = []
    for modelo in modelos[:40]:
        capacidades = modelo.capacidades
        item = {
            "id": modelo.id,
            "nome": modelo.nome,
            "preco": _texto_preco(modelo.precos.get("resumo")),
            "proporcoes": capacidades.get("proporcoes"),
            "resolucoes": capacidades.get("resolucoes"),
        }
        if tipo == "video":
            item["duracoes"] = sorted(capacidades.get("duracoes") or [])
            item["gera_audio"] = capacidades.get("gera_audio")
        elif capacidades.get("min_referencias"):
            item["exige_referencia"] = True  # ainda não suportado: não escolha
        lista.append(item)
    return _json({"modelos": lista, "total": len(modelos)}), None


def _campos(argumentos: dict) -> dict:
    campos = {k: argumentos[k] for k in ("tipo", "modelo", "prompt", "orientacao", "proporcao", "duracao", "resolucao") if k in argumentos}
    if "gerar_audio" in argumentos:
        campos["parametros_extras"] = {"generate_audio": bool(argumentos["gerar_audio"])}
    return campos


def _preparar(sessao_id: str, argumentos: dict) -> tuple[str, dict | None]:
    with AbrirBanco() as banco:
        criacao = servico_criacoes.criar(banco, sessao_id, CriacaoCriar(**_campos(argumentos)))
        resumo = resumo_criacao(criacao)
    evento = {"acao": "criacao_preparada", "criacao_id": criacao.id, "prompt": criacao.prompt}
    return _json({"ok": True, "rascunho": resumo, "aviso": "Rascunho criado. Só o usuário pode gerar."}), evento


def _ajustar(sessao_id: str, argumentos: dict) -> tuple[str, dict | None]:
    criacao_id = argumentos.get("criacao_id") or ""
    with AbrirBanco() as banco:
        criacao = servico_criacoes.alterar(banco, sessao_id, criacao_id, CriacaoAlterar(**_campos(argumentos)))
        resumo = resumo_criacao(criacao)
    evento = {"acao": "criacao_ajustada", "criacao_id": criacao.id, "prompt": criacao.prompt}
    return _json({"ok": True, "rascunho": resumo}), evento


def _ver(sessao_id: str) -> tuple[str, None]:
    with AbrirBanco() as banco:
        criacoes = repositorio_criacoes.listar(banco, sessao_id)
        return _json({"criacoes": [resumo_criacao(c) for c in criacoes]}), None


async def executar(sessao_id: str, nome: str, argumentos_json: str) -> tuple[str, dict | None]:
    """Executa a tool pedida pela LLM. Nunca levanta erro: o erro vira resultado, para a LLM corrigir."""
    try:
        argumentos = json.loads(argumentos_json or "{}")
        if not isinstance(argumentos, dict):
            raise ValueError
    except ValueError:
        return _json({"erro": "Os argumentos precisam ser um objeto JSON válido."}), None

    try:
        if nome == "listar_modelos":
            return _listar_modelos(argumentos)
        if nome == "preparar_criacao":
            return _preparar(sessao_id, argumentos)
        if nome == "ajustar_criacao":
            return _ajustar(sessao_id, argumentos)
        if nome == "ver_criacoes":
            return _ver(sessao_id)
        return _json({"erro": f"A ferramenta '{nome}' não existe. Não há ferramenta para gerar: só o usuário gera."}), None
    except ErroDeCampo as erro:
        return _json({"erro": erro.mensagem, "campo": erro.campo}), None
    except HTTPException as erro:
        return _json({"erro": erro.detail}), None
    except ValidationError as erro:
        detalhes = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in erro.errors()]
        return _json({"erro": "Argumentos inválidos", "detalhes": detalhes}), None
