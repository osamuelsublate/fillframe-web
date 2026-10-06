"""Regra "Validar uploads": o tipo vem do conteúdo do arquivo, não só da extensão."""

import io
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from PIL import Image, UnidentifiedImageError

from app.db import PASTA_DADOS
from app.erros import ErroDeCampo

MB = 1024 * 1024
LIMITE_IMAGEM = 20 * MB
LIMITE_TEXTO = 2 * MB
LIMITE_AUDIO = 25 * MB
MAIOR_LIMITE = max(LIMITE_IMAGEM, LIMITE_TEXTO, LIMITE_AUDIO)

# Assinaturas (primeiros bytes) dos formatos de imagem aceitos.
FORMATOS_IMAGEM = {"PNG": ("image/png", "png"), "JPEG": ("image/jpeg", "jpg"), "WEBP": ("image/webp", "webp")}

# Arquivos de texto aceitos, pela extensão (o conteúdo ainda precisa ser texto UTF-8 de verdade).
EXTENSOES_TEXTO = {
    "txt": "text/plain",
    "md": "text/markdown",
    "markdown": "text/markdown",
    "json": "application/json",
    "csv": "text/csv",
    "yaml": "text/yaml",
    "yml": "text/yaml",
    "toml": "text/plain",
    "xml": "text/xml",
    "html": "text/html",
    "css": "text/css",
    "py": "text/x-python",
    "js": "text/javascript",
    "jsx": "text/javascript",
    "ts": "text/typescript",
    "tsx": "text/typescript",
    "sql": "text/x-sql",
    "sh": "text/x-shellscript",
    "java": "text/x-java",
    "go": "text/x-go",
    "rs": "text/x-rust",
    "rb": "text/x-ruby",
    "php": "text/x-php",
    "c": "text/x-c",
    "h": "text/x-c",
    "cpp": "text/x-c++",
    "cs": "text/x-csharp",
    "kt": "text/x-kotlin",
    "swift": "text/x-swift",
    "vue": "text/plain",
    "svelte": "text/plain",
    "ipynb": "application/json",
}

# Áudio: formato pelo conteúdo -> (tipo do arquivo, extensão).
FORMATOS_AUDIO = {
    "webm": ("audio/webm", "webm"),
    "mp3": ("audio/mpeg", "mp3"),
    "wav": ("audio/wav", "wav"),
    "m4a": ("audio/mp4", "m4a"),
}

TIPO_NAO_ACEITO = (
    "Tipo de arquivo não aceito. Envie imagens (PNG, JPG ou WebP), arquivos de texto (.txt, .md, .json ou "
    "código) ou áudio (WebM, MP3, WAV ou M4A)."
)


@dataclass
class ArquivoValidado:
    tipo: str  # imagem / texto / audio
    formato: str
    extensao: str
    conteudo: bytes


def _eh_imagem(inicio: bytes) -> bool:
    return (
        inicio.startswith(b"\x89PNG\r\n\x1a\n")
        or inicio.startswith(b"\xff\xd8\xff")
        or (inicio[:4] == b"RIFF" and inicio[8:12] == b"WEBP")
    )


def _formato_audio(inicio: bytes) -> str | None:
    if inicio.startswith(b"\x1a\x45\xdf\xa3"):  # EBML (WebM), o que o navegador grava
        return "webm"
    if inicio.startswith(b"ID3") or (len(inicio) > 1 and inicio[0] == 0xFF and inicio[1] & 0xE0 == 0xE0):
        return "mp3"
    if inicio[:4] == b"RIFF" and inicio[8:12] == b"WAVE":
        return "wav"
    if inicio[4:8] == b"ftyp":  # MP4/M4A
        return "m4a"
    return None


def validar(nome: str | None, conteudo: bytes) -> ArquivoValidado:
    if not conteudo:
        raise ErroDeCampo("O arquivo está vazio.", "arquivo")

    if _eh_imagem(conteudo[:16]):
        if len(conteudo) > LIMITE_IMAGEM:
            raise ErroDeCampo("Imagem acima de 20 MB.", "arquivo")
        try:
            with Image.open(io.BytesIO(conteudo)) as imagem:
                formato_pil = imagem.format
                imagem.verify()
        except (UnidentifiedImageError, OSError, SyntaxError):
            raise ErroDeCampo("A imagem está corrompida ou não pôde ser lida.", "arquivo") from None
        if formato_pil not in FORMATOS_IMAGEM:
            raise ErroDeCampo(TIPO_NAO_ACEITO, "arquivo")
        formato, extensao = FORMATOS_IMAGEM[formato_pil]
        return ArquivoValidado("imagem", formato, extensao, conteudo)

    formato_audio = _formato_audio(conteudo[:16])
    if formato_audio:
        if len(conteudo) > LIMITE_AUDIO:
            raise ErroDeCampo("Áudio acima de 25 MB.", "arquivo")
        formato, extensao = FORMATOS_AUDIO[formato_audio]
        return ArquivoValidado("audio", formato, extensao, conteudo)

    extensao = Path(nome or "").suffix.lower().lstrip(".")
    if extensao not in EXTENSOES_TEXTO:
        raise ErroDeCampo(TIPO_NAO_ACEITO, "arquivo")
    if len(conteudo) > LIMITE_TEXTO:
        raise ErroDeCampo("Arquivo de texto acima de 2 MB.", "arquivo")
    try:
        conteudo.decode("utf-8")
    except UnicodeDecodeError:
        raise ErroDeCampo("O arquivo não é texto em UTF-8.", "arquivo") from None
    if b"\x00" in conteudo:
        raise ErroDeCampo(TIPO_NAO_ACEITO, "arquivo")
    return ArquivoValidado("texto", EXTENSOES_TEXTO[extensao], extensao, conteudo)


def salvar_referencia(sessao_id: str, arquivo: ArquivoValidado) -> str:
    """Grava em backend/data/sessoes/{sessao}/referencias/ com nome gerado pelo app. Devolve o caminho relativo."""
    pasta = PASTA_DADOS / "sessoes" / sessao_id / "referencias"
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / f"{uuid4().hex}.{arquivo.extensao}"
    destino.write_bytes(arquivo.conteudo)
    return destino.relative_to(PASTA_DADOS).as_posix()
