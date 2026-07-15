---
title: Planejador de Academia
slug: gym-planner
world: planning
app_page: Gym Planner.html
order: 6
summary: O construtor de sessões de força — aquecimento, pliometria, trabalho principal e adaptações individuais, com séries × repetições × carga, tonelagem e um rascunho por IA que só escolhe entre os seus próprios exercícios.
---

## O que é

O Planejador de Academia constrói uma sessão completa de força/academia, organizada em blocos ordenados — **Aquecimento e mobilidade, Pliometria e potência, Trabalho principal,** e **Adaptações individuais** — onde cada exercício é prescrito com séries × repetições, carga, descanso, tempo e RPE, e cada jogador pode receber substituições orientadas pela fisioterapia.

## Quando usar

Você o abre a partir do [Calendário](/support/calendar) clicando em uma sessão de academia para uma data; ele carrega a sessão dessa data (ou inicia uma nova), herdando o contexto de microciclo e MD-. Use-o para prescrever a sessão, atribuir os atletas, aplicar adaptações individuais e depois imprimir ou publicar.

## Como funciona

**Defina as informações da sessão.** Data, horário de início, duração, RPE esperado, local e um título. As pílulas de **Orientação** (seleção múltipla) etiquetam a ênfase — Ativação, Hipertrofia, Força máxima, Potência, RSI · reativo, Recuperação. Os campos herdados do Calendário (microciclo, dia de jogo, horário, duração, RPE) são marcados como originados do calendário — altere-os no Calendário para manter tudo sincronizado.

**Construa os quatro blocos.** Adicione exercícios a cada bloco a partir da Biblioteca de Academia ("Da biblioteca") ou como novas linhas:

- **Aquecimento e mobilidade** — exercício, séries, repetições/tempo, tempo, notas.
- **Pliometria e potência** — exercício, tipo de contato (Intensivo / Extensivo), séries × repetições, contatos, caixa/altura, descanso, notas.
- **Trabalho principal** — exercício, um alternador de **modo** por linha (**SR** séries×repetições ou **VBT** baseado em velocidade), séries × repetições, carga (kg ou %1RM), descanso, tempo e RPE.
- **Adaptações individuais** — substituições por jogador, pré-preenchidas a partir dos tratamentos de fisioterapia de hoje e editáveis, mais quaisquer que você adicionar: jogador, exercícios afetados, substituição e o motivo.

**Acompanhe os totais.** Uma barra ao vivo mostra as contagens de aquecimento, pliometria e trabalho principal, a **tonelagem** total (auto-somada a partir de séries × repetições × carga), o número de atletas, e as **AU Planejadas** (duração × RPE).

**Atribua os atletas.** Escolha jogadores do elenco (jogadores indisponíveis são identificados com selo), e use os **Grupos de carga** para dividir o elenco em faixas a partir dos resultados de seus testes de força e prescrever uma faixa de carga %RM por faixa.

**Gere com IA (opcional).** Descreva o objetivo (ex.: "força de isquiotibiais, ênfase excêntrica, 12 jogadores") e o assistente produz um **rascunho** editável que você revisa antes de aplicá-lo — ver Conceitos-chave para exatamente o que ele pode e não pode fazer.

**Salve, crie modelo, publique.** A sessão é salva automaticamente conforme você edita. Você pode salvá-la como um **modelo** (ou carregar um), **Imprimir** / **Exportar PDF** de uma folha de sessão, e **Publicá-la** para os jogadores.

## Conceitos-chave

**Os blocos.** Uma sessão de academia é uma sequência fixa: aquecimento/mobilidade → pliometria/potência → trabalho principal → adaptações individuais. A ordem espelha como a sessão é executada e como ela é impressa.

**Prescrição (séries × repetições × carga).** Cada linha de trabalho principal carrega séries × repetições, uma carga (kg, peso corporal, relativa "+N", ou um %1RM), descanso, e um tempo (ex.: "2-0-1" — excêntrico-pausa-concêntrico). A **tonelagem** é a soma de séries × repetições × carga entre as linhas válidas de trabalho principal — uma figura simples de volume-carga.

**SR vs VBT.** Cada exercício principal é prescrito como **SR** (séries × repetições, o padrão) ou **VBT** (treino baseado em velocidade, prescrevendo por velocidade da barra). O modo é salvo por exercício.

**Geração assistida por IA.** O assistente **só seleciona entre os exercícios existentes e etiquetados da Biblioteca de Academia do seu clube — ele nunca inventa exercícios.** Ele lê o seu objetivo mais o contexto opcional (contagem de jogadores, ênfase, e sinais suaves como o dia de jogo, a zona de [ACWR](glossary#acwr) da equipe e a tendência de prontidão) e retorna um **rascunho** — linhas de aquecimento, pliometria e trabalho principal construídas a partir de IDs de exercícios reais. Você confirma antes que ele substitua a sessão atual, e cada campo permanece totalmente editável depois. Se nada na biblioteca estiver etiquetado ainda, ele pede que você etiquete exercícios na Biblioteca de Academia primeiro.

**Grupos de carga.** Em vez de uma prescrição para todos, os Grupos de carga agrupam o elenco em faixas a partir dos valores de seus testes de força e mostram uma faixa de carga por faixa para um %RM escolhido — de modo que cada atleta levante em relação ao seu próprio teste.

**Como se relaciona com a carga.** A duração × RPE esperado da sessão fornece as **AU Planejadas** — a estimativa de carga interna do lado do planejamento. A carga interna entregue vem do session-RPE dos jogadores depois (ver [RPE](/support/rpe)), que por sua vez alimenta o [Monitor de Carga](/support/load-monitor).

## FAQ

**A IA inventa exercícios?** Não. Ela escolhe apenas entre os exercícios existentes da Biblioteca de Academia do seu clube (os etiquetados com grupo muscular/finalidade) e retorna um rascunho editável que você aprova — ela não pode adicionar exercícios que ainda não estejam na sua biblioteca.

**Ainda posso editar uma sessão gerada por IA?** Sim — o rascunho é totalmente editável, e ele só substitui a sessão atual depois que você confirmar.

**Como a tonelagem é calculada?** Ela soma séries × repetições × carga entre as linhas de trabalho principal que têm uma carga numérica; peso corporal e cargas relativas são ignorados.

**De onde vêm as adaptações individuais?** Dos tratamentos de fisioterapia de hoje para a equipe (pré-preenchidas) mais quaisquer que você adicionar manualmente — cada uma nomeia o jogador, os exercícios afetados, a substituição e o motivo.

**Por que alguns campos estão bloqueados?** Os campos herdados do Calendário (microciclo, dia de jogo, horário, duração, RPE) são editados lá para permanecerem sincronizados em todo o app.

## Relacionados

- [Calendário](/support/calendar) — onde a sessão de academia é agendada e seu contexto de MD- é definido.
- [Planejamento Diário](/support/daily-planning) — o equivalente de sessão de campo desta sessão de academia.
- [RPE](/support/rpe) — carga de s-RPE entregue versus as AU Planejadas aqui.
- [Monitor de Carga](/support/load-monitor) — onde essa carga se acumula no ACWR.
