---
title: Glossário
slug: glossary
world: overview
order: 0
app_page: 
summary: A fonte única de verdade para os conceitos de domínio do ClavaMetrics — ACWR, s-RPE, EWMA, MD-, microciclos e mais, com as fórmulas reais e referências citadas.
---

## O que é

Este glossário é a fonte única de verdade para os conceitos de domínio usados em todo o ClavaMetrics. Cada entrada dá uma definição curta, como o app realmente o calcula (a fórmula real, retirada do código), como lê-lo e seus limites, e referências. Outras páginas vinculam sua primeira menção de um termo aqui em vez de redefini-lo.

## ACWR {#acwr}

**Razão carga aguda:crônica** — a carga recente (a janela **aguda**) dividida pela linha de base móvel (a janela **crônica**). É um número adimensional que sinaliza a rapidez com que a carga de um jogador está mudando em relação àquilo para o qual ele está condicionado.

**Como o ClavaMetrics o calcula.** Janela aguda = **7 dias**, janela crônica = **28 dias**. As cargas diárias são preenchidas com zero (dias sem treino contam como 0). Dois modelos estão disponíveis (o ativo é uma configuração do clube):

- **EWMA** (padrão) — uma média móvel ponderada exponencialmente com decaimento λ = 2/(N+1), então λ_aguda = 2/8 e λ_crônica = 2/29; a carga de cada dia atualiza a média corrente e ACWR = aguda ÷ crônica.
- **Média móvel** — ACWR = média(últimos 7 dias) ÷ média(janela crônica).

As janelas são **desacopladas** por padrão: a janela crônica exclui os 7 dias agudos (dias 8–28), de modo que o pico recente que está sendo medido não infle também sua própria linha de base. Um jogador precisa de pelo menos **4 sessões** na janela crônica para obter um valor.

**Zonas.** O ClavaMetrics classifica o ACWR como: **abaixo de 0.8** subcarregado · **0.8–1.3** faixa ideal · **1.3–1.5** sobrecarga · **1.5 ou mais** alto risco.

**Como lê-lo — e uma nota de honestidade.** O ACWR é um *sinal de mudança de carga*, não uma previsão de lesão. A ideia da "faixa ideal" e o uso do ACWR como preditor de lesão são **metodologicamente contestados** na literatura: a razão tem problemas de acoplamento matemático e analíticos, e a "faixa ideal" protetora **não se replicou de forma consistente** entre os estudos. Trate o ACWR como uma entrada — leia-o junto do bem-estar, session-RPE e, acima de tudo, do julgamento médico — nunca como um veredito. **Ver Referências 1, 3–9.**

## s-RPE {#s-rpe}

**RPE da sessão (carga da sessão)** — uma medida de carga interna que combina o quão difícil uma sessão foi percebida com quanto tempo ela durou.

**Como o ClavaMetrics o calcula.** **s-RPE = RPE × duração da sessão em minutos**, em unidades arbitrárias (au), com o RPE em uma escala de **1–10**. Uma sessão de 60 minutos avaliada com 7 = 420 au. Esta é a carga por jogador, por sessão que alimenta o ACWR quando a métrica s-RPE é selecionada. **Ver Referência 10.**

## Carga aguda e crônica {#acute-and-chronic-load}

**Carga aguda** é a carga total (ou ponderada por EWMA) ao longo da janela recente (**7 dias** no ClavaMetrics) — o estresse atual. **Carga crônica** é a linha de base móvel ao longo da janela mais longa (**28 dias**) — o que o jogador está condicionado a tolerar. O [ACWR](glossary#acwr) é a aguda relativa à crônica. No modelo desacoplado, a janela crônica exclui os dias agudos para que as duas não se sobreponham.

## EWMA {#ewma}

**Média móvel ponderada exponencialmente** — uma forma de calcular a média de uma série temporal que dá mais peso aos valores recentes. O ClavaMetrics a usa como o modelo padrão de [ACWR](glossary#acwr) porque, ao contrário de uma média móvel simples, ela pondera a carga recente mais fortemente e evita o salto artificial que uma média móvel produz quando uma sessão antiga sai da borda da janela.

**Como o ClavaMetrics o calcula.** Fator de decaimento **λ = 2/(N+1)** para uma janela de N dias; a cada dia: `value = load·λ + previous·(1−λ)`, aplicado com N=7 para a série aguda e N=28 para a série crônica. **Ver Referência 2.**

## MD (deslocamento de dia de jogo) {#md-matchday-offset}

**Dia de jogo menos / mais** — cada dia de uma semana de treino é rotulado em relação à partida. **MD** é a partida; **MD-1 … MD-6** contam para trás a partir dela; **MD+1, MD+2 …** contam para frente (recuperação). É a espinha dorsal do planejamento semanal: o deslocamento sinaliza o papel e a carga pretendidos do dia. No ClavaMetrics, o deslocamento é derivado automaticamente da data da partida do microciclo e pode ser sobrescrito por dia. Ver [Morfociclo](glossary#morphocycle) para a metodologia da qual isso provém.

## Microciclo {#microcycle}

Um **microciclo** é um bloco de treino, geralmente uma semana, construído em torno de uma partida. Ele delimita um conjunto de sessões com uma data de início e fim e (geralmente) uma partida-alvo, e carrega a estrutura [MD](glossary#md-matchday-offset) para seus dias. Os microciclos são a unidade atômica do plano da temporada.

## Morfociclo {#morphocycle}

O **morfociclo** é a estrutura semanal da Periodização Tática (a metodologia de Vítor Frade): a semana é organizada em torno da partida usando os dias [MD-](glossary#md-matchday-offset), com uma distribuição característica de esforço (ex.: variando a contração/tensão dominante, duração e demandas de velocidade conforme a partida se aproxima). O ClavaMetrics o representa através dos rótulos de dia MD- e seus tipos de dia padrão. (Ver a nota de Referências sobre fontes de metodologia.)

## Modelos de periodização {#periodization-models}

Os frameworks de planejamento da temporada que o ClavaMetrics oferece no [Planejador Anual](/support/annual-planner):

- **Periodização Tática** (Frade) — o [morfociclo](glossary#morphocycle); semana organizada em torno da partida, sem blocos macro/meso.
- **Microciclo Estruturado** (Seirul·lo) — as semanas são *tipadas* (ajuste, carga, impacto, competitiva).
- **ATR** (Issurin) — periodização por blocos com blocos macro-meso de acumulação/transmutação/realização.
- **Verheijen** — periodização específica do futebol em blocos de várias semanas.

Estas são metodologias selecionáveis; o app acompanha a estrutura, não a prescrição de treino. **Ver Referência 12** e a nota de Referências.

## Player load {#player-load}

Uma medida de carga externa derivada de acelerômetro (em unidades arbitrárias) acumulada a partir do movimento de um jogador (exposição a aceleração/velocidade). No ClavaMetrics, é uma das métricas de GPS que pode alimentar o [ACWR](glossary#acwr), e é a métrica base padrão para as leituras de carga e de fitness/fadiga. O cálculo exato é proprietário do provedor de GPS (Catapult/StatSports), então o ClavaMetrics o lê a partir dos dados importados em vez de calculá-lo.

## HSR, VHSR e distância de sprint {#hsr-vhsr-and-sprint-distance}

Distância percorrida acima de limiares de velocidade definidos: **corrida em alta velocidade (HSR)**, **corrida em altíssima velocidade (VHSR)** e **distância de sprint**, cada uma acumulando os metros percorridos acima de seu limiar. Elas quantificam a parte de alta intensidade de uma sessão.

**Importante:** os limiares de velocidade são **configuráveis por clube** no ClavaMetrics (e variam por provedor e metodologia), então este glossário deliberadamente **não** publica valores de corte fixos — verifique os limiares configurados do seu clube.

## Acelerações e desacelerações (A+D) {#accelerations-and-decelerations-ad}

Contagens de esforços de aceleração e desaceleração acima de um limiar — um indicador da carga mecânica de mudança de ritmo que a distância sozinha não capta. A métrica combinada **A+D** do ClavaMetrics é simplesmente **acelerações + desacelerações** somadas, disponível como métrica base do [ACWR](glossary#acwr). Assim como nas zonas de velocidade, os limiares de esforço vêm da configuração do provedor de GPS/clube.

## Status de disponibilidade {#availability-status}

Cada jogador carrega um status de disponibilidade diário na matriz de [Disponibilidade](/support/availability). O conjunto é: **disponível** (total), **parcial / limitado** (treino modificado), **lesionado / indisponível** (fora), **doente** (enfermidade), **ausente** (convocação de seleção), e **fora** (contexto de partida, zero minutos). Disponível e parcial contam para o elenco treinável; lesionado, doente e ausente contam como fora. Os status são definidos manualmente e preenchidos automaticamente a partir de lesões ativas sem sobrescrever entradas manuais.

## Carga planejada vs carga real {#planned-load-vs-actual-load}

**Carga planejada** é o que você *pretende*: nas visões de planejamento, o ClavaMetrics a calcula como o **RPE estimado × duração** que você define em uma sessão (a mesma fórmula de [s-RPE](glossary#s-rpe), mas usando o RPE *estimado* da comissão). **Carga real** é o que foi *entregue*: o session-RPE relatado pelos jogadores após o treino, e a carga externa de GPS.

Nota sobre "RPE pendente": no contexto de planejamento/calendário, "RPE pendente" significa uma sessão que ainda **não tem RPE estimado** definido (então sua carga planejada não pode ser calculada) — **não** significa que os jogadores não relataram. O RPE relatado pelos jogadores é acompanhado separadamente na página de [RPE](/support/rpe).

## Referências

Todas as referências abaixo foram verificadas contra o PubMed / o periódico oficial; a citação exata é fornecida. Onde um trabalho é contestado ou metodológico, isso é anotado no termo relevante acima.

1. Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter and harder? *British Journal of Sports Medicine.* 2016;50(5):273–280. [doi:10.1136/bjsports-2015-095788](https://doi.org/10.1136/bjsports-2015-095788) — origem da narrativa da "faixa ideal" do ACWR.
2. Williams S, West S, Cross MJ, Stokes KA. Better way to determine the acute:chronic workload ratio? *British Journal of Sports Medicine.* 2017;51(3):209–210. [doi:10.1136/bjsports-2016-096589](https://doi.org/10.1136/bjsports-2016-096589) — propõe a abordagem EWMA em vez da média móvel.
3. Lolli L, Batterham AM, Hawkins R, et al. Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. *British Journal of Sports Medicine.* 2019;53(15):921–922. [doi:10.1136/bjsports-2017-098110](https://doi.org/10.1136/bjsports-2017-098110) — o argumento a favor de janelas desacopladas.
4. Windt J, Gabbett TJ. Is it all for naught? What does mathematical coupling mean for acute:chronic workload ratios? *British Journal of Sports Medicine.* 2019;53(16):988–990. [doi:10.1136/bjsports-2017-098925](https://doi.org/10.1136/bjsports-2017-098925).
5. Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls. *International Journal of Sports Physiology and Performance.* 2020;15(6):907–913. [doi:10.1123/ijspp.2019-0864](https://doi.org/10.1123/ijspp.2019-0864) — crítica metodológica central.
6. Impellizzeri FM, McCall A, Ward P, Bornn L, Coutts AJ. Training Load and Its Role in Injury Prevention, Part 2: Conceptual and Methodologic Pitfalls. *Journal of Athletic Training.* 2020;55(9):893–901. [doi:10.4085/1062-6050-501-19](https://doi.org/10.4085/1062-6050-501-19).
7. Carbone L, Sampietro M, Cicognini A, et al. Is the Relationship between Acute and Chronic Workload a Valid Predictive Injury Tool? A Bayesian Analysis. *Journal of Clinical Medicine.* 2022;11(19):5945. [doi:10.3390/jcm11195945](https://doi.org/10.3390/jcm11195945) — conclui que o ACWR não é melhor que o acaso na previsão de lesão.
8. Qin W, Li R, Chen L. Acute to chronic workload ratio (ACWR) for predicting sports injury risk: a systematic review and meta-analysis. *BMC Sports Science, Medicine and Rehabilitation.* 2025;17(1):285. [doi:10.1186/s13102-025-01332-x](https://doi.org/10.1186/s13102-025-01332-x) — revisão mais recente; alerta sobre heterogeneidade e replicação inconsistente.
9. Soligard T, Schwellnus M, Alonso J-M, et al. How much is too much? (Part 1) International Olympic Committee consensus statement on load in sport and risk of injury. *British Journal of Sports Medicine.* 2016;50(17):1030–1041. [doi:10.1136/bjsports-2016-096581](https://doi.org/10.1136/bjsports-2016-096581) — o consenso de gestão de carga que as críticas posteriores contestam.
10. Foster C, Florhaug JA, Franklin J, et al. A new approach to monitoring exercise training. *Journal of Strength and Conditioning Research.* 2001;15(1):109–115. PMID: 11708692 — artigo fundacional do session-RPE (s-RPE = RPE × duração; sem DOI, citar pelo PMID).
11. Foster C. Monitoring training in athletes with reference to overtraining syndrome. *Medicine & Science in Sports & Exercise.* 1998;30(7):1164–1168. [doi:10.1097/00005768-199807000-00023](https://doi.org/10.1097/00005768-199807000-00023) — monotonia e strain.
12. Martín-García A, Gómez Díaz A, Bradley PS, Morera F, Casamichana D. Quantification of a Professional Football Team's External Load Using a Microcycle Structure. *Journal of Strength and Conditioning Research.* 2018;32(12):3511–3518. [doi:10.1519/JSC.0000000000002816](https://doi.org/10.1519/JSC.0000000000002816) — uma operacionalização empírica da abordagem do microciclo estruturado.

## Relacionados

- [Monitor de Carga](/support/load-monitor) — o ACWR na prática ao nível do elenco.
- [Análise de GPS](/support/gps-analysis) — as métricas de carga externa definidas aqui.
- [RPE](/support/rpe) — coleta de s-RPE.
- [Planejador Anual](/support/annual-planner) — os modelos de periodização.
