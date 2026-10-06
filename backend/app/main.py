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
from app.referencias.rotas import rotas as rotas_referencias
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

# Endereços pelos quais o app pode ser chamado: o backend direto ou pelo proxy do frontend.
HOSTS_PERMITIDOS = {f"{nome}:{porta}" for nome in ("127.0.0.1", "localhost") for porta in (PORTA, 5173)}
ORIGENS_PERMITIDAS = {f"http://{host}" for host in HOSTS_PERMITIDOS}
METODOS_SEM_EFEITO = {"GET", "HEAD", "OPTIONS"}


@app.middleware("http")
async def so_o_proprio_fillframe(request: Request, call_next):
    """Protege contra sites de fora que o navegador esteja abrindo ao mesmo tempo.

    - Host estranho: bloqueia "DNS rebinding" (um site fingindo ser 127.0.0.1 para ler os dados).
    - Origem estranha em pedidos que mudam algo: bloqueia um site mandando, por exemplo, "Gerar"
      (o CORS só impede a leitura da resposta, não o envio de um pedido simples).
    """
    if request.headers.get("host") not in HOSTS_PERMITIDOS:
        return JSONResponse(status_code=403, content={"erro": "Endereço não permitido"})
    origem = request.headers.get("origin")
    if request.method not in METODOS_SEM_EFEITO and origem is not None and origem not in ORIGENS_PERMITIDAS:
        return JSONResponse(status_code=403, content={"erro": "Pedido de outro site recusado"})
    return await call_next(request)


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


def _mensagem_de_validacao(exc: RequestValidationError) -> str:
    """Primeiro problema dos dados enviados, em português."""
    erros = exc.errors()
    if not erros:
        return "Dados enviados são inválidos"
    erro = erros[0]
    campo = str(next((p for p in reversed(erro.get("loc", ())) if isinstance(p, str) and p != "body"), "")) or "pedido"
    limite = (erro.get("ctx") or {}).get("max_length")
    tipo = erro.get("type", "")
    if tipo == "string_too_long":
        return f"O campo {campo} passou do limite de {limite} caracteres."
    if tipo == "too_long":
        return f"Itens demais em {campo} (máximo {limite})."
    if tipo == "json_invalid":
        return "O pedido chegou com dados mal formados."
    if tipo == "missing":
        return f"Falta o campo {campo}."
    if tipo in ("literal_error", "enum"):
        return f"Valor não aceito no campo {campo}."
    return f"Valor inválido no campo {campo}."


@app.exception_handler(RequestValidationError)
async def erro_validacao(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"erro": _mensagem_de_validacao(exc)})


@app.exception_handler(Exception)
async def erro_inesperado(_: Request, exc: Exception) -> JSONResponse:
    # O detalhe completo fica só no terminal do backend; a tela recebe uma mensagem simples.
    log.exception("Erro inesperado")
    return JSONResponse(
        status_code=500, content={"erro": "Algo deu errado no FillFrame. Detalhes no terminal do backend."}
    )


app.include_router(rotas_sistema)
app.include_router(rotas_sessoes)
app.include_router(rotas_modelos)
app.include_router(rotas_chat)
app.include_router(rotas_criacoes)
app.include_router(rotas_brolls)
app.include_router(rotas_referencias)


def rodar() -> None:
    """Comando `uv run fillframe`: sobe o backend só em 127.0.0.1."""
    uvicorn.run("app.main:app", host=HOST, port=PORTA, reload=True)
