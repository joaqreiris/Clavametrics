---
title: Central da Comissão
slug: hub
world: overview
app_page: Hub.html
order: 1
summary: A página inicial do app — uma visão geral diária dos KPIs do elenco, cartões de acesso rápido aos módulos, um feed de atividade recente e suas tarefas.
---

## O que é

A Central da Comissão é a tela inicial do app: uma visão geral diária que o recebe com o contexto de hoje, os KPIs principais do elenco, cartões de acesso rápido para cada módulo, um feed de atividade recente e suas tarefas.

## Quando usar

Todos os dias, logo no início — é a página de destino após o login. Use-a para ler o elenco de relance (disponibilidade, carga, bem-estar, lesões), acessar qualquer módulo, e ver o que aconteceu recentemente e o que está atribuído a você.

## Como funciona

**A saudação.** Um cabeçalho nomeia o contexto de hoje — o microciclo atual e o dia de jogo, a sessão de hoje (horário e local), e pílulas de disponibilidade (disponível / parcial / fora).

**Cartões de KPI.** Quatro cartões principais aparecem por padrão — **Tamanho do elenco, ACWR médio, Média de bem-estar, Lesões ativas** — cada um com um minigráfico de tendência. Você pode **personalizar** quais KPIs aparecem (até quatro) a partir de um conjunto mais amplo que inclui Clima, Próxima partida, Carga desta semana, Bem-estar hoje, Disponíveis hoje, Sessões desta semana e Retorno ao jogo; a escolha é salva no seu perfil.

**Cartões de módulo.** Uma grade de cartões leva a cada módulo (Planejador, Biblioteca de Exercícios, Planejamento Diário, Microciclos, Disponibilidade, Elenco, Relatórios de Partida, Bem-estar, RPE, Monitor de Carga, Análise de GPS, Lesões, Nutrição, Sala de Vídeo), cada um com um status ao vivo no rodapé (ex.: "3 precisam de status", "{n} enviados hoje", "sessões pendentes").

**Atividade recente e tarefas.** Um feed lista a atividade mais recente do clube, e um painel de tarefas mostra suas tarefas abertas (ver [Chat e Tarefas](/support/chat-tasks)).

## Conceitos-chave

**O que os cartões de KPI agregam.** Cada cartão principal é uma consolidação do elenco a partir dos dados de seu módulo: **Tamanho do elenco** conta os jogadores ativos; **ACWR médio** é a média das razões carga aguda:crônica dos jogadores (o modelo configurado pelo clube — ver [Monitor de Carga](/support/load-monitor)); **Média de bem-estar** faz a média dos check-ins de hoje (ver [Bem-estar](/support/wellness)); **Lesões ativas** conta as lesões abertas (ver [Lesões](/support/injuries)). Os cartões opcionais puxam da mesma forma — próxima partida do calendário, carga-desta-semana a partir da carga de RPE das sessões, contagens de disponibilidade a partir dos registros de disponibilidade.

**O feed de atividade recente.** O feed mostra os eventos mais recentes do clube, cada um com quem o fez e quando. Os tipos de evento incluem: uma **sessão publicada**, uma **lesão registrada** ou **liberada**, uma **adaptação de fisioterapia** exigida, **dados de GPS importados**, um envio de **bem-estar** ou **RPE**, uma **tarefa criada** ou **concluída**, e um **membro ingressou**. Uma importação de GPS aparece como um item "Dados de GPS importados de {session}" referenciando a sessão à qual pertence.

**O que "pendente" significa aqui.** Dois rodapés de módulo dizem "pendente", e eles significam coisas diferentes — nenhum é uma figura de bem-estar:

- O "sessões pendentes" do cartão de **GPS** conta as sessões recentes que ainda não têm uma importação de GPS.
- O cartão de **RPE** mostra quantos RPE foram **enviados hoje** — é uma contagem de *enviados*, não uma contagem de quem ainda está faltando. (A ideia de "sessões aguardando RPE" fica nas visões de [RPE](/support/rpe) e de planejamento, não na Central.)

## FAQ

**Posso escolher quais KPIs aparecem?** Sim — personalize a faixa de KPIs (até quatro), e a escolha fica salva no seu perfil.

**O feed de atividade mostra as importações de GPS uma por sessão?** Cada importação registra uma atividade "Dados de GPS importados" referenciando sua sessão; no feed de atividade recente, as importações do mesmo dia são agrupadas em uma única linha.

**O número de RPE na Central são os jogadores que ainda devem um RPE?** Não — é quantos foram enviados hoje, não quem está faltando.

**De onde vem o ACWR médio?** É a média do elenco dos ACWRs dos jogadores usando o modelo configurado do clube — o mesmo motor do [Monitor de Carga](/support/load-monitor).

## Relacionados

- [Monitor de Carga](/support/load-monitor) — o ACWR por trás do cartão de ACWR médio.
- [Bem-estar](/support/wellness) — os check-ins por trás do cartão de bem-estar.
- [Lesões](/support/injuries) — a contagem de lesões ativas e os eventos do feed de lesões.
- [Chat e Tarefas](/support/chat-tasks) — as tarefas mostradas na central.
