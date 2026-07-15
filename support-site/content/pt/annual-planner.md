---
title: Planejador Anual
slug: annual-planner
world: planning
app_page: Annual Planner.html
order: 3
summary: O macroplano da temporada — defina um modelo de periodização, distribua fases, competições e jogos, e divida o ano em mesociclos e microciclos semanais.
---

## O que é

O Planejador Anual é a macrovisão de toda a temporada: você escolhe um **[modelo de periodização](glossary#periodization-models)**, marca as **fases** do ano, carrega as **competições e jogos**, e divide a temporada em **microciclos** (semanas) — opcionalmente agrupados em mesociclos — cada um ancorado às suas partidas.

## Quando você usa

Na configuração da pré-temporada e ao longo do ano para o planejamento estratégico: defina a temporada, suas fases e calendário, depois gere e modele a estrutura semanal. A partir daqui você entra no [Calendário](/support/calendar) para detalhar uma dada semana e no [Planejamento Diário](/support/daily-planning) para montar cada sessão.

## Como funciona

**Crie a temporada.** Dê um nome e datas de início/fim, e escolha um **modelo de planejamento** (veja Conceitos-chave). O modelo decide o que o restante da tela oferece — notavelmente se você planeja em blocos (macrociclos/mesociclos) e se os microciclos são tipados.

**Marque as fases.** Adicione fases da temporada (por exemplo, pré-temporada, competitiva, transição, off-season) com uma cor, datas e uma flag **"conta para disponibilidade"** — fases que não contam são desenhadas com um padrão listrado e excluídas do acompanhamento de disponibilidade/carga.

**Adicione competições e jogos.** Registre as competições (liga, copa, internacional, amistoso, supercopa — cada uma com uma cor), depois adicione partidas manualmente ou **importe jogos** arrastando um arquivo (CSV, Excel, PDF) ou colando texto; uma prévia permite conferi-los antes de importar.

**Adicione blocos de periodização (apenas modelos de blocos).** Com um modelo de blocos, crie **macrociclos** e, aninhados dentro deles, **mesociclos** — cada mesociclo carrega um **modelo de carga** (Estruturado, Tático, Verheijen, ATR ou Integral).

**Monte os microciclos.** Adicione uma semana manualmente ou **Gere semanas a partir dos jogos** para distribuir microciclos de seg–dom ao longo da lista de partidas, incorporando automaticamente o jogo em sua semana. No modo de edição, abra um microciclo para definir seu nome, datas, cor, seu mesociclo (modelos de blocos) ou seu **tipo de micro** (modelo Estruturado), e um **plano semanal**: para cada dia, um rótulo **MD** e um **tipo de dia**. **Resetar para morfociclo** limpa um plano de dias personalizado de volta à estrutura automática. **Abrir no Calendário** leva essa semana ao Calendário.

**Leia a linha do tempo.** Uma grande visão de linha do tempo empilha fases, macro/mesociclos (modelos de blocos), microciclos e partidas em uma faixa com zoom (temporada completa → 6 meses → 3 meses → 6 semanas), com painéis de KPI para o microciclo atual, próximo jogo, progresso da temporada e fase ativa.

## Conceitos-chave

**Modelos de periodização.** O modelo da temporada molda como você planeja:

| Modelo | Escola | Blocos? | Micros tipados? |
| --- | --- | --- | --- |
| Periodização Tática | Frade — morfociclo | não | não |
| Microciclo Estruturado | Seirul·lo — micros tipados | não | sim |
| ATR (bloco) | Issurin — macrociclos de 4–6 sem | sim | não |
| Verheijen | futebol — blocos de 6 semanas | sim | não |

- A **Periodização Tática (Frade)** organiza a semana como um *morfociclo* em torno do jogo — sem blocos macro/meso; os tipos de dia se repetem semanalmente em relação ao MD.
- O **Microciclo Estruturado (Seirul·lo)** tipa cada semana por seu papel: **Ajuste**, **Carga**, **Impacto** ou **Competitiva**.
- O **ATR (Issurin)** e o **Verheijen** são modelos de blocos: o ano é construído a partir de macrociclos → mesociclos, cada mesociclo carregando uma ênfase de carga.

**Fases da temporada.** As fases segmentam o ano (pré-temporada, competitiva, transição, off-season, pausas) com sua própria cor e datas. A flag "conta para disponibilidade" decide se o tempo na fase alimenta o acompanhamento de disponibilidade e carga — fases de off-season/pausa geralmente são configuradas para não contar.

**Mesociclo → microciclo.** Em modelos de blocos, um **mesociclo** agrupa vários **microciclos** e define o modelo de carga do bloco; ele não define a estrutura diária. O **microciclo** é a unidade atômica — uma semana (geralmente seg–dom) com um jogo incorporado opcional, um tipo de micro opcional, uma cor e um plano dia a dia.

**Como o MD- é derivado.** O rótulo **match-day-minus** de cada dia vem da data do jogo da semana: o dia do jogo é **MD**, os dias antes contam de trás para frente **MD-1 … MD-6**, e os dias depois contam para cima **MD+1 …**. O modelo mapeia cada MD para um tipo de dia padrão — por exemplo MD-1 → ativação, MD-2 → velocidade, MD-3 → duração, MD-4 → tensão muscular, MD-5 → recuperação, MD+1/MD+2 → recuperação, MD+3 → folga. Você pode sobrescrever qualquer dia, ou resetar a semana de volta a esse padrão de morfociclo. Essa é a mesma estrutura MD- que o [Calendário](/support/calendar) e o [Planejamento Diário](/support/daily-planning) exibem.

## FAQ

**Qual modelo eu devo escolher?** Aquele que corresponde à sua metodologia — Periodização Tática e Microciclo Estruturado planejam semana a semana (sem blocos); ATR e Verheijen adicionam blocos macro/meso. Apenas o modelo Estruturado tipa cada microciclo (Ajuste/Carga/Impacto/Competitiva).

**Como preencho uma temporada rapidamente?** Importe os jogos (CSV, Excel, PDF ou texto colado), depois **Gere semanas a partir dos jogos** para criar os microciclos automaticamente, cada um com seu jogo incorporado.

**De onde vêm os tipos de dia de uma semana?** Da estrutura MD- do modelo — cada dia recebe um tipo padrão a partir de seu rótulo de match-day, que você pode sobrescrever por dia e resetar de volta com "Resetar para morfociclo".

**Qual é a diferença entre uma fase e um mesociclo?** Uma fase é um segmento amplo da temporada (por exemplo, pré-temporada) com uma flag de disponibilidade; um mesociclo é um bloco de periodização (apenas modelos de blocos) que agrupa semanas e define o modelo de carga delas.

## Relacionados

- [Calendário](/support/calendar) — detalhe a semana de um microciclo; jogos e rótulos MD- são compartilhados.
- [Planejamento Diário](/support/daily-planning) — monte cada sessão dentro da semana que o modelo molda.
