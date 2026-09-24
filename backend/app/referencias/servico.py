"""Regras de negócio das referências."""

import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.arquivos import upload
from app.arquivos.armazenamento import CaminhoInvalido, apagar_arquivos, caminho_seguro
from app.brolls.modelos import Broll
from app.criacoes.modelos import Criacao
from app.db import PASTA_DADOS, agora
from app.referencias import repositorio
from app.referencias.modelos import Referencia
from app.sessoes import repositorio as repositorio_sessoes

LIMITE_LEITURA = upload.MAIOR_LIMITE + 1


def _sessao(banco: Session, sessao_id: str):
    sessao = repositorio_sessoes.buscar(banco, sessao_id)
    if sessao is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return sessao


def listar(banco: Session, sessao_id: str) -> list[Referencia]:
    _sessao(banco, sessao_id)
    return repositorio.listar(banco, sessao_id)


def anexar(banco: Session, sessao_id: str, nome: str | None, conteudo: bytes) -> Referencia:
    _sessao(banco, sessao_id)
    validado = upload.validar(nome, conteudo)
    caminho = upload.salvar_referencia(sessao_id, validado)
    return repositorio.salvar(
        banco,
        Referencia(
            sessao_id=sessao_id,
            tipo=validado.tipo,
            origem="anexada",
            arquivo=caminho,
            # Só o nome, sem pastas: o nome original é para mostrar, nunca para gravar no disco.
            nome_original=(nome or "").replace("\\", "/").split("/")[-1][:255] or None,
            formato=validado.formato,
            tamanho_bytes=len(conteudo),
            criada_em=agora(),
        ),
    )


def de_broll(banco: Session, sessao_id: str, broll_id: str) -> Referencia:
    """Transforma uma imagem gerada em referência da sessão (ex.: primeiro quadro de um vídeo).

    O arquivo é copiado para a pasta de referências: a referência continua valendo mesmo se o
    broll for apagado depois. Se esse broll já virou referência, devolve a mesma.
    """
    _sessao(banco, sessao_id)
    broll = banco.get(Broll, broll_id)
    criacao = banco.get(Criacao, broll.criacao_id) if broll else None
    if broll is None or criacao is None or criacao.sessao_id != sessao_id:
        raise HTTPException(status_code=400, detail="Esse broll não pertence a esta sessão.")
    if not broll.formato.startswith("image/"):
        raise HTTPException(status_code=400, detail="Só imagens geradas podem virar referência.")

    existente = banco.scalar(
        select(Referencia).where(Referencia.sessao_id == sessao_id, Referencia.broll_origem_id == broll_id)
    )
    if existente is not None:
        return existente

    try:
        origem = caminho_seguro(broll.arquivo)
    except CaminhoInvalido:
        raise HTTPException(status_code=400, detail="O arquivo desse broll não foi encontrado.") from None
    if not origem.is_file():
        raise HTTPException(status_code=400, detail="O arquivo desse broll não foi encontrado.")

    pasta = PASTA_DADOS / "sessoes" / sessao_id / "referencias"
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / f"{uuid4().hex}{Path(broll.arquivo).suffix}"
    shutil.copyfile(origem, destino)

    modelo = criacao.modelo.split("/")[-1]
    return repositorio.salvar(
        banco,
        Referencia(
            sessao_id=sessao_id,
            tipo="imagem",
            origem="gerada",
            broll_origem_id=broll_id,
            arquivo=destino.relative_to(PASTA_DADOS).as_posix(),
            nome_original=f"gerada-{modelo}-v{criacao.numero_versao}{Path(broll.arquivo).suffix}",
            formato=broll.formato,
            tamanho_bytes=destino.stat().st_size,
            criada_em=agora(),
        ),
    )


def apagar(banco: Session, sessao_id: str, referencia_id: str) -> None:
    """Exclusão física, bloqueada se a referência foi usada numa criação (a versão precisa continuar
    reproduzível) ou se é o áudio de uma mensagem da conversa."""
    _sessao(banco, sessao_id)
    encontradas = repositorio.buscar_varias(banco, sessao_id, [referencia_id])
    if not encontradas:
        raise HTTPException(status_code=404, detail="Referência não encontrada")
    if repositorio.usada_em_criacao(banco, referencia_id):
        raise HTTPException(status_code=409, detail="Esta referência foi usada em uma criação e não pode ser apagada")
    if repositorio.audio_de_mensagem(banco, referencia_id):
        raise HTTPException(status_code=409, detail="Este áudio faz parte da conversa e não pode ser apagado")
    arquivo = encontradas[0].arquivo
    repositorio.apagar(banco, referencia_id)
    apagar_arquivos([arquivo])
