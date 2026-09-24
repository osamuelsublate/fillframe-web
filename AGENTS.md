# FillFrame

Sistema web para criar brolls (takes de apps, erros, diagramas, exemplos que parecem reais), na vertical e na horizontal, para os vídeos de programação do Samuel nas redes sociais. Um chat com uma LLM controla a geração de imagens e vídeos com os modelos da OpenRouter.

Não sou programador. Fale em linguagem simples e, ao terminar qualquer coisa, me diga como testar: onde entrar, o que clicar, o que deve acontecer.

## Onde está o quê

* spec/: como o app deve funcionar. É a fonte da verdade.
* plan/: fases e ondas de construção. plan/indice.md diz onde estamos.

## Regras

* Antes de construir, leia plan/indice.md. Uma onda por vez.
* Ao fechar uma onda: atualize o índice, me diga como testar e pare. Só avança com minha aprovação.
* Não mexa no que já foi aprovado, a menos que eu peça.
* Mudança de escopo: primeiro spec, depois plan, depois código.
* Correção pequena fora de onda não precisa de planejamento, só me avise o que vai mudar.
* Nunca: apagar dados, trocar ferramenta ou biblioteca sem avisar, colocar chaves no código, publicar sem eu pedir.
* O `.env` é intocável: nunca apague, sobrescreva, esvazie, renomeie ou mova um `.env` que já existe, nem perca nenhum valor guardado nele. Só com minha autorização explícita, pedida antes e dada por mim no chat. Para testar sem chave ou com outra chave, use variável de ambiente na hora de rodar, nunca edite o arquivo.

## Regras aprendidas

[Vazio. Me corrigiu duas vezes na mesma coisa, vira uma linha aqui.]
