"""Erros com mensagem para a tela."""


class ErroDeCampo(Exception):
    """Erro de validação ligado a um campo do formulário. Vira {"erro": ..., "campo": ...}."""

    def __init__(self, mensagem: str, campo: str | None = None, status: int = 400):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.campo = campo
        self.status = status
