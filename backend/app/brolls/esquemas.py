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
