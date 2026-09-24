"""Rotas das referências."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.arquivos.armazenamento import CaminhoInvalido, caminho_seguro
from app.db import obter_banco
from app.referencias import servico
from app.referencias.esquemas import ReferenciaSaida
from app.referencias.modelos import Referencia

rotas = APIRouter(tags=["referencias"])


@rotas.get("/api/sessoes/{sessao_id}/referencias", response_model=list[ReferenciaSaida])
def listar(sessao_id: str, banco: Session = Depends(obter_banco)):
    return servico.listar(banco, sessao_id)


@rotas.post("/api/sessoes/{sessao_id}/referencias", response_model=ReferenciaSaida, status_code=201)
async def enviar(sessao_id: str, arquivo: UploadFile, banco: Session = Depends(obter_banco)):
    # Lê só até 1 byte além do limite: um arquivo gigante é recusado sem ser lido inteiro.
    conteudo = await arquivo.read(servico.LIMITE_LEITURA)
    return servico.anexar(banco, sessao_id, arquivo.filename, conteudo)


class DeBroll(BaseModel):
    broll_id: str


@rotas.post("/api/sessoes/{sessao_id}/referencias/de-broll", response_model=ReferenciaSaida, status_code=201)
def de_broll(sessao_id: str, dados: DeBroll, banco: Session = Depends(obter_banco)):
    return servico.de_broll(banco, sessao_id, dados.broll_id)


@rotas.get("/api/arquivos/referencias/{referencia_id}")
def arquivo_referencia(referencia_id: str, download: bool = False, banco: Session = Depends(obter_banco)):
    referencia = banco.get(Referencia, referencia_id)
    if referencia is None:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    try:
        caminho = caminho_seguro(referencia.arquivo)
    except CaminhoInvalido:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado") from None
    if not caminho.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    nome = referencia.nome_original or caminho.name
    formato = referencia.formato if referencia.tipo != "texto" else f"{referencia.formato}; charset=utf-8"
    return FileResponse(caminho, media_type=formato, filename=nome if download else None)
