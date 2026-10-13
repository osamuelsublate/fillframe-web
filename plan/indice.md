# Plano de construção: FillFrame

## Onde estamos
Fase ativa: 7
Onda ativa: nenhuma (visual estilo Apple concluído)
Última onda concluída: 7.3
Atualizado em: 2026-10-12

## Fases
| Fase | Nome | O que a pessoa consegue fazer ao final | Status | Ondas |
|---|---|---|---|---|
| 1 | Esqueleto | Abrir o FillFrame no navegador, ver se a chave da OpenRouter está ok, criar sessões e alternar entre elas | concluída | 1.1, 1.2 |
| 2 | Conexão com a OpenRouter | Ver todos os modelos de imagem e vídeo com preço e capacidades, e conversar com a LLM (Opus 5.5 ou MiniMax) | concluída | 2.1, 2.2 |
| 3 | Gerar brolls | Pedir brolls no chat, a LLM preparar, você gerar imagens e vídeos (vertical ou horizontal) com contador e barra de progresso, assistir e baixar | concluída | 3.1, 3.2, 3.3, 3.4, 3.5 |
| 4 | Referências e áudio | Anexar imagens, textos e áudio no chat, usar referências nas criações e transformar uma imagem gerada em vídeo | concluída | 4.1, 4.2, 4.3 |
| 5 | Versões, galeria e organização | Criar e navegar entre versões, usar a Galeria, renomear e apagar sessões, criações e referências | concluída | 5.1, 5.2, 5.3, 5.4 |
| 6 | Fechamento | Usar no dia a dia com mensagens de erro claras, tela revisada e segurança conferida | concluída | 6.1, 6.2 |
| 7 | Visual no estilo Apple | Usar o FillFrame com cara de app da Apple no Mac, no modo claro e no escuro | concluída | 7.1, 7.2, 7.3 |

Total: 7 fases, 21 ondas.

## Ordem das ondas e dependências
| Onda | Depende de |
|---|---|
| 1.1 | – |
| 1.2 | 1.1 |
| 2.1 | 1.2 |
| 2.2 | 2.1 |
| 3.1 | 2.1 |
| 3.2 | 3.1 |
| 3.3 | 3.2 |
| 3.4 | 2.2, 3.3 |
| 3.5 | 3.3 |
| 4.1 | 2.2 |
| 4.2 | 4.1, 3.4 |
| 4.3 | 4.1 |
| 5.1 | 3.4 |
| 5.2 | 4.2 |
| 5.3 | 3.3 |
| 5.4 | 5.1, 4.2 |
| 6.1 | 3.5, 4.3, 5.2, 5.3, 5.4 |
| 6.2 | 6.1 |
| 7.1 | 6.2 |
| 7.2 | 7.1 |
| 7.3 | 7.2 |

## Como atualizar este arquivo
Ao concluir uma onda:
- Marcar a onda como concluída no arquivo da fase.
- Atualizar "Onde estamos" com a próxima onda na ordem.
- Quando todas as ondas de uma fase estiverem concluídas, marcar a fase como concluída e a próxima como em andamento.

Nunca pular uma onda. Nunca iniciar uma onda cujas dependências não estejam concluídas.

## Arquivos
- [mapa.md](mapa.md): atividades e funcionalidades por fase
- [cobertura.md](cobertura.md): matriz de cobertura da spec
- [fase1_esqueleto.md](fase1_esqueleto.md)
- [fase2_openrouter.md](fase2_openrouter.md)
- [fase3_gerar_brolls.md](fase3_gerar_brolls.md)
- [fase4_referencias.md](fase4_referencias.md)
- [fase5_versoes_galeria.md](fase5_versoes_galeria.md)
- [fase6_fechamento.md](fase6_fechamento.md)
- [fase7_visual_apple.md](fase7_visual_apple.md)
