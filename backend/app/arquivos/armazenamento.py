"""Arquivos do usuário em backend/data/. O banco guarda só o caminho relativo."""

import io
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from PIL import Image

from app.db import PASTA_DADOS

EXTENSOES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
}
LADO_MINIATURA = 480


class CaminhoInvalido(Exception):
    """O caminho aponta para fora de backend/data/."""


@dataclass
class ArquivoSalvo:
    caminho: str  # relativo a backend/data/
    tamanho_bytes: int
    largura: int | None
    altura: int | None
    miniatura: str | None


def caminho_seguro(relativo: str) -> Path:
    """Converte o caminho do banco em caminho real, recusando qualquer coisa fora de backend/data/."""
    raiz = PASTA_DADOS.resolve()
    caminho = (raiz / relativo).resolve()
    if not caminho.is_relative_to(raiz) or caminho == raiz:
        raise CaminhoInvalido(relativo)
    return caminho


def _pasta_brolls(sessao_id: str) -> Path:
    pasta = PASTA_DADOS / "sessoes" / sessao_id / "brolls"
    pasta.mkdir(parents=True, exist_ok=True)
    return pasta


def _miniatura(imagem: Image.Image, destino: Path) -> None:
    copia = imagem.copy()
    copia.thumbnail((LADO_MINIATURA, LADO_MINIATURA))
    if copia.mode not in ("RGB", "L"):
        fundo = Image.new("RGB", copia.size, (255, 255, 255))
        fundo.paste(copia, mask=copia.convert("RGBA").split()[-1])
        copia = fundo
    copia.save(destino, "JPEG", quality=85)


def salvar_imagem(sessao_id: str, conteudo: bytes, formato: str) -> ArquivoSalvo:
    """Grava a imagem com nome gerado pelo app e cria a miniatura."""
    pasta = _pasta_brolls(sessao_id)
    nome = uuid4().hex
    arquivo = pasta / f"{nome}.{EXTENSOES.get(formato, 'bin')}"
    arquivo.write_bytes(conteudo)

    largura = altura = None
    miniatura = None
    try:
        with Image.open(io.BytesIO(conteudo)) as imagem:
            largura, altura = imagem.size
            caminho_miniatura = pasta / f"{nome}_mini.jpg"
            _miniatura(imagem, caminho_miniatura)
            miniatura = caminho_miniatura.relative_to(PASTA_DADOS).as_posix()
    except Exception:
        pass  # Sem miniatura, a tela usa o arquivo original.

    return ArquivoSalvo(
        caminho=arquivo.relative_to(PASTA_DADOS).as_posix(),
        tamanho_bytes=len(conteudo),
        largura=largura,
        altura=altura,
        miniatura=miniatura,
    )


def salvar_video(sessao_id: str, conteudo: bytes, formato: str) -> ArquivoSalvo:
    """Grava o vídeo com nome gerado pelo app. A tela usa o primeiro quadro como miniatura."""
    pasta = _pasta_brolls(sessao_id)
    arquivo = pasta / f"{uuid4().hex}.{EXTENSOES.get(formato, 'mp4')}"
    arquivo.write_bytes(conteudo)
    return ArquivoSalvo(
        caminho=arquivo.relative_to(PASTA_DADOS).as_posix(),
        tamanho_bytes=len(conteudo),
        largura=None,
        altura=None,
        miniatura=None,
    )


def apagar_pasta_da_sessao(sessao_id: str) -> None:
    """Remove backend/data/sessoes/{sessao_id}/ (arquivos de referências e brolls da sessão)."""
    if not re.fullmatch(r"[0-9a-f]{32}", sessao_id):
        raise CaminhoInvalido(sessao_id)
    pasta = caminho_seguro(f"sessoes/{sessao_id}")
    if pasta.parent != (PASTA_DADOS / "sessoes").resolve():
        raise CaminhoInvalido(sessao_id)
    if pasta.is_dir():
        shutil.rmtree(pasta)


def apagar_arquivos(caminhos: list[str | None]) -> None:
    """Apaga arquivos de backend/data/ (caminhos relativos do banco). Os que já não existem são ignorados."""
    for relativo in caminhos:
        if not relativo:
            continue
        try:
            caminho = caminho_seguro(relativo)
        except CaminhoInvalido:
            continue
        if caminho.is_file():
            caminho.unlink()


# Cabeçalhos dos arquivos servidos: o navegador nunca executa nada que venha deles (ex.: um .html anexado).
CABECALHOS_SEGUROS = {"X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox"}
