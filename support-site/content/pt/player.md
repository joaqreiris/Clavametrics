---
title: Perfil do Jogador
slug: player
world: squad
app_page: Player.html
order: 3
summary: Os dados de um atleta em uma única visualização somente-leitura — identidade, KPIs e abas para testes físicos, carga & bem-estar, e disponibilidade & lesões, cada um extraído de seu próprio módulo.
---

## O que é

O Perfil do Jogador é um **agregador somente-leitura**: os dados-chave de um atleta reunidos de todo o aplicativo em uma única visualização — identidade e KPIs da temporada no topo, depois abas para testes físicos, carga & bem-estar, e disponibilidade & lesões. Cada bloco é uma janela para um módulo dedicado.

## Quando você usa

Para uma leitura rápida e completa de um jogador — um briefing pré-sessão ou pré-jogo (disponibilidade, zona de [ACWR](glossary#acwr), prontidão), uma verificação de progresso (evolução de testes, tendência de bem-estar), ou uma revisão do histórico de lesões — sem pular entre páginas. Você o acessa a partir do [Squad](/support/squad) abrindo um jogador.

## Como funciona

**Cartão de identidade.** Foto, nome, posição, status, categoria e o básico — idade, nacionalidade, altura, peso, pé dominante.

**Faixa de KPIs (temporada).** Seis números de destaque: **Minutos jogados**, **Treinos realizados**, **% de disponibilidade**, **Dias de fora**, **ACWR** (razão de carga do jogador com sua zona) e **Prontidão** (média de bem-estar de 7 dias).

**Quatro abas.**

- **Visão geral** — um radar técnico e pontuações táticas/mentais (de avaliações pontuadas /10), uma avaliação física atual (últimos testes objetivos mais um instantâneo da plataforma de força) e um resumo de lesões.
- **Físico & testes** — escolha um tipo de teste para ver seu gráfico de evolução (com a faixa do elenco onde há pares suficientes) e uma tabela de registros com variações em relação ao resultado anterior.
- **Carga & bem-estar** — um medidor de ACWR, a tendência de forma/fadiga/condição (CTL · ATL · TSB), a carga semanal de s-RPE com monotonia e strain, e uma tendência de bem-estar de 14 dias.
- **Disponibilidade & lesões** — um mapa de calor de disponibilidade da temporada, a linha do tempo do histórico de lesões e um detalhamento de dias de fora por causa.

As abas carregam no primeiro clique. A página é somente-leitura — você alterna abas, muda a métrica de ACWR ou filtra tipos de teste, mas não edita dados aqui.

## Conceitos-chave

**Um agregador, não uma fonte.** Nada se origina nesta página. Cada bloco espelha um módulo dedicado e lê seus dados ao vivo: os cartões de carga e bem-estar espelham o [Load Monitor](/support/load-monitor) e o [Wellness](/support/wellness); os testes espelham as [Evaluations](/support/evaluations); a disponibilidade e as lesões espelham a [Availability](/support/availability). Para mudar qualquer coisa, vá a esse módulo — o perfil apenas o reflete.

**Janela da temporada.** Os KPIs e a Visão geral usam a janela de temporada do clube, de modo que os números compartilhem um intervalo de datas consistente.

**Benchmarking.** Nos testes físicos, o resultado de um jogador é comparado ao **cohort da equipe** — mas apenas quando há pares suficientes (pelo menos quatro) para tornar a comparação significativa; caso contrário, o perfil informa isso. Essa é a mesma regra de cohort que a página [Evaluations](/support/evaluations) usa.

**O que ele NÃO mostra.** O perfil é um resumo, então várias coisas ficam em outro lugar: **métricas de GPS** detalhadas (distância, velocidade, acelerações — aqui você só obtém o ACWR; o detalhe completo está em [GPS Analysis](/support/gps-analysis)); detalhe de **sessão/microciclo** ([Sessions History](/support/sessions-history), [Calendar](/support/calendar)); **estatísticas de eventos de jogo** (gols, assistências); **nutrição** e **vídeo**; e o **dossiê** médico completo (aqui aparecem apenas estatísticas de resumo).

## FAQ

**Posso editar o jogador aqui?** Não — é somente-leitura. Edite o jogador no [Squad](/support/squad); altere disponibilidade, testes, bem-estar ou lesões em seus próprios módulos, e o perfil reflete isso.

**Por que um percentil às vezes não aparece?** Porque o cohort da equipe tem menos que o mínimo de pares necessários para uma comparação válida.

**Onde está o detalhamento completo de GPS?** Não aqui — o perfil mostra apenas o ACWR. Abra [GPS Analysis](/support/gps-analysis) para distância, velocidade e acelerações.

**Como chego ao perfil de um jogador?** A partir do [Squad](/support/squad), abra o jogador (o perfil é por jogador, indexado pelo jogador).

## Relacionados

- [Squad](/support/squad) — o elenco a partir do qual você abre o perfil.
- [Load Monitor](/support/load-monitor) — a visualização completa de carga que os cartões ACWR/CTL/ATL espelham.
- [Wellness](/support/wellness) — o histórico completo de check-ins por trás da tendência de 14 dias.
- [Evaluations](/support/evaluations) — o módulo de testes por trás das abas físicas.
- [Availability](/support/availability) — onde os dados do mapa de calor de disponibilidade são definidos.
