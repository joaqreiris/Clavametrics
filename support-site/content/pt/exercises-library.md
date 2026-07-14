---
title: Biblioteca de Exercícios
slug: exercises-library
world: planning
app_page: Exercises Library.html
order: 4
summary: O catálogo de exercícios de campo que o clube projetou — pesquisável e filtrável por orientação, intensidade, dia de jogo, tipo de jogo e foco, e reutilizável em sessões.
---

## O que é

A Biblioteca de Exercícios é o catálogo de exercícios de campo que o clube construiu no [Designer de Exercícios](/support/drill-designer). Você navega, pesquisa e filtra por suas etiquetas de treino, visualiza seu diagrama e demandas, e os reutiliza ao planejar sessões.

## Quando usar

Sempre que estiver planejando um treino: encontre um exercício existente por sua orientação, intensidade, adequação ao dia de jogo ou foco, verifique suas dimensões e demandas, depois abra-o no Designer de Exercícios ou adicione-o a uma sessão no [Planejamento Diário](/support/daily-planning). É também onde os dados de "período" do GPS são mapeados para exercícios, para que cada exercício construa um perfil de desempenho.

## Como funciona

**Pesquise e filtre.** Pesquise por nome, use as pílulas rápidas de orientação (Todos / Ativação / Força / Velocidade / Resistência) e abra os filtros da barra lateral — **Orientação, Intensidade, Dia de Jogo, Tipo de jogo, Foco,** e **Equipe** — que são de seleção múltipla e mostram uma contagem por valor. A **Ordenação** alterna Recente → A→Z → Mais longo.

**Navegue.** Alterne entre **Grade** e **Lista**. Cada cartão mostra o diagrama do exercício, um selo de foco (ACT/STR/VEL/END), sua duração e selo de dia de jogo, e um selo "Importado" para exercícios originados de imagem.

**Visualize um exercício.** Clique em um cartão para abrir um painel de visualização com o detalhe completo — jogadores, largura × altura do campo, m² por jogador, duração, dia de jogo, séries e trabalho/descanso, intensidade, orientação, tipo de jogo e etiquetas de foco — e **Abrir no Planejador** para ver ou editar o design no [Designer de Exercícios](/support/drill-designer).

**Mapear GPS para exercícios (admin).** Um assistente "Mapear exercícios (GPS)" permite que um admin combine os **nomes de período** do GPS (ex.: do Catapult) com exercícios da biblioteca, para que o sistema agregue o perfil de GPS de cada exercício — distância média, distância por minuto e player load por minuto — a partir das sessões em que ele foi executado.

## Conceitos-chave

**A taxonomia.** Os exercícios são etiquetados e filtrados ao longo destas dimensões:

| Dimensão | Valores |
| --- | --- |
| Orientação | Ativação, Força, Velocidade, Resistência |
| Intensidade | Baixa, Média, Alta, Muito alta |
| Dia de Jogo | MD-5 … MD … MD+3 |
| Tipo de jogo | Reduzido (SSG), Médio (MSG), Amplo (LSG), ou nenhum |
| Foco | Tático, Individual, Físico, Setorial |
| Equipe | quais categorias podem ver o exercício |

**Orientação e densidade (m²/jogador).** A orientação de um exercício reflete o **espaço por jogador** — a área do campo dividida pelo número de jogadores. Quando não é definida explicitamente, ela é derivada dessa densidade: abaixo de 40 m²/jogador → **Ativação**, 40–80 → **Força**, 80–160 → **Velocidade**, 160 ou mais → **Resistência**. Mais espaço por jogador geralmente significa mais corrida e velocidades mais altas; menos espaço significa mais contatos e trabalho técnico/de ativação. Esta é a mesma lógica de densidade que o [Designer de Exercícios](/support/drill-designer) e a projeção de GPS no [Planejamento Diário](/support/daily-planning) usam.

**Formato de jogo.** O formato captura o formato do jogo — a quantidade de jogadores, a classificação reduzido/médio/amplo e as dimensões do campo — que, junto com a densidade, definem o quão exigente o exercício é.

**Adequação ao dia de jogo.** A etiqueta de dia de jogo diz onde na semana um exercício se encaixa — mais perto do MD para trabalho mais intenso e de menor volume; mais distante para dias de maior volume; MD+1/+2 para recuperação. Ela permite montar uma semana que respeita o morfociclo.

**Perfil de GPS.** Um exercício não tem números de GPS próprios até que suas execuções sejam vinculadas: uma vez que um admin mapeia os nomes de período do GPS para um exercício, o app deriva a carga externa típica desse exercício a partir das sessões reais — e esse perfil é o que alimenta a carga de GPS projetada quando o exercício é usado no Planejamento Diário.

## FAQ

**De onde vêm os exercícios?** Eles são projetados no [Designer de Exercícios](/support/drill-designer); esta biblioteca é o catálogo do que foi construído, em todo o clube, com visibilidade por equipe.

**Por que a orientação de um exercício parece automática?** Se não for definida explicitamente, ela é calculada a partir da densidade (m² por jogador): <40 Ativação, 40–80 Força, 80–160 Velocidade, ≥160 Resistência.

**Como os exercícios obtêm números de GPS?** Um admin mapeia os nomes de período do GPS para o exercício no assistente "Mapear exercícios (GPS)"; o app então agrega o perfil desse exercício a partir das sessões em que ele foi executado.

**Posso restringir um exercício a uma categoria?** Sim — a dimensão Equipe controla quais categorias podem ver um exercício; deixá-la vazia o mostra para todos.

> TODO — favor observar e confirmar: o brief esperava uma taxonomia de **8 dimensões**, mas a página expõe **6** dimensões de filtro (Orientação, Intensidade, Dia de Jogo, Tipo de jogo, Foco, Equipe). Documentei as 6 que o código de fato implementa — se houver dimensões extras (ex.: princípio / sub-princípio / conceito tático) elas não são expostas como filtros aqui; confirme se existem em outro lugar (ex.: dentro do Designer de Exercícios).

## Relacionados

- [Designer de Exercícios](/support/drill-designer) — onde esses exercícios são projetados e editados.
- [Planejamento Diário](/support/daily-planning) — adicione exercícios da biblioteca a uma sessão; seu perfil de GPS alimenta a projeção.
