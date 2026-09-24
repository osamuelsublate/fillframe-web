"""Prepara as imagens de referência de uma criação para enviar à OpenRouter (data URL em base64)."""

import base64
import io

from PIL import Image

from app.arquivos.armazenamento import caminho_seguro

LADO_MAXIMO = 2048  # suficiente para qualquer resolução de vídeo; evita mandar arquivos enormes


def data_url(caminho_relativo: str) -> str:
    with Image.open(caminho_seguro(caminho_relativo)) as imagem:
        imagem.load()
        if max(imagem.size) > LADO_MAXIMO:
            imagem.thumbnail((LADO_MAXIMO, LADO_MAXIMO))
        saida = io.BytesIO()
        if imagem.mode in ("RGBA", "LA", "P"):
            imagem.save(saida, "PNG")
            formato = "image/png"
        else:
            imagem.convert("RGB").save(saida, "JPEG", quality=92)
            formato = "image/jpeg"
    return f"data:{formato};base64," + base64.b64encode(saida.getvalue()).decode()
