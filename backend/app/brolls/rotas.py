"""Arquivos dos brolls, servidos por id (com suporte a Range para o player de vídeo)."""

import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.arquivos.armazenamento import CaminhoInvalido, caminho_seguro
from app.brolls.modelos import Broll
from app.criacoes.modelos import Criacao
from app.db import obter_banco

rotas = APIRouter(prefix="/api/arquivos", tags=["arquivos"])


def _nome_para_download(broll: Broll, criacao: Criacao | None) -> str:
    extensao = broll.arquivo.rsplit(".", 1)[-1]
    modelo = criacao.modelo.split("/")[-1] if criacao else "broll"
    modelo = re.sub(r"[^a-zA-Z0-9._-]+", "-", modelo)
    versao = f"-v{criacao.numero_versao}" if criacao else ""
    return f"fillframe-{modelo}{versao}-{broll.id[:6]}-{broll.indice + 1}.{extensao}"


@rotas.get("/brolls/{broll_id}")
def arquivo_broll(
    broll_id: str,
    download: bool = False,
    miniatura: bool = False,
    banco: Session = Depends(obter_banco),
):
    broll = banco.get(Broll, broll_id)
    if broll is None:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    relativo = broll.miniatura if miniatura and broll.miniatura else broll.arquivo
    try:
        caminho = caminho_seguro(relativo)
    except CaminhoInvalido:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado") from None
    if not caminho.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    formato = "image/jpeg" if relativo == broll.miniatura else broll.formato
    if download:
        criacao = banco.get(Criacao, broll.criacao_id)
        return FileResponse(caminho, media_type=formato, filename=_nome_para_download(broll, criacao))
    return FileResponse(caminho, media_type=formato)
