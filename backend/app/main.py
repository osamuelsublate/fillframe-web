"""Cria o app FastAPI: CORS, formato de erro e rotas."""

import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.brolls.rotas import rotas as rotas_brolls
from app.chat.rotas import rotas as rotas_chat
from app.criacoes.rotas import rotas as rotas_criacoes
from app.db import migrar
from app.erros import ErroDeCampo
from app.geracao import executor
from app.modelos import servico as servico_modelos
from app.modelos.rotas import rotas as rotas_modelos
from app.openrouter.cliente import fechar_cliente
from app.sessoes.rotas import rotas as rotas_sessoes
from app.sistema.rotas import rotas as rotas_sistema

HOST = "127.0.0.1"
PORTA = 8000
ORIGEM_FRONTEND = "http://127.0.0.1:5173"

log = logging.getLogger("fillframe")
if not log.handlers:
    # Mensagens do app no terminal do backend, no mesmo formato do uvicorn.
    _saida = logging.StreamHandler()
    _saida.setFormatter(logging.Formatter("%(levelname)s:     %(message)s"))
    log.addHandler(_saida)
    log.setLevel(logging.INFO)
    log.propagate = False


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    migrar()
    videos_em_andamento = executor.recuperar_ao_iniciar()
    # Atualiza o catálogo em segundo plano, sem travar a subida.
    tarefa_catalogo = asyncio.create_task(servico_modelos.atualizar_se_vencido())
    # Vídeos que estavam gerando voltam a ser acompanhados.
    executor.retomar(videos_em_andamento)
    yield
    tarefa_catalogo.cancel()
    await executor.parar()
    await fechar_cliente()


app = FastAPI(title="FillFrame", lifespan=ciclo_de_vida)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ORIGEM_FRONTEND],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def erro_http(_: Request, exc: HTTPException) -> JSONResponse:
    if exc.status_code == 404 and exc.detail == "Not Found":
        mensagem = "Não encontrado"
    elif isinstance(exc.detail, str):
        mensagem = exc.detail
    else:
        mensagem = "Erro na requisição"
    return JSONResponse(status_code=exc.status_code, content={"erro": mensagem})


@app.exception_handler(ErroDeCampo)
async def erro_de_campo(_: Request, exc: ErroDeCampo) -> JSONResponse:
    conteudo = {"erro": exc.mensagem}
    if exc.campo:
        conteudo["campo"] = exc.campo
    return JSONResponse(status_code=exc.status, content=conteudo)


@app.exception_handler(RequestValidationError)
async def erro_validacao(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"erro": "Dados enviados são inválidos"})


@app.exception_handler(Exception)
async def erro_inesperado(_: Request, exc: Exception) -> JSONResponse:
    log.exception("Erro inesperado")
    return JSONResponse(status_code=500, content={"erro": "Erro inesperado no servidor"})


app.include_router(rotas_sistema)
app.include_router(rotas_sessoes)
app.include_router(rotas_modelos)
app.include_router(rotas_chat)
app.include_router(rotas_criacoes)
app.include_router(rotas_brolls)


def rodar() -> None:
    """Comando `uv run fillframe`: sobe o backend só em 127.0.0.1."""
    uvicorn.run("app.main:app", host=HOST, port=PORTA, reload=True)
