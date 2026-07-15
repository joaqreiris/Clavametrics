---
title: Análise de GPS
slug: gps-analysis
world: performance
app_page: GPS Analysis.html
order: 1
summary: Um painel de GPS com múltiplas visões — distância, zonas de velocidade, acelerações e player load ao longo de sessões, semanas e partidas, com linhas de base, ACWR e tendências de fitness-fadiga.
---

## O que é

Análise de GPS é o espaço de trabalho para dados de carga externa. Ela transforma métricas de GPS por jogador — distância, zonas de velocidade, acelerações, [player load](glossary#player-load) — em revisões de sessão, relatórios semanais, perfis de partida e tendências de monitoramento de carga, comparados com linhas de base da equipe e limiares de risco de lesão.

## Quando usar

Use-a após cada sessão ou partida para revisar o que os atletas realmente fizeram, e ao longo da semana para comparar a carga planejada versus a entregue, identificar valores atípicos e acompanhar fitness e fadiga. Ela compartilha seu motor de [ACWR](glossary#acwr) com o [Monitor de Carga](/support/load-monitor); Análise de GPS é onde você vai para o detalhamento mais profundo, por métrica e por jogador.

## Como funciona

**Escolha uma visão.** Cinco visões cobrem diferentes questões, alternadas na barra de seções:

- **Relatório Semanal do Jogador** — a semana de um jogador: volume dia a dia, comparação semana-vs-partida, ACWR, e a tendência de fitness/fadiga/forma.
- **Controle de Sessão** — a última sessão do elenco: uma tabela completa de métricas, uma matriz de z-scores, um mapa de calor do microciclo e a variação versus sessões passadas equivalentes.
- **Desempenho em Partida** — as partidas de um jogador ao longo da temporada: distância por partida e distribuição das zonas de velocidade.
- **Monitoramento de Carga** — risco de lesão da equipe: medidores de ACWR, alertas de risco e demandas da partida versus treino entregue.
- **Comparar Microciclo** — uma semana de treino contra outra: tabela de diferenças, formato de carga, monotonia/strain e as maiores variações.

**Filtre globalmente.** Uma única barra de filtros comanda todas as visões: um **intervalo de datas** (padrão últimos 30 dias), um seletor de **microciclo**, um seletor de **jogador**, e um alternador **histórico** que traz dados passados importados para as linhas de base e comparações. Os cartões também podem ser fixados a um jogador específico, independentemente do filtro global.

**Importe os dados.** Traga o GPS por arrastar-e-soltar ou navegação de arquivos (`.csv`, `.xlsx`, `.tsv`), um arquivo por sessão ou uma exportação de temporada inteira; as colunas são detectadas automaticamente e mapeadas para os jogadores, e um modelo está disponível para corresponder ao formato esperado. Durante a importação, os valores atípicos de velocidade são sinalizados para revisão.

**Personalize o painel.** Cada visão é um conjunto de cartões que você pode redimensionar (S / M / L / Completo), reordenar, adicionar e remover. **Adicionar cartão** abre uma galeria de modelos baseados em evidências (ACWR, monotonia/strain, CTL/ATL/TSB, zonas de velocidade, valores atípicos…) ou um construtor de gráfico personalizado. **Salvar layout** e **Visões salvas** persistem os arranjos por visão.

**Exporte.** Exporte a tabela da visão atual para CSV.

## Conceitos-chave

**Métricas centrais de GPS.** A página trabalha a partir destes valores por sessão: **distância total**, **distância em alta velocidade (HSR)**, **distância em altíssima velocidade (VHSR)**, **distância de sprint**, **contagem de sprints**, **acelerações** e **desacelerações**, velocidade **máxima** e **média**, **player load**, **distância por minuto**, e **tempo jogado**.

**Zonas de velocidade.** A distância é dividida em faixas de velocidade (caminhada/trote → HSR → VHSR → sprint) para mostrar quanto de uma sessão foi de alta intensidade. Os gráficos de zona de velocidade dividem cada sessão ou partida nessas faixas.

**Player load.** Uma medida cumulativa de carga externa em unidades arbitrárias, derivada do movimento (exposição a aceleração/velocidade). É a métrica base padrão para o ACWR e o modelo de fitness-fadiga.

**ACWR.** A razão carga aguda:crônica — carga recente (aproximadamente 7 dias) sobre a linha de base móvel (aproximadamente 28 dias). Análise de GPS usa o mesmo motor de ACWR compartilhado e configurado pelo clube que o [Monitor de Carga](/support/load-monitor); você pode baseá-lo em player load, distância total, HSR, distância de sprint ou acelerações.

**Fitness · Fadiga · Forma (CTL / ATL / TSB).** O modelo de Banister: **CTL** (carga de treino crônica, EWMA de ~28 dias) lê-se como fitness, **ATL** (carga de treino aguda, EWMA de ~7 dias) como fadiga, e **TSB** (balanço de estresse de treino, CTL − ATL) como forma — positivo é descansado, negativo é fatigado.

**Monotonia e strain (Foster).** **Monotonia** é a carga diária média dividida por seu desvio padrão — alta monotonia significa carga plana e repetitiva. **Strain** é a carga semanal vezes a monotonia. Ambos são indicadores de risco de estagnação/enfermidade e aparecem na visão Comparar Microciclo.

**Z-scores e valores atípicos.** As métricas são padronizadas para sinalizar anomalias. Um z-score **temporal** compara uma sessão com sessões passadas equivalentes (mesmo dia da semana/MD); um z-score **posicional** compara um jogador com a linha de base de sua função. Valores além de um limiar escolhido (2, 2.5 ou 3) são sinalizados como atípicos.

**Sessão versus partida.** A leitura "× média da partida" expressa uma métrica de treino como um múltiplo da demanda da partida (ex.: 0.6× distância = 60% de uma partida), ajudando a dosar a exposição semanal em relação à demanda para a qual os jogadores estão realmente se preparando.

## FAQ

**Como faço para inserir dados?** Carregue um `.csv`, `.xlsx` ou `.tsv` — um arquivo por sessão ou uma exportação de temporada. As colunas são mapeadas automaticamente para os jogadores; use o modelo disponível para download se quiser o formato exato esperado.

**Ela se conecta diretamente ao Catapult / StatSports?** Não com uma sincronização ao vivo — o caminho suportado é a importação de arquivos: exporte a sessão do seu provedor e importe esse arquivo no ClavaMetrics.

**Qual é a diferença para o Monitor de Carga?** Eles compartilham o mesmo motor de ACWR. O Monitor de Carga é o painel de risco ao nível do elenco; Análise de GPS é o aprofundamento — por métrica, por jogador, por sessão, com linhas de base e o modelo de fitness-fadiga.

**Posso comparar duas semanas?** Sim — a visão Comparar Microciclo compara uma semana atual com uma semana de referência, com deltas por jogador, formato de carga, monotonia/strain e as maiores variações.

## Relacionados

- [Monitor de Carga](/support/load-monitor) — a visão de ACWR ao nível do elenco construída sobre o mesmo motor.
- [Calendário](/support/calendar) — onde as sessões são agendadas e a carga planejada é definida.
