"""Regras de negócio das criações."""

from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.arquivos.armazenamento import apagar_arquivos
from app.criacoes import estimativa, repositorio, validacao
from app.criacoes.esquemas import CriacaoAlterar, CriacaoCriar
from app.criacoes.modelos import SITUACOES, Criacao, CriacaoReferencia
from app.db import agora
from app.geracao import executor
from app.sessoes import repositorio as repositorio_sessoes


def _sessao(banco: Session, sessao_id: str):
    sessao = repositorio_sessoes.buscar(banco, sessao_id)
    if sessao is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return sessao


def _criacao(banco: Session, sessao_id: str, criacao_id: str) -> Criacao:
    _sessao(banco, sessao_id)
    criacao = repositorio.buscar(banco, sessao_id, criacao_id)
    if criacao is None:
        raise HTTPException(status_code=404, detail="Criação não encontrada")
    return criacao


def _ligar_referencias(criacao: Criacao, pares: list[tuple[str, str]]) -> None:
    """Deixa as ligações iguais a `pares`, mantendo as que já existem (evita apagar e recriar a mesma)."""
    novos = set(pares)
    criacao.referencias = [r for r in criacao.referencias if (r.referencia_id, r.papel) in novos]
    existentes = {(r.referencia_id, r.papel) for r in criacao.referencias}
    for referencia_id, papel in pares:
        if (referencia_id, papel) not in existentes:
            criacao.referencias.append(CriacaoReferencia(referencia_id=referencia_id, papel=papel))


def listar(banco: Session, sessao_id: str, situacao: str | None = None) -> list[Criacao]:
    _sessao(banco, sessao_id)
    situacoes = [s.strip() for s in (situacao or "").split(",") if s.strip()]
    invalidas = [s for s in situacoes if s not in SITUACOES]
    if invalidas:
        raise HTTPException(status_code=400, detail=f"Situação desconhecida: {', '.join(invalidas)}")
    return repositorio.listar(banco, sessao_id, situacoes or None)


def criar(banco: Session, sessao_id: str, dados: CriacaoCriar) -> Criacao:
    sessao = _sessao(banco, sessao_id)
    campos = validacao.validar(
        banco,
        validacao.Config(
            sessao_id=sessao_id,
            tipo=dados.tipo,
            modelo=dados.modelo,
            prompt=dados.prompt,
            orientacao=dados.orientacao,
            proporcao=dados.proporcao,
            duracao=dados.duracao,
            resolucao=dados.resolucao,
            referencias=dados.referencias,
            explicitos=dados.model_fields_set,
            extras=dados.parametros_extras,
        ),
    )
    pares = campos.pop("referencias")
    novo_id = uuid4().hex
    criacao = Criacao(
        id=novo_id,
        sessao_id=sessao_id,
        raiz_id=novo_id,
        numero_versao=1,
        situacao="rascunho",
        parametros_extras=dados.parametros_extras,
        criada_em=agora(),
        **campos,
    )
    _ligar_referencias(criacao, pares)
    sessao.ultimo_uso_em = criacao.criada_em
    return repositorio.salvar(banco, criacao)


def _validar_mudancas(banco: Session, sessao_id: str, base: Criacao, dados: CriacaoAlterar) -> dict:
    """Configuração de `base` com as mudanças de `dados` aplicadas, já validada contra o modelo."""
    enviados = dados.model_fields_set

    def valor(campo: str, atual):
        return getattr(dados, campo) if campo in enviados else atual

    return validacao.validar(
        banco,
        validacao.Config(
            sessao_id=sessao_id,
            tipo=valor("tipo", base.tipo),
            modelo=valor("modelo", base.modelo),
            prompt=valor("prompt", base.prompt),
            orientacao=valor("orientacao", base.orientacao),
            proporcao=valor("proporcao", base.proporcao),
            duracao=valor("duracao", base.duracao_segundos),
            resolucao=valor("resolucao", base.resolucao),
            referencias=valor("referencias", base.referencias) or [],
            explicitos=enviados,
            extras=valor("parametros_extras", base.parametros_extras),
        ),
    )


def alterar(banco: Session, sessao_id: str, criacao_id: str, dados: CriacaoAlterar) -> Criacao:
    criacao = _criacao(banco, sessao_id, criacao_id)
    if criacao.situacao != "rascunho":
        raise HTTPException(status_code=409, detail="Só é possível editar um rascunho")

    enviados = dados.model_fields_set
    campos = _validar_mudancas(banco, sessao_id, criacao, dados)
    pares = campos.pop("referencias")
    for campo, novo in campos.items():
        setattr(criacao, campo, novo)
    if "referencias" in enviados:
        _ligar_referencias(criacao, pares)
    if "parametros_extras" in enviados:
        criacao.parametros_extras = dados.parametros_extras
    return repositorio.salvar(banco, criacao)


def nova_versao(banco: Session, sessao_id: str, criacao_id: str, dados: CriacaoAlterar) -> Criacao:
    """Cria um rascunho novo a partir de qualquer versão (menos as apagadas), com as mudanças pedidas.

    A versão de origem nunca muda: a nova copia a configuração e as referências dela.
    """
    base = _criacao(banco, sessao_id, criacao_id)
    if base.situacao == "apagado":
        raise HTTPException(status_code=409, detail="Não é possível partir de uma versão apagada")

    campos = _validar_mudancas(banco, sessao_id, base, dados)
    pares = campos.pop("referencias")
    extras = dados.parametros_extras if "parametros_extras" in dados.model_fields_set else base.parametros_extras

    momento = agora()
    nova = Criacao(
        id=uuid4().hex,
        sessao_id=sessao_id,
        versao_de_id=base.id,
        raiz_id=base.raiz_id,
        numero_versao=repositorio.maior_versao(banco, sessao_id, base.raiz_id) + 1,
        situacao="rascunho",
        parametros_extras=dict(extras) if extras else None,
        criada_em=momento,
        **campos,
    )
    _ligar_referencias(nova, pares)
    _sessao(banco, sessao_id).ultimo_uso_em = momento
    return repositorio.salvar(banco, nova)


def versoes(banco: Session, sessao_id: str, criacao_id: str) -> list[Criacao]:
    """Todas as versões da árvore desta criação (v1, v2, v3…), em ordem."""
    criacao = _criacao(banco, sessao_id, criacao_id)
    return repositorio.versoes(banco, sessao_id, criacao.raiz_id)


def gerar(banco: Session, sessao_id: str, criacao_id: str) -> Criacao:
    """Regra "Gerar só com ação do usuário": única porta de entrada para uma geração."""
    criacao = _criacao(banco, sessao_id, criacao_id)
    if criacao.situacao != "rascunho":
        raise HTTPException(status_code=409, detail="Só é possível gerar um rascunho")
    # Revalida contra o catálogo atual: o modelo pode ter mudado desde que o rascunho foi salvo.
    campos = validacao.validar(
        banco,
        validacao.Config(
            sessao_id=sessao_id,
            tipo=criacao.tipo,
            modelo=criacao.modelo,
            prompt=criacao.prompt,
            orientacao=criacao.orientacao,
            proporcao=criacao.proporcao,
            duracao=criacao.duracao_segundos,
            resolucao=criacao.resolucao,
            referencias=criacao.referencias,
            explicitos={"proporcao", "resolucao", "duracao"},
            extras=criacao.parametros_extras,
        ),
    )

    # Troca rascunho → gerando numa operação só: dois cliques seguidos não geram duas vezes.
    campos.pop("referencias")
    momento = agora()
    estimativa_segundos = estimativa.estimar(
        banco, campos["modelo"], campos["tipo"], campos["duracao_segundos"], campos["resolucao"]
    )
    mudou = banco.execute(
        update(Criacao)
        .where(Criacao.id == criacao_id, Criacao.situacao == "rascunho")
        .values(situacao="gerando", iniciada_em=momento, estimativa_segundos=estimativa_segundos, erro=None, **campos)
    ).rowcount
    if not mudou:
        banco.rollback()
        raise HTTPException(status_code=409, detail="Só é possível gerar um rascunho")
    sessao = _sessao(banco, sessao_id)
    sessao.ultimo_uso_em = momento
    banco.commit()
    banco.refresh(criacao)

    executor.enfileirar(criacao_id)
    return criacao


def apagar(banco: Session, sessao_id: str, criacao_id: str) -> None:
    """Regra "Apagar" (spec/dados.md): com versões filhas, a exclusão é lógica (situação `apagado`,
    arquivos removidos, registro mantido para a árvore); sem filhas, é física.

    Se estiver gerando, o acompanhamento para (a OpenRouter não cancela; o resultado é descartado).
    As referências geradas a partir destes brolls continuam valendo: têm cópia própria do arquivo.
    """
    criacao = _criacao(banco, sessao_id, criacao_id)
    if criacao.situacao == "apagado":
        raise HTTPException(status_code=409, detail="Esta versão já foi apagada")

    executor.cancelar([criacao_id])
    arquivos: list[str | None] = []
    atual: Criacao | None = criacao
    while atual is not None:
        arquivos += repositorio.arquivos_dos_brolls(banco, atual.id)
        if repositorio.tem_filhas(banco, atual.id):
            repositorio.apagar_brolls(banco, atual.id)
            banco.execute(
                update(Criacao)
                .where(Criacao.id == atual.id)
                .values(situacao="apagado", erro=None, id_job_openrouter=None)
            )
            break
        # Sem filhas: some de vez. Se a versão de onde partiu já estava apagada e ficou sem
        # nenhuma filha, ela também sai (não sobra versão apagada sem motivo na árvore).
        pai = banco.get(Criacao, atual.versao_de_id) if atual.versao_de_id else None
        repositorio.apagar_fisicamente(banco, atual.id)
        banco.flush()
        atual = pai if pai is not None and pai.situacao == "apagado" else None
    banco.commit()
    apagar_arquivos(arquivos)
