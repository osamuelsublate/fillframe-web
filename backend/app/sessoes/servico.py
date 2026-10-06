"""Regras de negócio das sessões."""

import logging

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.arquivos.armazenamento import CaminhoInvalido, apagar_pasta_da_sessao
from app.chat import llms
from app.chat import servico as servico_chat
from app.config import obter_config
from app.criacoes import repositorio as repositorio_criacoes
from app.db import agora
from app.geracao import executor
from app.referencias import repositorio as repositorio_referencias
from app.sessoes import repositorio
from app.sessoes.esquemas import SessaoAlterar, SessaoCompleta, SessaoCriar
from app.sessoes.modelos import Sessao

NOME_PADRAO = "Nova sessão"

log = logging.getLogger("fillframe")


def listar(banco: Session) -> list[Sessao]:
    return repositorio.listar(banco)


def _buscar(banco: Session, sessao_id: str) -> Sessao:
    sessao = repositorio.buscar(banco, sessao_id)
    if sessao is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return sessao


def abrir(banco: Session, sessao_id: str) -> SessaoCompleta:
    sessao = _buscar(banco, sessao_id)
    resumo = SessaoCompleta.model_validate(sessao).model_dump(exclude={"mensagens", "criacoes", "referencias"})
    # Tudo passa pela validação, para cada item sair no formato da API.
    return SessaoCompleta.model_validate(
        {
            **resumo,
            "mensagens": servico_chat.listar_mensagens(banco, sessao_id),
            "criacoes": repositorio_criacoes.listar(banco, sessao_id),
            "referencias": repositorio_referencias.listar(banco, sessao_id),
        },
        from_attributes=True,
    )


def criar(banco: Session, dados: SessaoCriar) -> Sessao:
    nome = (dados.nome or "").strip() or NOME_PADRAO
    llm = llms.validar(banco, (dados.llm or "").strip() or obter_config().fillframe_llm_padrao)

    momento = agora()
    sessao = Sessao(nome=nome, llm=llm, criada_em=momento, ultimo_uso_em=momento)
    return repositorio.salvar(banco, sessao)


def alterar(banco: Session, sessao_id: str, dados: SessaoAlterar) -> Sessao:
    sessao = _buscar(banco, sessao_id)
    if dados.nome is not None:
        nome = dados.nome.strip()
        if not 1 <= len(nome) <= 120:
            raise HTTPException(status_code=422, detail="O nome precisa ter de 1 a 120 caracteres")
        sessao.nome = nome
    if dados.llm is not None:
        sessao.llm = llms.validar(banco, dados.llm)
    return repositorio.salvar(banco, sessao)


def apagar(banco: Session, sessao_id: str) -> None:
    """Regra "Apagar": para o acompanhamento das gerações, apaga do banco e depois a pasta de arquivos."""
    _buscar(banco, sessao_id)
    executor.cancelar(repositorio.ids_das_criacoes(banco, sessao_id))
    repositorio.apagar(banco, sessao_id)
    try:
        apagar_pasta_da_sessao(sessao_id)
    except (CaminhoInvalido, OSError):
        # O banco já está limpo; uma sobra de arquivo não impede o uso do app.
        log.exception("Não foi possível apagar a pasta da sessão %s", sessao_id)
