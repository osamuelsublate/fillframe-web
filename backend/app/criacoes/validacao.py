"""Regra "Validar a configuração contra o modelo" (spec/telas.md).

Tudo é checado contra as capacidades do catálogo antes de qualquer chamada à OpenRouter.
As mensagens dizem o que o modelo aceita, para a pessoa (ou a LLM) corrigir.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.erros import ErroDeCampo
from app.modelos import servico as servico_modelos
from app.modelos.modelos import ModeloCatalogo
from app.referencias import repositorio as repositorio_referencias

NOMES_TIPO = {"imagem": "imagem", "video": "vídeo"}
PROPORCAO_PREFERIDA = {"vertical": "9:16", "horizontal": "16:9"}


@dataclass
class Config:
    """Configuração de uma criação. `explicitos` diz quais campos a pessoa mandou nesta chamada."""

    sessao_id: str
    tipo: str
    modelo: str
    prompt: str
    orientacao: str
    proporcao: str | None
    duracao: int | None
    resolucao: str | None
    referencias: list  # [ReferenciaUsada] ou objetos com .id e .papel
    explicitos: set[str]
    extras: dict | None = None


def _nome(modelo: ModeloCatalogo) -> str:
    # "Google: Veo 3.1" → "Veo 3.1"
    return modelo.nome.split(": ", 1)[-1]


def _lista(valores: list) -> str:
    textos = [str(v) for v in valores]
    if len(textos) <= 1:
        return "".join(textos)
    return ", ".join(textos[:-1]) + " e " + textos[-1]


def _razao(proporcao: str) -> float | None:
    try:
        largura, altura = (float(p) for p in proporcao.split(":"))
        return largura / altura
    except (ValueError, ZeroDivisionError):
        return None


def _combina(proporcao: str, orientacao: str) -> bool:
    razao = _razao(proporcao)
    if razao is None:
        return False
    return razao < 1 if orientacao == "vertical" else razao > 1


def _buscar_modelo(banco: Session, tipo: str, modelo_id: str) -> ModeloCatalogo:
    for modelo in servico_modelos.listar(banco, tipo):
        if modelo.id == modelo_id:
            return modelo
    outro_tipo = "video" if tipo == "imagem" else "imagem"
    if any(m.id == modelo_id for m in servico_modelos.listar(banco, outro_tipo)):
        raise ErroDeCampo(f"O modelo {modelo_id} é de {NOMES_TIPO[outro_tipo]}, não de {NOMES_TIPO[tipo]}.", "modelo")
    raise ErroDeCampo(
        f"O modelo {modelo_id} não está na lista de modelos de {NOMES_TIPO[tipo]} da OpenRouter.", "modelo"
    )


def _proporcao(config: Config, modelo: ModeloCatalogo) -> str | None:
    aceitas: list[str] = modelo.capacidades.get("proporcoes") or []
    nome = _nome(modelo)

    if "proporcao" in config.explicitos and config.proporcao:
        if not aceitas:
            raise ErroDeCampo(f"O modelo {nome} não permite escolher a proporção.", "proporcao")
        if config.proporcao not in aceitas:
            raise ErroDeCampo(f"O modelo {nome} aceita apenas {_lista(aceitas)}.", "proporcao")
        if not _combina(config.proporcao, config.orientacao):
            raise ErroDeCampo(f"A proporção {config.proporcao} não é {config.orientacao}.", "proporcao")
        return config.proporcao

    # Mantém a proporção que já estava, se ela ainda serve.
    if config.proporcao and config.proporcao in aceitas and _combina(config.proporcao, config.orientacao):
        return config.proporcao

    if not aceitas:
        return None  # O modelo não recebe proporção (ex.: modelos de edição).

    candidatas = [p for p in aceitas if _combina(p, config.orientacao)]
    if not candidatas:
        raise ErroDeCampo(
            f"O modelo {nome} não faz {config.orientacao}. Proporções aceitas: {_lista(aceitas)}.",
            "orientacao",
        )
    preferida = PROPORCAO_PREFERIDA[config.orientacao]
    if preferida in candidatas:
        return preferida
    alvo = _razao(preferida)
    return min(candidatas, key=lambda p: abs(_razao(p) - alvo))


def _resolucao(config: Config, modelo: ModeloCatalogo) -> str | None:
    if not config.resolucao:
        return None
    aceitas: list[str] = modelo.capacidades.get("resolucoes") or []
    if config.resolucao in aceitas:
        return config.resolucao
    if "resolucao" not in config.explicitos:
        return None  # Trocou de modelo e a resolução antiga não serve: volta ao padrão do modelo.
    nome = _nome(modelo)
    if not aceitas:
        raise ErroDeCampo(f"O modelo {nome} não permite escolher a resolução.", "resolucao")
    raise ErroDeCampo(f"O modelo {nome} aceita apenas as resoluções {_lista(aceitas)}.", "resolucao")


def _duracao(config: Config, modelo: ModeloCatalogo) -> int | None:
    if config.tipo == "imagem":
        if config.duracao is not None and "duracao" in config.explicitos:
            raise ErroDeCampo("Imagem não tem duração.", "duracao")
        return None

    aceitas: list[int] = sorted(modelo.capacidades.get("duracoes") or [])
    if not aceitas:
        return config.duracao
    if len(aceitas) > 4 and aceitas == list(range(aceitas[0], aceitas[-1] + 1)):
        faixa = f"de {aceitas[0]} a {aceitas[-1]} segundos"
    else:
        faixa = (
            f"{', '.join(str(d) for d in aceitas[:-1])} ou {aceitas[-1]} segundos"
            if len(aceitas) > 1
            else f"{aceitas[0]} segundos"
        )
    if config.duracao is None:
        raise ErroDeCampo(f"Escolha a duração do vídeo. O modelo {_nome(modelo)} aceita {faixa}.", "duracao")
    if config.duracao not in aceitas:
        raise ErroDeCampo(f"O modelo {_nome(modelo)} aceita apenas {faixa}.", "duracao")
    return config.duracao


def _extras(config: Config, modelo: ModeloCatalogo) -> None:
    extras = config.extras or {}
    if extras.get("generate_audio") and not modelo.capacidades.get("gera_audio"):
        raise ErroDeCampo(f"O modelo {_nome(modelo)} não gera áudio.", "audio")


NOMES_PAPEL = {"referencia": "referência", "primeiro_quadro": "primeiro quadro", "ultimo_quadro": "último quadro"}


def _referencias(banco: Session, config: Config, modelo: ModeloCatalogo) -> list[tuple[str, str]]:
    """Referências da criação: da mesma sessão, só imagens, e com papéis que o modelo aceita."""
    pares = list(dict.fromkeys((r.id, r.papel) for r in config.referencias))
    nome = _nome(modelo)
    capacidades = modelo.capacidades

    ids = list(dict.fromkeys(i for i, _ in pares))
    encontradas = {r.id: r for r in repositorio_referencias.buscar_varias(banco, config.sessao_id, ids)}
    for referencia_id in ids:
        if referencia_id not in encontradas:
            raise ErroDeCampo("Uma das referências não pertence a esta sessão.", "referencias")
        if encontradas[referencia_id].tipo != "imagem":
            raise ErroDeCampo("Só imagens podem ser usadas como referência numa criação.", "referencias")

    for papel in ("primeiro_quadro", "ultimo_quadro"):
        quantos = sum(1 for _, p in pares if p == papel)
        if quantos and config.tipo != "video":
            raise ErroDeCampo(f"Imagem não tem {NOMES_PAPEL[papel]}: isso só existe em vídeo.", "referencias")
        if quantos and not capacidades.get("aceita_" + papel):
            raise ErroDeCampo(f"O modelo {nome} não aceita {NOMES_PAPEL[papel]}.", "referencias")
        if quantos > 1:
            raise ErroDeCampo(f"Escolha só uma imagem como {NOMES_PAPEL[papel]}.", "referencias")

    estilo = sum(1 for _, p in pares if p == "referencia")
    # Em vídeo, a OpenRouter diz que referências de imagem funcionam em todos os provedores.
    aceita = capacidades.get("aceita_referencia")
    if estilo and aceita is False:
        raise ErroDeCampo(f"O modelo {nome} não aceita imagens de referência.", "referencias")
    maximo = capacidades.get("max_referencias")
    if maximo and estilo > maximo:
        raise ErroDeCampo(f"O modelo {nome} aceita no máximo {maximo} imagens de referência.", "referencias")
    minimo = capacidades.get("min_referencias") or 0
    if estilo < minimo:
        raise ErroDeCampo(
            f"O modelo {nome} precisa de pelo menos {minimo} imagem de referência. "
            "Anexe uma imagem no chat e escolha-a em Referências.",
            "referencias",
        )
    return pares


def validar(banco: Session, config: Config) -> dict:
    """Devolve os campos prontos para salvar (+ "referencias"), ou levanta ErroDeCampo."""
    prompt = (config.prompt or "").strip()
    if not prompt:
        raise ErroDeCampo("O prompt é obrigatório.", "prompt")

    modelo = _buscar_modelo(banco, config.tipo, config.modelo)
    _extras(config, modelo)

    return {
        "tipo": config.tipo,
        "modelo": modelo.id,
        "prompt": prompt,
        "orientacao": config.orientacao,
        "proporcao": _proporcao(config, modelo),
        "duracao_segundos": _duracao(config, modelo),
        "resolucao": _resolucao(config, modelo),
        # Não é coluna da criação: o serviço grava à parte, como [(referencia_id, papel)].
        "referencias": _referencias(banco, config, modelo),
    }
