"""Rotas do catálogo de modelos."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.criacoes.estimativa import medias_por_modelo
from app.db import obter_banco
from app.modelos import servico
from app.modelos.esquemas import CatalogoAtualizado, ModeloMidia

rotas = APIRouter(prefix="/api/modelos", tags=["modelos"])


def _com_tempo_medio(banco: Session, tipo: str, busca: str | None) -> list[ModeloMidia]:
    medias = medias_por_modelo(banco, tipo)
    return [
        ModeloMidia.model_validate(modelo).model_copy(update={"tempo_medio_segundos": medias.get(modelo.id)})
        for modelo in servico.listar(banco, tipo, busca)
    ]


@rotas.get("/imagem", response_model=list[ModeloMidia])
def listar_imagem(busca: str | None = None, banco: Session = Depends(obter_banco)):
    return _com_tempo_medio(banco, "imagem", busca)


@rotas.get("/video", response_model=list[ModeloMidia])
def listar_video(busca: str | None = None, banco: Session = Depends(obter_banco)):
    return _com_tempo_medio(banco, "video", busca)


@rotas.post("/atualizar", response_model=CatalogoAtualizado)
async def atualizar(banco: Session = Depends(obter_banco)):
    await servico.atualizar_catalogo()
    return CatalogoAtualizado(atualizado_em=servico.ultima_atualizacao(banco))
