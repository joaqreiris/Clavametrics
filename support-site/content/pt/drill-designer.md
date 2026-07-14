---
title: Drill Designer
slug: drill-designer
world: planning
app_page: Planner.html
order: 5
summary: O editor de campo para montar um exercício — posicione jogadores e objetos, desenhe movimentos e zonas, defina o formato e as tags, e salve na Biblioteca de Exercícios.
---

## O que é

O Drill Designer é o editor de campo onde você monta um exercício de treino: desenhe a montagem em um campo de futebol — jogadores, objetos, movimentos e zonas — defina seu formato, dimensões e tags, e salve na [Biblioteca de Exercícios](/support/exercises-library) para reutilização.

## Quando você usa

Quando você cria um novo exercício ou edita um existente. Você chega a ele a partir da Biblioteca de Exercícios ("Novo exercício", ou "Abrir no Planner" em um exercício) e, uma vez salvo, o exercício fica disponível para adicionar a sessões no [Planejamento Diário](/support/daily-planning).

## Como funciona

**Desenhe o exercício.** No canvas do campo você posiciona e organiza:

- **Jogadores** para até quatro equipes (numerados automaticamente, cada equipe com sua própria cor), e **objetos** — bola, cones, barreiras, postes, gols, traves, bonecos, ou seu próprio objeto enviado.
- **Movimentos** — setas que podem ser retas ou curvas, sólidas ou tracejadas.
- **Zonas** — retângulos, círculos, triângulos, losangos, polígonos e formas livres, com cor de preenchimento e opacidade.
- **Rótulos de texto** e **escudos** de equipe.

As ferramentas do canvas incluem selecionar, mover/pan, desenho à mão livre, seleção por laço, desfazer/refazer e zoom/ajuste; você pode escolher a variante de campo (completo, meio, em branco) e girar sua orientação. Como alternativa ao desenho, você pode montar um exercício **baseado em imagem** enviando uma figura.

**Configure o exercício.** Preencha o nome (que analisa automaticamente um formato como "5v5+2" e o tamanho do campo), um objetivo e descrição, visibilidade por categoria, e os parâmetros de treino: **séries**, **tempo de trabalho** e **tempo de descanso** (que calculam automaticamente a **duração**), **match day**, **intensidade**, **foco**, **tipo de jogo**, **orientação física**, **jogadores**, e **largura × altura** do campo.

**Verifique o espaço e a orientação.** O editor mostra os **m² por jogador** e um selo de **orientação** derivado dele, com blocos de referência para os limiares — para que você veja num relance se o formato cai em território de Ativação, Força, Velocidade ou Resistência.

**Veja o perfil de GPS.** Se o exercício foi mapeado a dados de GPS, um painel somente leitura mostra sua carga externa típica (por sessão e por minuto).

**Salve e compartilhe.** Salvar grava o exercício na biblioteca (com uma imagem de prévia gerada automaticamente); você também pode imprimir uma folha ou compartilhar o exercício como um PNG.

## Conceitos-chave

**As dimensões de tag.** Um exercício é etiquetado ao longo de quatro dimensões, além de sua adequação de match-day e visibilidade:

| Dimensão | Valores |
| --- | --- |
| Orientação física | Ativação, Força, Velocidade, Resistência |
| Intensidade | Baixa, Média, Alta, Muito alta |
| Foco (multi-seleção) | Tático, Individual, Físico, Setorial |
| Tipo de jogo | Small-sided (SSG), Medium-sided (MSG), Large-sided (LSG) |

Essas são as mesmas tags que você filtra depois na [Biblioteca de Exercícios](/support/exercises-library).

**Formato de jogo e densidade (m²/jogador).** O **formato** é a contagem de jogadores e a forma small/medium/large-sided; a **densidade** é o espaço por jogador — área do campo ÷ jogadores. A densidade guia a **orientação**: abaixo de 40 m²/jogador → **Ativação**, 40–80 → **Força**, 80–160 → **Velocidade**, 160 e acima → **Resistência**. Mais espaço por jogador significa mais corrida e velocidades mais altas; menos espaço significa mais contatos e trabalho técnico. Você pode deixar a orientação seguir a densidade ou defini-la manualmente.

**Duração e tempo de trabalho.** A duração é calculada a partir de **séries × (trabalho + descanso)**. Separadamente, a porção de **trabalho** (séries × tempo de trabalho) é o tempo em que os jogadores estão realmente ativos — e é isso que alimenta a carga de GPS projetada quando o exercício é usado no [Planejamento Diário](/support/daily-planning).

**Exercícios de canvas vs de imagem.** Um exercício pode ser baseado em **canvas** (desenhado no campo, totalmente editável) ou baseado em **imagem** (uma figura enviada com as mesmas tags e parâmetros) — útil para importar diagramas existentes.

## FAQ

**Preciso desenhar tudo à mão?** Não — você pode enviar um exercício baseado em imagem e ainda etiquetá-lo e definir seus parâmetros. Os exercícios de canvas são os totalmente editáveis, desenhados como diagrama.

**Como a orientação é decidida?** A partir da densidade (m² por jogador): <40 Ativação, 40–80 Força, 80–160 Velocidade, ≥160 Resistência. Você pode sobrescrevê-la manualmente.

**Como a duração é calculada?** Séries × (tempo de trabalho + tempo de descanso). É somente leitura — defina as séries e os tempos de trabalho/descanso e ela segue.

**Para onde vai o exercício depois que eu o salvo?** Para a [Biblioteca de Exercícios](/support/exercises-library), de onde ele pode ser reutilizado em sessões e mapeado a dados de GPS.

> TODO — favor observar e confirmar: o briefing esperava uma taxonomia de **8 dimensões**, mas o Drill Designer implementa **4** dimensões de tag (Orientação, Intensidade, Foco, Tipo de jogo) ao lado dos campos de match-day e formato — não dimensões de princípio / subprincípio / conceito tático. Documentei o que o editor realmente tem. Além disso, os recursos de **compartilhar no chat** e **upload de objeto personalizado** estão presentes mas seu comportamento completo vive em módulos externos que não pude confirmar totalmente aqui.

## Relacionados

- [Biblioteca de Exercícios](/support/exercises-library) — onde os exercícios salvos são catalogados e filtrados.
- [Planejamento Diário](/support/daily-planning) — adicione um exercício a uma sessão; seu tempo de trabalho alimenta a projeção de GPS.
