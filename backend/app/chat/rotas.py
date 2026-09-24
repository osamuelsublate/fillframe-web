"""Rotas do chat."""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.chat import llms, servico
from app.chat.esquemas import Llm, MensagemEnviar
from app.db import obter_banco

rotas = APIRouter(prefix="/api", tags=["chat"])


@rotas.post("/sessoes/{sessao_id}/mensagens")
def enviar(sessao_id: str, dados: MensagemEnviar):
    llm, mensagem = servico.preparar_envio(sessao_id, dados)
    return StreamingResponse(
        servico.responder(sessao_id, llm, mensagem),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@rotas.get("/modelos/llm", response_model=list[Llm])
def listar_llms(banco: Session = Depends(obter_banco)):
    return llms.listar(banco)
