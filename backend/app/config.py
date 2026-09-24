"""Configuração do backend, lida de backend/.env."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PASTA_BACKEND = Path(__file__).resolve().parent.parent


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PASTA_BACKEND / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openrouter_api_key: str = Field(default="", repr=False)
    fillframe_llm_padrao: str = "anthropic/claude-opus-5.5"
    fillframe_llms_permitidas: str = "anthropic/claude-opus-5.5,minimax:ultimo"
    fillframe_modelo_transcricao: str = ""
    fillframe_geracoes_simultaneas: int = 4

    @property
    def llms_permitidas(self) -> list[str]:
        return [m.strip() for m in self.fillframe_llms_permitidas.split(",") if m.strip()]

    @property
    def chave_configurada(self) -> bool:
        return bool(self.openrouter_api_key.strip())


@lru_cache
def obter_config() -> Config:
    return Config()
