---
title: Calendário
slug: calendar
world: planning
app_page: Calendar.html
order: 1
summary: A tela de planejamento da equipe — microciclos, sessões de treino, jogos e logística distribuídos dia a dia em torno do framework de match-day-minus.
---

## O que é

O Calendário é onde a comissão técnica distribui o cronograma da equipe: sessões de treino, jogos, recuperação e logística (viagem, refeições, reuniões, imprensa) organizados em **[microciclos](glossary#microcycle)** e estruturados em torno do framework **[match-day-minus (MD-)](glossary#md-matchday-offset)**.

## Quando você usa

Use o Calendário como ponto de partida de cada semana de planejamento. Você monta o microciclo aqui primeiro — defina a data do jogo, insira as sessões, ajuste os rótulos MD- — e depois detalha cada sessão a partir do Calendário no **Planejamento Diário** (campo) ou no **Planejador de Academia** (academia) para desenhar o conteúdo real. É também onde você importa os jogos da temporada e publica o cronograma para os jogadores.

## Como funciona

**Alterne as visões.** Quatro visões cobrem diferentes horizontes de planejamento:

- **Microciclo** (padrão) — a semana de treino atual de 7 dias, distribuída como uma grade de dias com seus rótulos MD-.
- **Mês** — uma grade de mês completo; as sessões são codificadas por cor por tipo e cada microciclo é tingido para que os blocos sejam fáceis de ver.
- **Lista** — uma lista cronológica das próximas sessões (título, selo de tipo, duração).
- **Visão do jogador** — uma prévia somente para a comissão técnica do que exatamente os jogadores veem, mostrando apenas os eventos compartilhados com eles.

Navegue com o botão **Hoje**, as setas anterior/próximo (avança por semana na visão Microciclo, por mês na visão Mês) e os controles de **zoom** que comprimem ou expandem quantos dias o microciclo mostra.

**Filtre o que você vê.** Pílulas de filtro rápido restringem o calendário a um único tipo: **Todos**, **Treino**, **Academia**, **Jogo**, **Recuperação** ou **Viagem**. O **seletor de equipe** no canto superior esquerdo aplica o escopo de tudo a um elenco/categoria.

**Leia um dia.** Cada sessão aparece como uma pílula colorida carregando seu horário de início e duração. As sessões de treino e academia também mostram uma pequena figura **AU** na visão da comissão técnica — a carga planejada da sessão (veja Conceitos-chave). Os blocos de jogo mostram o escudo do adversário quando um é carregado. Um dia marcado como folga colapsa suas sessões e mostra uma tag **OFF** no lugar.

**Trabalhe com sessões.**

1. **Clique** em uma sessão para abrir seu popover — horário, local, duração, RPE planejado, notas e público. A partir daí, **Edite** ou **Exclua** a sessão, ou salte direto para o **Planejamento Diário** (treino), o **Planejador de Academia** (academia) ou a **Escalação** (jogo).
2. **Arraste** uma sessão para outro dia para movê-la (isso atualiza sua data). Dentro de um dia, sessões sem um horário de início fixo podem ser arrastadas umas sobre as outras para reordená-las; sessões que têm um horário de início são ordenadas por esse horário.
3. Clique no **+** na coluna de um dia para criar um novo evento naquela data. O formulário do evento cobre título, tipo, data, repetição opcional, duração, horário de início, notas, público e — para jogos — adversário, casa/fora, competição, estádio e escudo.

**Defina o ritmo MD-.** Cada dia carrega uma tag MD- derivada da data do jogo do microciclo. Clique em uma tag para sobrescrevê-la manualmente — **Auto**, **MD**, **MD-1** a **MD-6**, **MD+1** a **MD+3**, ou **OFF**. As sobrescritas manuais são marcadas como tais para que você possa distingui-las das calculadas automaticamente.

**Crie um microciclo.** Use **Novo microciclo** para abrir um bloco com um nome, data de início e data de fim. O novo bloco popula a faixa e re-renderiza a grade.

**Importe jogos.** **Importar jogos** abre um diálogo com duas abas — colar texto (um jogo por linha) ou fazer upload de um CSV — analisados em data, adversário, casa/fora e competição. Uma prévia sinaliza conflitos antes de você confirmar, e uma opção de "sobrescrever conflitos" permite substituir entradas existentes. Os jogos confirmados são criados como eventos de partida.

**Publique para os jogadores.** Os eventos carregam um **público**: a comissão técnica sempre vê tudo; você pode adicionalmente compartilhar um evento com Jogadores, Médico ou Diretoria. Um link de compartilhamento público permite que os jogadores abram um cronograma somente leitura apenas dos eventos compartilhados com eles — sem login necessário. O painel à direita mostra o estado de publicação atual (Publicado / Rascunho) e permite gerar ou revogar esse link.

## Conceitos-chave

**Microciclo.** Um bloco de treino — geralmente uma semana — delimitado por uma data de início e fim e construído em torno de um jogo-alvo. Na visão Mês, um microciclo aparece como uma faixa tingida; o cabeçalho resume onde você está (por exemplo, "Microciclo 14 · MD-2").

**Match day minus (MD-) / morfociclo.** Os dias da semana são rotulados em relação ao jogo: **MD** é a partida, **MD-1 … MD-6** contam de trás para frente a partir dela, e **MD+1 … MD+3** são os dias de recuperação após ela. Essa é a lógica de morfociclo usada para distribuir a carga de treino ao longo da semana — o trabalho de alta intensidade é colocado longe do jogo, reduzindo à medida que o MD se aproxima. Os rótulos são calculados automaticamente a partir da data do jogo, mas podem ser sobrescritos por dia.

**Tipos de sessão.** Além de treino, academia, recuperação e jogo, o Calendário gerencia a semana completa: viagem, check-in/out de hotel, saída/chegada do ônibus, reuniões, imprensa, exames médicos, refeições, sessões de vídeo e avaliações. Cada um tem seu próprio ícone e cor para que a semana seja lida num relance.

**Carga planejada (AU).** Para as sessões de treino e academia, o Calendário mostra uma carga planejada em unidades arbitrárias, calculada como **duração (min) × RPE planejado**. As sessões que ainda não têm um RPE são sinalizadas para que a carga planejada da semana permaneça completa.

**Público & publicação.** O público de um evento decide quem o vê — Comissão técnica, Jogadores, Médico ou Diretoria. A publicação gera o cronograma somente leitura do jogador; a Visão do jogador permite pré-visualizá-lo antes de compartilhar.

## FAQ

**Como os rótulos MD- são definidos?** Automaticamente, a partir da data do jogo do microciclo. Clique na tag de qualquer dia para sobrescrevê-la manualmente (Auto, MD, MD-1…MD-6, MD+1…MD+3, OFF); as sobrescritas manuais são marcadas para que você possa distingui-las.

**Posso mover uma sessão para outro dia?** Sim — arraste-a para a coluna do dia de destino. Para reordenar sessões dentro do mesmo dia, arraste as que não têm um horário de início fixo umas sobre as outras; as sessões com horário se ordenam pelo seu horário de início.

**Como os jogadores recebem o cronograma?** Compartilhe eventos com o público Jogadores e publique o link público do microciclo. Os jogadores abrem uma visão somente leitura apenas desses eventos; use a **Visão do jogador** para pré-visualizá-lo primeiro.

**Onde eu realmente monto o conteúdo da sessão?** O Calendário agenda as sessões; abra uma e use **Abrir no Planejamento Diário** (campo) ou **Abrir no Planejador de Academia** (academia) para desenhar os exercícios e blocos.

## Relacionados

- [Monitor de Carga](/support/load-monitor) — a carga que você planeja aqui alimenta as razões aguda:crônica lá.
- [Análise GPS](/support/gps-analysis) — compare o que você planejou com o que os atletas realmente fizeram.
