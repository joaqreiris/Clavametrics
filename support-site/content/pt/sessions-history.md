---
title: Histórico de Sessões
slug: sessions-history
world: performance
app_page: Sessions History.html
order: 6
summary: O arquivo de sessões de treino passadas — filtre, revise e compare sessões concluídas, e traga à tona importações históricas retroativas que carregam dados reais de carga e GPS.
---

## O que é

Histórico de Sessões é o arquivo de sessões de treino passadas: cada sessão concluída, filtrável e comparável, com sua carga, presença e contexto de dia de jogo — mais as importações **históricas** retroativas que carregam dados reais, mas nunca foram planejadas no aplicativo.

## Quando você usa

Para olhar para trás — auditar o que foi realmente feito, revisar a progressão de carga ao longo de um bloco, encontrar e copiar uma sessão passada, ou comparar algumas sessões lado a lado. É também onde você traz à tona as sessões históricas importadas que constroem a linha de base de carga de um jogador.

## Como funciona

**Escolha uma visualização.** O mesmo conjunto filtrado de sessões é renderizado de três formas: **Lista** (uma tabela paginada), **Grade** (cartões com data, foco, duração, carga e presença) e **Calendário** (uma grade mensal, codificada por cores por foco).

**Filtre.** Um intervalo de datas (7d / 30d / 90d / Temporada, padrão últimos 30 dias), um seletor de equipe, e alternâncias para **orientação** (Introdutória, Ativação, Tensão muscular, Velocidade, Duração, Recuperação), **foco** (Tático, Individual, Físico, Setorial), **faixa de carga** (Baixa 0–299, Moderada 300–599, Alta 600–899, Pico 900+ AU) e **posição MD** (MD-5 … MD … MD+2). Uma caixa de **busca** corresponde a título e observações, e uma caixa de seleção **"Mostrar importações históricas de GPS"** revela as sessões históricas (ocultas por padrão).

**Leia uma linha.** A tabela mostra data, posição MD, título da sessão, foco, orientação, duração, **carga** (AU, com uma barra) e presença. As ações de linha **Abrir** a sessão em [Daily Planning](/support/daily-planning) ou **Copiar** para uma nova sessão.

**Abra o detalhe.** Clicar em uma sessão desliza um painel com seus metadados (data, MD, tipo/orientação, duração, carga e faixa de carga, RPE estimado, presença), observações e seus exercícios. A partir daí, você pode editar o básico inline, ir ao [Daily Planning](/support/daily-planning) para uma edição completa, ou abrir uma sessão de academia no [Gym Planner](/support/gym-planner).

**Trabalhe entre sessões.** **Nova sessão** cria uma para hoje, **Exportar CSV** baixa a lista filtrada, e **Comparar sessões** coloca duas ou três lado a lado (data, MD, tipo, duração, orientação, carga, entradas de RPE, observações).

## Conceitos-chave

**Sessões históricas (`is_historical`).** Uma sessão histórica é uma **retroativa ou importada** em vez de planejada no aplicativo — por exemplo, sessões recuperadas de exportações de GPS ou inseridas depois do fato. Elas carregam dados reais de carga, presença e GPS, mas não foram agendadas pelo planejador. São **ocultas por padrão** aqui e excluídas das visualizações de planejamento futuro (Calendário, Daily Planning); a alternância "Mostrar importações históricas de GPS" as traz para o arquivo.

**Planejada vs. histórica.** Uma sessão **planejada** é criada no [Daily Planning](/support/daily-planning) para agendamento futuro e pode ainda não ter dados de carga. Uma sessão **histórica** já carrega seus dados entregues. O arquivo contém ambas; o planejamento exibe apenas as planejadas.

**Por que o arquivo importa.** O lado crônico do [ACWR](glossary#acwr) precisa de semanas de histórico de carga. As importações históricas permitem preencher retroativamente esse histórico, para que o [Load Monitor](/support/load-monitor) possa calcular uma razão aguda:crônica significativa desde o primeiro dia e você possa analisar a carga retrospectivamente — sem que essas sessões retroativas atrapalhem o calendário de planejamento.

**Carga (AU).** A carga de cada sessão em unidades arbitrárias é derivada de RPE × duração (por jogador quando o session-RPE existe, caso contrário a partir do RPE estimado), que é o que as faixas de carga e o Load Monitor constroem.

**Posição MD.** Cada sessão é posicionada em relação ao jogo de seu microciclo — MD é o jogo, MD-n os dias antes, MD+n os dias depois — para que você possa filtrar o arquivo por onde as sessões se situaram na semana.

## FAQ

**Por que não vejo todas as minhas sessões?** Por padrão, o arquivo mostra apenas sessões planejadas no intervalo de datas selecionado. Marque **Mostrar importações históricas de GPS** para incluir as retroativas/importadas, e amplie o intervalo de datas se necessário.

**O que torna uma sessão "histórica"?** Ela foi importada ou preenchida retroativamente (`is_historical`) em vez de planejada no aplicativo — carrega dados reais, mas nunca passou pelo planejador, então é ocultada das visualizações de planejamento.

**Como reutilizo uma sessão passada?** Use **Copiar** na linha para criar uma nova sessão a partir dela, ou abra-a e edite no Daily Planning.

**Posso comparar sessões?** Sim — **Comparar sessões** mostra duas ou três lado a lado.

## Relacionados

- [Daily Planning](/support/daily-planning) — onde as sessões são montadas e editadas.
- [Calendar](/support/calendar) — a visualização de planejamento futuro das mesmas sessões.
- [Load Monitor](/support/load-monitor) — o histórico de carga do arquivo alimenta a janela crônica do ACWR.
- [GPS Analysis](/support/gps-analysis) — onde as sessões de GPS importadas são analisadas.
