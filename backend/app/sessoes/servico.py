"""Regras de negócio das sessões."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.chat import llms
from app.chat import servico as servico_chat
from app.config import obter_config
from app.criacoes import repositorio as repositorio_criacoes
from app.referencias import repositorio as repositorio_referencias
from app.db import agora
from app.sessoes import repositorio
from app.sessoes.esquemas import SessaoAlterar, SessaoCompleta, SessaoCriar
from app.sessoes.modelos import Sessao

NOME_PADRAO = "Nova sessão"


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
