---
title: Disponibilidade
slug: availability
world: squad
app_page: Availability.html
order: 2
summary: Uma matriz de jogadores por dia de quem pode treinar — disponível, parcial, lesionado, doente ou ausente — que alimenta as contagens de saúde do elenco lidas pelo resto da plataforma.
---

## O que é

Disponibilidade é uma **matriz de jogadores × dias** que acompanha o status de cada membro do elenco — disponível, parcial, lesionado, doente ou ausente — para cada dia em um intervalo de datas. É o único lugar que responde "quem pode treinar hoje?" e alimenta as contagens de saúde do elenco (por exemplo, "22 disponíveis, 3 parciais, 2 fora") exibidas em outros lugares.

## Quando você usa

Atualize-a como parte da rotina diária — antes de cada sessão ou jogo — para que o panorama do elenco esteja atual: marque quem treina totalmente, quem está em trabalho modificado, quem está fora por lesão ou doença, e quem está ausente a serviço da seleção nacional. Após um jogo você pode registrar os minutos jogados; ao longo da semana a visão de Estatísticas mostra as tendências de disponibilidade.

## Como funciona

**Escolha uma visão.** Um controle segmentado alterna entre **Matriz** (a grade padrão de jogadores × dias) e **Estatísticas** (uma linha de tendência, mapa de calor no calendário, ranking de jogadores e uma divisão por equipe).

**Defina a janela de datas.** O intervalo assume por padrão o microciclo ativo (ou a segunda–domingo atual) e pode ser alterado com predefinições — MC Atual, Últimos 7 / 14 / 30 dias, ou um intervalo personalizado — e avançado/retrocedido passo a passo. Cada coluna mostra seu rótulo **MD-** (por exemplo, MD-2, Jogo, Folga); o dia de hoje é destacado, os dias de jogo são marcados em vermelho, e as folgas planejadas são listradas e somente leitura.

**Filtre as linhas.** Pílulas de posição — **Todos, GK, CB, FB, MF, WG, ST** — restringem a matriz a um grupo de posição, cada uma mostrando sua contagem.

**Edite os status.** Selecione uma ou várias células — clique, arraste para selecionar um intervalo, ou Cmd/Ctrl+A para selecionar todas as células editáveis — e uma barra de edição em lote aparece. Defina a seleção como **Disponível, Parcial, Lesão, Doença** ou **Seleção nac.**, use **Jogo · 90′** para registrar um jogo completo, ou **Limpar** para remover os registros. Datas futuras, folgas e fases que não contam ficam bloqueadas. As alterações são salvas imediatamente e atualizam ao vivo para todos via sincronização em tempo real.

**Exporte.** A matriz pode ser exportada para CSV.

## Conceitos-chave

**O conjunto de status.** A Disponibilidade usa um conjunto fixo de status, cada um com sua própria cor:

| Status | Rótulo | Cor | Significado |
| --- | --- | --- | --- |
| available | Disponível | verde | Totalmente disponível — capacidade completa de treino/jogo. |
| partial / limited | Parcial / adaptado | âmbar | Disponível mas em trabalho modificado (intensidade reduzida, alguns exercícios ou ações restritos). |
| injured / unavailable | Lesão | vermelho | Não pode participar devido a uma lesão ativa. |
| sick | Doença | violeta | Indisponível devido a doença. |
| away | Seleção nac. | azul | Ausente a serviço da seleção internacional / nacional. |
| absent | Ausente | cinza | Usado em registros de jogo — presente mas com zero minutos jogados. |

Uma célula de jogo também pode carregar **minutos jogados** (por exemplo, "90′"), armazenada como disponível com um valor de minutos.

**De onde vem o status.** A entrada manual da comissão técnica é a fonte da verdade, mas dois preenchimentos automáticos a semeiam sem nunca sobrescrever uma entrada manual:

- **A partir das Lesões** — jogadores com uma lesão ativa são preenchidos automaticamente como **lesionados** ao longo do intervalo de datas da lesão (o módulo de Lesões é onde as lesões são registradas).
- **Padrão de hoje** — qualquer jogador sem registro para hoje assume como padrão **disponível** (ou **lesionado** se tiver uma lesão ativa).

Então a prioridade é: entrada manual primeiro, depois o preenchimento automático de lesão, depois o padrão de hoje.

**Disponibilidade vs lesão vs carga.** A Disponibilidade é uma decisão *diária de aptidão para treinar*. Uma **lesão** é a condição médica subjacente com um início e um retorno esperado — a disponibilidade é efetivamente a projeção dia a dia disso. **Carga** e **bem-estar** (veja [Monitor de Carga](/support/load-monitor) e RPE/Bem-estar) são insumos de prontidão que informam a decisão mas são acompanhados separadamente.

**Parcial / adaptado.** "Parcial" significa que o jogador treina mas em um programa modificado — intensidade mais leve ou restrições específicas. Ele ainda conta para o elenco treinável, e é por isso que o resumo do elenco distingue "disponível" de "parcial" de "fora".

**Dias contáveis.** Os KPIs de saúde do elenco só se aplicam a dias contáveis — um dia com uma sessão ou jogo planejado, não uma folga, e dentro de uma fase ativa da temporada. Em um dia que não conta, a faixa de KPI é substituída por um estado vazio.

## FAQ

**Preciso definir cada jogador todos os dias?** Não. Os jogadores assumem como padrão disponível para hoje, e as lesões ativas preenchem automaticamente como lesionado ao longo do seu intervalo. Você basicamente sobrescreve as exceções — parcial, doente, ausente — e essas entradas manuais nunca são sobrescritas pelos preenchimentos automáticos.

**Qual é a diferença entre "parcial" e "lesionado"?** Parcial significa disponível em treino modificado (conta para o elenco treinável); lesionado significa fora. São âmbar e vermelho, respectivamente.

**Como as contagens "22 disponíveis / 3 parciais / 2 fora" em outros lugares obtêm seus números?** A partir desses status no dado dia — disponível e parcial contam como treináveis; lesionado, doente e ausente contam como fora.

**Dois membros podem editar ao mesmo tempo?** Sim — as atualizações são transmitidas ao vivo, então todos veem as mudanças sem atualizar a página.

## Relacionados

- [Elenco](/support/squad) — o plantel que popula as linhas da matriz.
- [Calendário](/support/calendar) — dias de jogo e folgas mostrados no cabeçalho.
- [Planejamento Diário](/support/daily-planning) — os mesmos status guiam o card de elenco da sessão.
