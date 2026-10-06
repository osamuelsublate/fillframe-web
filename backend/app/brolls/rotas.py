"""Arquivos dos brolls, servidos por id (com suporte a Range para o player de vídeo)."""

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.arquivos.armazenamento import CABECALHOS_SEGUROS, CaminhoInvalido, caminho_seguro
from app.brolls import repositorio
from app.brolls.esquemas import ItemGaleria
from app.brolls.modelos import Broll
from app.criacoes.modelos import Criacao
from app.db import obter_banco
from app.sessoes.modelos import Sessao

rotas = APIRouter(tags=["brolls"])


def _nome_para_download(broll: Broll, criacao: Criacao | None) -> str:
    extensao = broll.arquivo.rsplit(".", 1)[-1]
    modelo = criacao.modelo.split("/")[-1] if criacao else "broll"
    modelo = re.sub(r"[^a-zA-Z0-9._-]+", "-", modelo)
    versao = f"-v{criacao.numero_versao}" if criacao else ""
    return f"fillframe-{modelo}{versao}-{broll.id[:6]}-{broll.indice + 1}.{extensao}"


# Campos do broll que vão para cada item da Galeria.
BROLL_CAMPOS = (
    "id",
    "indice",
    "formato",
    "largura",
    "altura",
    "duracao_segundos",
    "tamanho_bytes",
    "criado_em",
    "url",
    "url_miniatura",
)


@rotas.get("/api/brolls", response_model=list[ItemGaleria])
def galeria(
    sessao_id: str | None = None,
    tipo: Literal["imagem", "video"] | None = None,
    orientacao: Literal["vertical", "horizontal"] | None = None,
    banco: Session = Depends(obter_banco),
):
    """Galeria: sem `sessao_id`, traz os brolls de todas as sessões."""
    if sessao_id and banco.get(Sessao, sessao_id) is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return [
        ItemGaleria.model_validate(
            {
                **{campo: getattr(broll, campo) for campo in BROLL_CAMPOS},
                "criacao_id": criacao.id,
                "raiz_id": criacao.raiz_id,
                "numero_versao": criacao.numero_versao,
                "tipo": criacao.tipo,
                "orientacao": criacao.orientacao,
                "proporcao": criacao.proporcao,
                "modelo": criacao.modelo,
                "prompt": criacao.prompt,
                "sessao_id": sessao.id,
                "sessao_nome": sessao.nome,
            }
        )
        for broll, criacao, sessao in repositorio.galeria(banco, sessao_id, tipo, orientacao)
    ]


@rotas.get("/api/arquivos/brolls/{broll_id}")
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
        return FileResponse(
            caminho, media_type=formato, filename=_nome_para_download(broll, criacao), headers=CABECALHOS_SEGUROS
        )
    return FileResponse(caminho, media_type=formato, headers=CABECALHOS_SEGUROS)
