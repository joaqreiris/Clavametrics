---
title: Planejamento Diário
slug: daily-planning
world: planning
app_page: Daily Planning.html
order: 2
summary: O construtor de sessões — desenhe todo o conteúdo de um dia de treino: fases, exercícios, durações, intensidade, o elenco do dia e a carga de GPS projetada.
---

## O que é

O Planejamento Diário é onde você monta o **conteúdo de uma única sessão de treino** para uma dada data — suas fases e exercícios, suas durações e intensidade, o elenco e as adaptações do dia, e a carga planejada. O [Calendário](/support/calendar) agenda *quando* uma sessão acontece; o Planejamento Diário define *o que* ela é.

## Quando você usa

Você chega aqui a partir do [Calendário](/support/calendar) ao abrir uma sessão de treino, e então desenha o dia: confirme o horário da sessão, o contexto de [microciclo](glossary#microcycle) e [MD-](glossary#md-matchday-offset), defina o elenco e quaisquer adaptações de fisioterapia, adicione os exercícios de ativação e de campo, e verifique os totais e a carga de GPS projetada antes de imprimir ou publicar a folha da sessão para o campo.

## Como funciona

**Confirme o cabeçalho da sessão.** O card do topo contém o nome da sessão, data, horário de início/fim, microciclo, **orientação** (introdutória, ativação, tensão muscular, velocidade, duração, recuperação), **foco** (tático, individual, físico, setorial), um **RPE esperado** (1–10), o offset de **match day** (MD-5 … MD, … MD+2), e um campo de notas para clima, uniforme e contexto. Os campos herdados do Calendário são marcados como originados do calendário. A sessão é criada e salva automaticamente enquanto você edita.

**Leia a barra de totais.** Números ao vivo atualizam à medida que você monta: minutos de **Ativação**, minutos de **Trabalho de campo**, **Total**, **Duração da sessão** e **AU planejadas** — a carga planejada, calculada como RPE esperado × duração total (veja Conceitos-chave).

**Defina o elenco do dia.** O card de elenco agrupa os jogadores por posição e permite filtrar por status com pílulas — **Todos, Disponível, Parcial, Indisponível, Lesionado, Doente, Ausente** — cada uma mostrando uma contagem ao vivo. Clique em um jogador para alterar seu status para aquela data (isso salva na disponibilidade). Jogadores indisponíveis, lesionados e doentes são listados separadamente com o motivo. **Imprimir Plantel** abre uma lista de jogadores imprimível.

**Revise as adaptações de fisioterapia.** Um card exibe jogadores que têm uma adaptação ativa para hoje (puxada da Fisioterapia) — a nota e as modalidades de tratamento — para que a sessão respeite os limites de reabilitação e prevenção. Depois de considerar uma adaptação, você pode marcá-la como **aplicada**, e essa confirmação fica salva.

**Monte as duas fases.** Os exercícios ficam em duas grades:

- **Ativação** — a fase de aquecimento / preparação.
- **Exercícios de campo** — a fase principal.

Em cada uma, adicione um exercício **da Biblioteca de Exercícios** (exercícios criados no planner/Drill Designer, com seu diagrama, dimensões e jogadores) ou adicione uma entrada **Manual** (nome, duração, intensidade, notas). Cada card de exercício mostra sua miniatura, tags, duração e metadados. Defina a duração como um número simples de minutos ou como uma **estrutura de intervalos** — séries × tempo de trabalho + descanso — que o card totaliza para você. Adicione notas por sessão, reordene ou exclua exercícios, e abra um exercício da biblioteca no Drill Designer.

**Verifique a carga de GPS projetada.** Um card recolhível projeta a carga externa da sessão a partir dos exercícios que têm um perfil de GPS: para cada métrica ele multiplica o perfil por minuto do exercício por seus minutos de trabalho e soma ao longo da sessão. Você pode escolher quais métricas exibir e definir um **alvo** por métrica; a barra fica cinza (abaixo), verde (no alvo ±10%) ou âmbar (acima). Uma nota informa quantos exercícios são cobertos (exercícios sem um perfil de GPS não contribuem).

**Imprima ou publique.** Exporte a sessão como uma folha PDF de uma página (papel timbrado, metadados, totais, elenco, e os diagramas dos exercícios de ativação e de campo), ou publique-a para notificar a comissão técnica.

## Conceitos-chave

**Sessão ↔ microciclo ↔ MD-.** Toda sessão de treino pertence a um **microciclo** (a semana de treino construída em torno de um jogo) e carrega um offset **match-day-minus** — MD-5, MD-4, … MD-1, MD, MD+1, MD+2 — medido a partir da data do jogo do microciclo. Esse offset é a lógica de planejamento da semana: ele sinaliza o papel pretendido do dia (por exemplo, MD-1 uma ativação, MD+1 uma recuperação), que por sua vez molda a orientação, o foco e a carga que você define aqui. Veja o [Calendário](/support/calendar) para saber como o microciclo e os rótulos MD- são definidos.

**Fases (ativação vs principal).** Uma sessão é dividida em uma fase de **ativação** e uma fase **principal / de campo**. Ambas as grades alimentam os totais da sessão e a projeção de GPS, mas mantê-las separadas espelha como a sessão realmente ocorre e é impressa.

**Carga planejada (AU).** A carga planejada em unidades arbitrárias é **RPE esperado × duração total da sessão (minutos)** — uma estimativa subjetiva, baseada em intenção, de quão exigente a sessão deve ser. É a contraparte, do lado do planejamento, da carga [s-RPE](glossary#s-rpe) entregue reportada após a sessão (veja [RPE](/support/rpe)) e da carga externa de GPS (veja [Análise GPS](/support/gps-analysis)).

**Estrutura de intervalos (séries / trabalho / descanso).** A duração de um exercício pode ser um número simples de minutos ou uma estrutura de intervalos — séries × tempo de trabalho, mais descanso entre elas. Os minutos de **trabalho** guiam a projeção de GPS (tempo realmente gasto trabalhando); os minutos **totais** (trabalho + descanso) guiam os totais de tempo da sessão.

**Projetado vs entregue.** A projeção de GPS aqui é o que você *planeja* expor os jogadores; o relatório de GPS real após o treino é o que foi *entregue*. Comparar os dois é o ciclo de feedback que ajusta o próximo microciclo.

## FAQ

**De onde vêm os exercícios?** Da Biblioteca de Exercícios (exercícios desenhados no planner/Drill Designer, com diagramas e dimensões) ou de uma entrada Manual que você digita. Os exercícios da biblioteca carregam seus metadados e, quando disponível, um perfil de GPS que alimenta a projeção.

**Por que alguns exercícios não afetam a carga de GPS projetada?** Apenas exercícios que têm um perfil de GPS contribuem. A nota da projeção mostra quantos dos exercícios da sessão são cobertos; os demais precisam de um perfil antes de contar.

**Como o valor de AU planejadas é calculado?** RPE esperado (1–10) × duração total da sessão em minutos. Defina o RPE esperado no cabeçalho da sessão.

**Como defino o status de um jogador para o dia?** Clique no jogador no card de elenco e escolha um status; ele salva na disponibilidade para aquela data e atualiza as contagens do elenco.

## Relacionados

- [Calendário](/support/calendar) — agenda a sessão e define seu microciclo e rótulo MD-.
- [RPE](/support/rpe) — a carga s-RPE entregue, versus as AU planejadas que você define aqui.
- [Análise GPS](/support/gps-analysis) — carga externa planejada versus entregue.
- [Disponibilidade](/support/availability) — os status de jogador mostrados no card de elenco.
