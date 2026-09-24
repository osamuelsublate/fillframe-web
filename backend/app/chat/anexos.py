"""Anexos das mensagens no contexto da LLM (regra "Contexto da LLM").

Imagens entram como partes de imagem, reduzidas para no máximo 1568 px (se a LLM enxerga imagens).
Arquivos de texto entram no próprio texto da mensagem, com o nome do arquivo.
"""

import base64
import io
import logging

from PIL import Image

from app.arquivos.armazenamento import CaminhoInvalido, caminho_seguro
from app.referencias.modelos import Referencia

log = logging.getLogger("fillframe")

LADO_MAXIMO = 1568
LIMITE_CARACTERES_TEXTO = 60_000


def _imagem_em_data_url(referencia: Referencia) -> str | None:
    try:
        with Image.open(caminho_seguro(referencia.arquivo)) as imagem:
            imagem.thumbnail((LADO_MAXIMO, LADO_MAXIMO))
            if imagem.mode not in ("RGB", "L"):
                fundo = Image.new("RGB", imagem.size, (255, 255, 255))
                fundo.paste(imagem, mask=imagem.convert("RGBA").split()[-1])
                imagem = fundo
            saida = io.BytesIO()
            imagem.save(saida, "JPEG", quality=85)
    except (CaminhoInvalido, OSError):
        log.warning("Não foi possível ler a imagem de referência %s", referencia.id)
        return None
    return "data:image/jpeg;base64," + base64.b64encode(saida.getvalue()).decode()


def _texto_do_arquivo(referencia: Referencia) -> str:
    try:
        texto = caminho_seguro(referencia.arquivo).read_text(encoding="utf-8")
    except (CaminhoInvalido, OSError, UnicodeDecodeError):
        return "(não foi possível ler o arquivo)"
    if len(texto) > LIMITE_CARACTERES_TEXTO:
        texto = texto[:LIMITE_CARACTERES_TEXTO] + "\n…(arquivo cortado por ser muito longo)"
    return texto


def conteudo_do_usuario(texto: str, anexos: list[Referencia], aceita_imagem: bool) -> str | list[dict]:
    """Monta o `content` da mensagem do usuário: só texto, ou texto + imagens."""
    partes_texto = [texto]
    imagens: list[dict] = []
    for referencia in anexos:
        nome = referencia.nome_original or referencia.id
        if referencia.tipo == "texto":
            partes_texto.append(
                f"[Arquivo anexado: {nome} | referência {referencia.id}]\n```\n{_texto_do_arquivo(referencia)}\n```"
            )
        elif referencia.tipo == "imagem":
            url = _imagem_em_data_url(referencia) if aceita_imagem else None
            if url:
                partes_texto.append(f"[Imagem anexada: {nome} | referência {referencia.id}]")
                imagens.append({"type": "image_url", "image_url": {"url": url}})
            else:
                partes_texto.append(
                    f"[Imagem anexada: {nome} | referência {referencia.id} — esta LLM não enxerga imagens]"
                )

    texto_final = "\n\n".join(partes_texto)
    if not imagens:
        return texto_final
    return [{"type": "text", "text": texto_final}, *imagens]
