---
title: Avaliações
slug: evaluations
world: performance
app_page: Evaluations.html
order: 5
summary: O módulo de testes físicos — registre saltos, sprints, resistência, força e testes em plataforma de força, compare com o elenco e acompanhe a evolução de cada jogador.
---

## O que é

Avaliações é o módulo de testes físicos e de desempenho: você registra testes medidos (saltos, sprints, resistência, força, métricas de plataforma de força) e avaliações subjetivas de campo (técnicas, táticas, mentais), compara os jogadores com o elenco e acompanha a evolução de cada um ao longo do tempo.

## Quando usar

Sempre que você testar: após uma sessão de salto/sprint/resistência, ao importar exportações de plataforma de força, ao calcular um teste guiado (30-15 IFT, VBT, perfil F-V, composição corporal) ou ao avaliar jogadores em campo. Depois você revisa os resultados — a tendência de um jogador ou o ranking do elenco em uma métrica — e os resultados alimentam o [Perfil do Jogador](/support/player) e os grupos de carga no [Planejador de Academia](/support/gym-planner).

## Como funciona

**Escolha a ramificação.** Um segmento superior separa **Medidos** (testes objetivos com resultados numéricos) de **Avaliação de campo** (avaliações subjetivas em dimensões técnica/tática/mental, 1–10).

**Navegue pelo catálogo de testes.** Os testes medidos são agrupados em categorias — Saltos e potência, Velocidade e agilidade, Resistência / VO₂max, Força / VBT, Mobilidade e triagem, e Antropometria — cada uma contendo vários testes (CMJ, parciais de sprint, 30-15 IFT, Nordic hamstring, FMS, composição corporal e mais). Escolha um teste para abrir seus resultados.

**Visualize os resultados.** Para um teste, você pode ver a visão **Equipe** (os valores do elenco, ordenados e classificados em relação à média da equipe) ou a visão **Individual** de um jogador — seu valor mais recente, sua média pessoal, um gráfico de tendência ao longo das datas e uma tabela dos resultados recentes com o delta em relação ao teste anterior (e a assimetria esquerda/direita quando o teste é bilateral).

**Carregue os resultados.** Insira dados manualmente — um único jogador ou uma grade **em massa** para o elenco inteiro em uma data — ou **importe um CSV** (uma lista de jogador+valor para avaliações, ou uma exportação de dispositivo como um CSV de plataforma de força para testes de força). Alguns testes abrem uma **calculadora** que recebe entradas guiadas e calcula o resultado para você (ex.: 30-15 IFT, carga–velocidade VBT, perfil F-V, FMS, composição corporal por dobras cutâneas, 1RM).

## Conceitos-chave

**Avaliações vs testes de força.** O módulo armazena dois formatos diferentes de dados:

- Uma **avaliação** é um **valor único** por instância de teste — um jogador, um tipo de teste, uma data, um resultado (com sua unidade e nota opcional). Salto horizontal 2.15 m, uma parcial de sprint, uma distância de Yo-Yo.
- Um **teste de força** é **multimétrico** — uma sessão de plataforma de força que produz muitas métricas ao mesmo tempo (altura do salto, potência de pico, RSI, assimetria esquerda/direita, …), armazenada como um teste pai com suas métricas filhas.

Então um salto inserido manualmente é um valor de avaliação; o mesmo salto capturado em uma plataforma de força é um teste de força carregando um conjunto inteiro de métricas, incluindo a simetria dos membros.

**Percentis e a coorte do elenco.** O resultado de um jogador é comparado com a **coorte da equipe** — os valores dos outros jogadores para esse mesmo teste/métrica — e não com uma norma de todo o clube ou externa. É importante ressaltar que um percentil só é exibido quando a coorte tem **pelo menos quatro pares** com um valor; abaixo disso a página informa que não há pares suficientes para comparar. Isso evita que um "percentil" seja calculado sobre um ou dois pontos de dados, onde seria sem sentido. Dentro da visão de equipe, cada resultado também é classificado simplesmente como na/acima da média, abaixo, ou bem abaixo.

**Evolução ao longo do tempo.** Para cada teste, o módulo acompanha o histórico de um jogador: o valor mais recente em relação à sua **média pessoal**, a variação percentual e um gráfico ao longo de todas as datas de teste. Ele evidencia a mudança recente em vez de um único instantâneo — então você lê um teste como uma trajetória, não como um número isolado.

**Avaliação de campo.** Separada dos testes medidos, a ramificação de avaliação de campo avalia jogadores em dimensões técnica, tática e mental em uma escala de 1–10, com média em um panorama geral — um complemento subjetivo aos números objetivos.

## FAQ

**Qual é a diferença entre uma avaliação e um teste de força?** Uma avaliação é um valor por teste (um jogador, uma data, um resultado). Um teste de força é uma sessão de plataforma de força que registra muitas métricas ao mesmo tempo, incluindo a assimetria esquerda/direita.

**Por que não vejo um percentil para um jogador?** Porque menos de quatro companheiros têm um valor para esse teste — abaixo desse mínimo a comparação não é exibida, pois um percentil sobre tão poucos pares não seria confiável.

**O percentil é contra outros clubes?** Não — é contra a própria coorte da equipe do jogador.

**Como faço para inserir dados?** Insira manualmente (individual ou grade em massa do elenco), importe um CSV, ou use a calculadora integrada de um teste para testes guiados (30-15 IFT, VBT, perfil F-V, FMS, composição corporal, 1RM).

**Onde os resultados dos testes aparecem em outros lugares?** No [Perfil do Jogador](/support/player) (instantâneo mais recente e evolução) e como base para os grupos de carga do [Planejador de Academia](/support/gym-planner).

> TODO — não foi possível confirmar pelo código, favor verificar: (1) não há um campo explícito de **recorde pessoal** — apenas o valor mais recente e a média pessoal são acompanhados. (2) A **edição/exclusão** de um resultado existente não foi encontrada na interface. (3) O formato/escopo exato do botão **Exportar relatório** não está confirmado. (4) Os limites de cor exatos de **assimetria** e a exata **transferência para o grupo de carga do Planejador de Academia** não foram totalmente confirmados a partir desta página.

## Relacionados

- [Perfil do Jogador](/support/player) — onde os testes de um jogador aparecem como instantâneo e evolução.
- [Planejador de Academia](/support/gym-planner) — os grupos de carga são construídos a partir dos resultados dos testes de força.
- [Elenco](/support/squad) — o plantel e a coorte da equipe que os comparativos utilizam.
