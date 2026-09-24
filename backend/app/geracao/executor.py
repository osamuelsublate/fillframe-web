"""Executor de gerações: roda dentro do próprio backend, em segundo plano.

Recebe o id de uma criação em `gerando`, chama a OpenRouter, grava os brolls e
marca `pronto` (ou `falhou`, com o motivo). Até N gerações ao mesmo tempo (.env).

- Imagem: uma chamada só.
- Vídeo: envia, guarda o id do job, consulta a cada 10 s e baixa quando fica pronto.
  Se o backend reiniciar, o acompanhamento é retomado pelo id do job.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

import httpx
from sqlalchemy import select

from app.arquivos.armazenamento import ArquivoSalvo, salvar_imagem, salvar_video
from app.brolls.modelos import Broll
from app.config import obter_config
from app.criacoes.modelos import Criacao
from app.db import AbrirBanco, agora
from app.openrouter.erros import ErroOpenRouter
from app.openrouter.imagens import gerar_imagens
from app.openrouter.videos import (
    SITUACOES_FINAIS_COM_ERRO,
    baixar_video,
    consultar_video,
    enviar_video,
)

log = logging.getLogger("fillframe")

MENSAGEM_INTERROMPIDA = "A geração foi interrompida porque o backend foi reiniciado. Gere de novo."
INTERVALO_CONSULTA_VIDEO = 10  # segundos
FALHAS_DE_REDE_SEGUIDAS = 30  # ~5 min sem conseguir consultar
TEMPO_MAXIMO_VIDEO = timedelta(hours=2)

TEMPO_PARA_TERMINAR_ENVIOS = 60  # segundos, ao desligar

_limite: asyncio.Semaphore | None = None
_tarefas: dict[str, asyncio.Task] = {}
# Envios de vídeo em andamento. Ao desligar, o backend espera cada um terminar e salvar o id do job:
# assim o vídeo é retomado depois, em vez de ser enviado (e cobrado) de novo.
_envios: set[asyncio.Future] = set()


@dataclass
class _Pedido:
    sessao_id: str
    tipo: str
    modelo: str
    prompt: str
    proporcao: str | None
    resolucao: str | None
    duracao: int | None
    extras: dict | None
    job: str | None


@dataclass
class _Resultado:
    arquivos: list[tuple[ArquivoSalvo, str]]  # (arquivo, formato)
    custo_usd: float | None
    duracao: float | None = None


def _semaforo() -> asyncio.Semaphore:
    global _limite
    if _limite is None:
        _limite = asyncio.Semaphore(max(1, obter_config().fillframe_geracoes_simultaneas))
    return _limite


def enfileirar(criacao_id: str) -> None:
    if criacao_id in _tarefas:
        return  # Já está sendo acompanhada.
    tarefa = asyncio.get_running_loop().create_task(_executar(criacao_id))
    _tarefas[criacao_id] = tarefa
    tarefa.add_done_callback(lambda _: _tarefas.pop(criacao_id, None))


def _marcar_falha(criacao_id: str, mensagem: str) -> None:
    with AbrirBanco() as banco:
        criacao = banco.get(Criacao, criacao_id)
        if criacao is None or criacao.situacao != "gerando":
            return
        criacao.situacao = "falhou"
        criacao.erro = mensagem
        criacao.concluida_em = agora()
        banco.commit()


def _comecar(criacao_id: str) -> _Pedido | None:
    """Pega a vez na fila: marca o início real (se ainda não tinha job) e lê o pedido."""
    with AbrirBanco() as banco:
        criacao = banco.get(Criacao, criacao_id)
        if criacao is None or criacao.situacao != "gerando":
            return None  # Apagada ou já resolvida enquanto esperava a vez.
        if not criacao.id_job_openrouter:
            # Se esperou na fila, o relógio começa agora, quando a geração começa de verdade.
            criacao.iniciada_em = agora()
            banco.commit()
        return _Pedido(
            sessao_id=criacao.sessao_id,
            tipo=criacao.tipo,
            modelo=criacao.modelo,
            prompt=criacao.prompt,
            proporcao=criacao.proporcao,
            resolucao=criacao.resolucao,
            duracao=criacao.duracao_segundos,
            extras=criacao.parametros_extras,
            job=criacao.id_job_openrouter,
        )


async def _imagem(pedido: _Pedido) -> _Resultado:
    resultado = await gerar_imagens(pedido.modelo, pedido.prompt, pedido.proporcao, pedido.resolucao, pedido.extras)
    arquivos = [
        (salvar_imagem(pedido.sessao_id, imagem.conteudo, imagem.formato), imagem.formato)
        for imagem in resultado.imagens
    ]
    return _Resultado(arquivos, resultado.custo_usd)


async def _enviar_e_guardar(criacao_id: str, pedido: _Pedido) -> str:
    job = await enviar_video(
        pedido.modelo, pedido.prompt, pedido.duracao, pedido.resolucao, pedido.proporcao, pedido.extras
    )
    with AbrirBanco() as banco:
        criacao = banco.get(Criacao, criacao_id)
        if criacao is not None:
            criacao.id_job_openrouter = job
            banco.commit()
    log.info("Vídeo %s enviado à OpenRouter (job %s)", criacao_id, job)
    return job


async def _video(criacao_id: str, pedido: _Pedido) -> _Resultado:
    job = pedido.job
    if not job:
        envio = asyncio.ensure_future(_enviar_e_guardar(criacao_id, pedido))
        _envios.add(envio)
        envio.add_done_callback(_envios.discard)
        # shield: se o backend desligar agora, o envio termina mesmo assim (ver `parar`).
        job = await asyncio.shield(envio)
    else:
        log.info("Retomando o acompanhamento do vídeo %s (job %s)", criacao_id, job)

    inicio = agora()
    falhas_seguidas = 0
    while True:
        await asyncio.sleep(INTERVALO_CONSULTA_VIDEO)
        if agora() - inicio > TEMPO_MAXIMO_VIDEO:
            raise ErroOpenRouter("O vídeo demorou mais de 2 horas e o acompanhamento foi encerrado.")
        try:
            andamento = await consultar_video(job)
        except httpx.HTTPError:
            falhas_seguidas += 1
            if falhas_seguidas >= FALHAS_DE_REDE_SEGUIDAS:
                raise ErroOpenRouter(
                    "Perdi o contato com a OpenRouter por vários minutos enquanto o vídeo era gerado."
                ) from None
            continue
        falhas_seguidas = 0

        if andamento.situacao in SITUACOES_FINAIS_COM_ERRO:
            motivos = {"failed": "falhou", "cancelled": "foi cancelado", "expired": "expirou"}
            detalhe = f": {andamento.erro}" if andamento.erro else "."
            raise ErroOpenRouter(f"O vídeo {motivos[andamento.situacao]} na OpenRouter{detalhe}")

        if andamento.situacao == "completed":
            urls = andamento.urls or [None]
            arquivos = []
            for indice, url in enumerate(urls):
                conteudo, formato = await baixar_video(job, indice, url)
                arquivos.append((salvar_video(pedido.sessao_id, conteudo, formato), formato))
            return _Resultado(arquivos, andamento.custo_usd, pedido.duracao)


def _concluir(criacao_id: str, resultado: _Resultado) -> None:
    with AbrirBanco() as banco:
        criacao = banco.get(Criacao, criacao_id)
        if criacao is None or criacao.situacao != "gerando":
            return
        for indice, (arquivo, formato) in enumerate(resultado.arquivos):
            banco.add(
                Broll(
                    criacao_id=criacao_id,
                    indice=indice,
                    arquivo=arquivo.caminho,
                    formato=formato,
                    largura=arquivo.largura,
                    altura=arquivo.altura,
                    duracao_segundos=resultado.duracao,
                    tamanho_bytes=arquivo.tamanho_bytes,
                    miniatura=arquivo.miniatura,
                    criado_em=agora(),
                )
            )
        criacao.situacao = "pronto"
        criacao.erro = None
        criacao.concluida_em = agora()
        criacao.tempo_gasto_segundos = round((criacao.concluida_em - criacao.iniciada_em).total_seconds(), 1)
        if resultado.custo_usd is not None:
            criacao.custo_usd = Decimal(str(resultado.custo_usd))
        banco.commit()
        log.info("Criação %s pronta em %ss", criacao_id, criacao.tempo_gasto_segundos)


async def _executar(criacao_id: str) -> None:
    tipo = None
    try:
        async with _semaforo():
            pedido = _comecar(criacao_id)
            if pedido is None:
                return
            tipo = pedido.tipo
            resultado = await (_video(criacao_id, pedido) if tipo == "video" else _imagem(pedido))
            _concluir(criacao_id, resultado)
    except ErroOpenRouter as erro:
        _marcar_falha(criacao_id, str(erro))
    except asyncio.CancelledError:
        # O backend está desligando. Vídeo continua na OpenRouter e é retomado ao iniciar;
        # imagem vira "falhou" (a OpenRouter não cobra imagem não entregue).
        if tipo != "video":
            _marcar_falha(criacao_id, MENSAGEM_INTERROMPIDA)
        raise
    except Exception:
        log.exception("Erro inesperado na geração %s", criacao_id)
        _marcar_falha(criacao_id, "Erro inesperado na geração. Tente de novo.")


def recuperar_ao_iniciar() -> list[str]:
    """Ao iniciar: imagens `gerando` viram `falhou`; vídeos `gerando` voltam para a fila (spec, seção 7)."""
    with AbrirBanco() as banco:
        presas = banco.scalars(select(Criacao).where(Criacao.situacao == "gerando")).all()
        retomar = []
        for criacao in presas:
            if criacao.tipo == "video":
                retomar.append(criacao.id)
            else:
                criacao.situacao = "falhou"
                criacao.erro = MENSAGEM_INTERROMPIDA
                criacao.concluida_em = agora()
        banco.commit()
    return retomar


def retomar(criacao_ids: list[str]) -> None:
    for criacao_id in criacao_ids:
        enfileirar(criacao_id)


async def parar() -> None:
    tarefas = list(_tarefas.values())
    for tarefa in tarefas:
        tarefa.cancel()
    if tarefas:
        await asyncio.gather(*tarefas, return_exceptions=True)
    if _envios:
        log.info("Esperando %d envio(s) de vídeo terminar antes de desligar…", len(_envios))
        await asyncio.wait(list(_envios), timeout=TEMPO_PARA_TERMINAR_ENVIOS)
