---
title: Monitor de Carga
slug: load-monitor
world: performance
app_page: Load Monitor.html
order: 2
summary: Um painel de risco de carga ao nível do elenco construído sobre a razão carga aguda:crônica (ACWR) — quem está subcarregado, na faixa ideal, em sobrecarga ou na zona de perigo.
---

## O que é

O Monitor de Carga é um painel de prontidão de todo o elenco centrado na **[razão carga aguda:crônica (ACWR)](glossary#acwr)**. Ele lê a carga recente de cada jogador contra sua própria linha de base móvel e classifica o elenco em zonas de carga — subcarregado, faixa ideal, sobrecarga, ou alto risco — para que a comissão veja de relance quem precisa ser contido e quem tem margem para forçar.

## Quando usar

Use-o na rotina de planejamento diário — tipicamente antes ou depois de uma sessão — para verificar o panorama de risco do elenco, identificar jogadores tendendo à zona de perigo, e cruzar o ACWR com o bem-estar e o session-RPE de hoje. Ele complementa o [Calendário](/support/calendar) (que cria as sessões a partir das quais a carga é calculada) e a [Análise de GPS](/support/gps-analysis) (que oferece o mesmo motor com detalhamentos mais profundos por métrica).

## Como funciona

**Escolha o elenco e o período.** O seletor de equipe delimita todos os dados a uma categoria. Um controle segmentado alterna a janela de tempo: **7d**, **28d** (padrão), **Microciclo**, ou **Temporada**. Alterá-lo re-delimita o gráfico, a distribuição e cada cartão.

**Leia a faixa de KPIs.** Quatro cartões resumem o elenco: ACWR médio (com uma minibarra de zonas), número de jogadores na zona de perigo, média de bem-estar para hoje, e session-RPE médio dos últimos sete dias.

**Leia o gráfico.** O gráfico principal plota o ACWR médio do elenco ao longo do tempo como uma linha, com a carga diária desenhada como barras atrás dela, e linhas de referência tracejadas nos limiares das zonas. É importante ressaltar que a linha do elenco é a **média do ACWR de cada jogador**, não uma única razão agrupada do elenco — fazer a média das razões em vez das cargas brutas evita que jogadores de alto volume dominem o número.

**Leia a distribuição e o bem-estar.** Um donut divide o elenco em fatias faixa-ideal / sobrecarga / perigo / sem-dados (alterne-o para uma tabela se preferir nomes e valores). Um painel de bem-estar mostra as dimensões do check-in de hoje (Sono, Humor, Fadiga, Estresse, Dores — ou o índice de Hooper se o clube o usar), coloridas por quão favorável cada uma é.

**Trabalhe a tabela de jogadores.** Cada jogador aparece com número de camisa, posição, um valor e barra de ACWR, session-RPE, bem-estar, suas figuras de aguda/crônica, e uma pílula de zona. Você pode:

- **Filtrar por zona** — Todos, Perigo, Sobrecarga, Faixa-ideal, Subcarregado.
- **Agrupar por** Posição, Status ou Idade, e **ordenar** por qualquer coluna (o ACWR ordena do maior primeiro por padrão; jogadores sem dados sempre ordenam por último).
- **Agir sobre um sinalizador de bem-estar** — uma linha sinalizada (área dolorida relatada ou nota de bem-estar) abre um modal onde você pode **Marcar como visto** ou **Criar um acompanhamento em Lesões**.

**Ajuste o modelo.** Dois controles alteram como o ACWR é calculado (ver Conceitos-chave): um seletor de **métrica** escolhe qual fluxo de carga alimenta a razão (carga de session-RPE por padrão, ou uma métrica de GPS), e um popover de **modelo** alterna **EWMA vs Média móvel** e janelas crônicas **Desacopladas vs Acopladas**.

**Exporte.** Exporte a tabela para CSV (jogador, posição, ACWR, carga aguda e crônica, zona, último RPE, sessões), e salve o gráfico ou a distribuição como um PNG.

## Conceitos-chave

**ACWR (razão carga aguda:crônica).** Uma razão adimensional da carga recente (a janela **aguda**, últimos 7 dias) para a linha de base móvel do jogador (a janela **crônica**, últimos 28 dias). É um sinalizador de quão rápido a carga está mudando, não um veredito — leia-o junto do bem-estar, RPE e julgamento médico.

**As zonas.** O Monitor de Carga usa estes limites (do motor de ACWR compartilhado):

| Zona | ACWR | Leitura |
| --- | --- | --- |
| Subcarregado | abaixo de 0.8 | A carga recente está abaixo da linha de base — estímulo subótimo, risco de destreinamento. |
| Faixa ideal | 0.8 – 1.3 | A carga está progredindo em sintonia com a linha de base — a faixa-alvo. |
| Sobrecarga | 1.3 – 1.5 | Elevada, tolerável a curto prazo (ex.: um bloco de carga ou taper) — acompanhe de perto. |
| Alto risco | 1.5 ou mais | Um pico agudo — a zona de perigo; combine com o bem-estar antes de decidir. |

Um jogador precisa de pelo menos **4 sessões** na janela crônica para obter um ACWR; abaixo disso ele aparece como "sem dados" e é deixado de fora da média do elenco.

**EWMA vs Média móvel.** O modelo **EWMA** (média móvel ponderada exponencialmente) é o padrão baseado em evidências: ele pondera os dias recentes mais fortemente e evita o "pico" artificial que uma média móvel simples produz quando sessões antigas saem da borda dos 7 dias. O modelo **Móvel** é a média simples da janela. O modelo ativo é uma **configuração de todo o clube**, então cada página que mostra ACWR (Monitor de Carga, Análise de GPS, dossiês de jogador) lê o mesmo número.

**Acoplado vs desacoplado.** Por padrão, as janelas são **desacopladas**: a janela crônica é dos dias 8–28, excluindo os 7 dias agudos. Isso impede que o pico recente que você está tentando detectar infle também a linha de base contra a qual ele é medido (a abordagem metodologicamente preferida). **Acoplado** inclui todos os 28 dias na janela crônica.

**Carga de s-RPE (RPE da sessão).** O fluxo de carga padrão. Para cada sessão, carga = **RPE (0–10) × duração (minutos)**, em unidades arbitrárias — uma medida interna, baseada na percepção, de quão difícil a sessão foi. O seletor de métrica pode trocar isso por um fluxo de GPS (player load, distância total, distância em alta velocidade, distância de sprint, sprints, ou acelerações+desacelerações) quando dados de GPS estão disponíveis.

**Carga aguda vs crônica.** A aguda é a soma da carga dos últimos 7 dias — o estresse recente. A crônica é a linha de base móvel do jogador ao longo de 28 dias — a carga para a qual ele está condicionado. O ACWR é simplesmente a aguda relativa à crônica.

## FAQ

**Qual ACWR é "bom"?** A faixa ideal de 0.8–1.3 é o alvo. 1.3–1.5 é sobrecarga — aceitável brevemente mas digna de acompanhamento. 1.5 ou mais é a zona de pico de alto risco. Abaixo de 0.8 é subcarga.

**Por que um jogador não mostra ACWR?** Ele tem menos de 4 sessões nos últimos 28 dias, então não há histórico suficiente para uma linha de base confiável. Ele é excluído da média do elenco até cruzar esse limiar.

**Qual carga o ACWR usa?** Carga de session-RPE por padrão (RPE × minutos). Use o seletor de métrica para baseá-lo em um fluxo de GPS, onde houver dados de GPS.

**Por que a linha do elenco é uma média de razões?** Porque fazer a média do ACWR de cada jogador (em vez de agrupar a carga bruta do elenco) evita que jogadores de muitos minutos distorçam o panorama ao nível da equipe — reflete o risco da equipe de forma mais fiel.

**De onde vêm os dados de carga?** Das sessões de treino e suas entradas de RPE (e, para métricas de GPS, dos relatórios de GPS importados/sincronizados). O [Calendário](/support/calendar) cria as sessões; os sinalizadores de bem-estar se conectam a Lesões.

## Relacionados

- [Análise de GPS](/support/gps-analysis) — o mesmo motor de ACWR, mais análise por métrica e por jogador.
- [Calendário](/support/calendar) — onde as sessões e a carga planejada se originam.
