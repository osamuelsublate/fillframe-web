from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ReferenciaSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tipo: str
    origem: str
    broll_origem_id: str | None
    mensagem_id: str | None
    nome_original: str | None
    formato: str
    tamanho_bytes: int
    criada_em: datetime
    url: str  # link para o arquivo (servido por id, nunca pelo caminho)
