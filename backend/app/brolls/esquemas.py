from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BrollSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    indice: int
    formato: str
    largura: int | None
    altura: int | None
    duracao_segundos: float | None
    tamanho_bytes: int
    criado_em: datetime
    url: str  # link para o arquivo (servido por id, nunca pelo caminho)
    url_miniatura: str


class ItemGaleria(BrollSaida):
    """Um broll na Galeria, com a criação (versão) e a sessão de onde veio."""

    criacao_id: str
    raiz_id: str
    numero_versao: int
    tipo: str
    orientacao: str
    proporcao: str | None
    modelo: str
    prompt: str
    sessao_id: str
    sessao_nome: str
