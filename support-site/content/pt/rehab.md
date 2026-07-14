---
title: Reabilitação & Preventivos
slug: rehab
world: medical
app_page: Rehab & Preventives.html
order: 5
summary: O hub para planos de reabilitação e programas preventivos — acompanhe a fase de cada jogador, responsáveis, estimativa de retorno ao jogo e a sessão de hoje.
---

## O que é

Reabilitação & Preventivos é o hub de acompanhamento de **planos de reabilitação** (programas de retorno ao jogo pós-lesão) e **programas preventivos** (redução de risco de lesão), mostrando a fase de cada plano, responsáveis, estimativa de retorno ao jogo e a sessão de hoje em todo o elenco.

## Quando você usa

Para supervisionar quem está em reabilitação e quem está em um programa preventivo — monitorar o progresso, identificar quem está perto do retorno ou bloqueado, e abrir um plano para editar suas fases, sessões e critérios de progressão. Você cria planos aqui (a partir de uma lesão, uma avaliação, um alerta de GPS, ou do zero) e os gerencia até a liberação.

## Como funciona

**Leia as duas seções.** **Reabilitação & retorno ao jogo** lista os planos vinculados a uma lesão (atleta, plano, diagnóstico & fase, estimativa de RTP, responsáveis, sessão de hoje, status); **Preventivo** lista os programas de redução de risco (com uma métrica de risco e semana do programa em vez de um diagnóstico e RTP). Os filtros — Todos, Reabilitação, Preventivo, Perto do RTP (≤7 dias), Bloqueado — aplicam-se a ambos. Uma faixa de KPIs mostra a contagem em reabilitação, perto do RTP, bloqueados hoje e liberados neste mês.

**Crie um plano.** **Novo plano** → escolha Reabilitação ou Preventivo → o Rehab Planner abre: atribua um jogador, vincule uma lesão (reabilitação), defina a fase, escolha exercícios da biblioteca, defina datas e status, e atribua responsáveis (fisioterapeuta, S&C, treinador).

**Monte e acompanhe.** Dentro de um plano, você organiza as sessões dia a dia a partir de blocos (aquecimento, mobilidade, ativação, força, pliometria, em campo, condicionamento, avaliação, …), cada um com sua duração, exercícios e carga. As fases de reabilitação carregam **critérios de progressão** — as portas a serem cumpridas antes de avançar. O status se move entre **no caminho certo → perto do RTP → liberado**, ou **bloqueado**.

**Gerencie.** Altere o status, vincule uma lesão, atribua responsáveis, exporte para CSV, e veja o **histórico** de planos liberados e arquivados.

## Conceitos-chave

**Fases, portas e status.** Um plano de reabilitação é baseado em fases: cada fase tem critérios (portas) a cumprir antes de avançar, e o plano carrega um status (no caminho certo, perto do RTP, bloqueado, liberado, arquivado). O conteúdo clínico dessas fases e portas cabe à comissão técnica/de desempenho definir — esta documentação descreve a ferramenta de acompanhamento, não os critérios a aplicar.

**Relação com o plano individual.** Os planos de reabilitação e preventivos e o plano de treino individual do jogador **compartilham a mesma biblioteca de exercícios e sistema de blocos**, mas são gerenciados como **planos separados** — o aplicativo não copia automaticamente um plano de reabilitação para um plano individual (nenhum vínculo automático foi encontrado no código). Na prática, a equipe os mantém em paralelo; um foco de retorno ao jogo existe no lado do plano individual, mas os dois não são sincronizados automaticamente.

**Retorno à disponibilidade — o que faz e o que não faz.** Concluir um plano de reabilitação é **apenas acompanhamento**: marcar um plano como **liberado** o remove das listas ativas e o arquiva no histórico. Isso, por si só, **não** altera o status da lesão vinculada nem a disponibilidade do jogador. Retornar o jogador à disponibilidade é feito na página [Injuries](/support/injuries) (alta) e refletido em [Availability](/support/availability) — o plano de reabilitação e essas etapas são separados. (Veja o TODO.)

**De onde vêm os planos.** Um plano pode ser criado a partir de uma lesão ativa, de um achado de avaliação, de um alerta de carga/assimetria de GPS, ou manualmente — a origem é registrada no plano.

## FAQ

**Liberar um plano de reabilitação torna o jogador disponível novamente?** Não — apenas arquiva o plano. Liberar a **lesão** (na página Injuries) é o que retorna a disponibilidade; o plano de reabilitação é acompanhado separadamente.

**Um plano de reabilitação é o mesmo que o plano individual do jogador?** Não. Eles compartilham a biblioteca de exercícios e o construtor de blocos, mas são planos separados sem vínculo automático de dados — você gerencia cada um por conta própria.

**Quem é responsável por um plano?** Cada plano tem um ou mais responsáveis com uma função — fisioterapeuta, S&C ou treinador.

**Como inicio um plano a partir de uma lesão?** Crie um plano do tipo Reabilitação e vincule a lesão ativa; a partir daí você monta suas fases e sessões.

> TODO — por favor confirme (comportamento e acesso): (1) liberar um plano de reabilitação **não** cascateia para o status da lesão ou da disponibilidade — isso é uma etapa manual nas páginas Injuries/Availability; confirme se isso é intencional. (2) Não há **vínculo automático** entre um plano de reabilitação e o plano de treino individual (apenas biblioteca compartilhada) — confirme se um auto-preenchimento é esperado. (3) O acesso é via o controle geral do módulo + escopo por equipe + RLS do clube; ao contrário do Clinical Record, **nenhum controle explícito exclusivo para médicos** foi confirmado nesta página, e os planos de reabilitação têm escopo por equipe (não restritos a funções médicas) — confirme a visibilidade pretendida.

## Relacionados

- [Injuries](/support/injuries) — a lesão em torno da qual um plano de reabilitação é construído, e onde a liberação/disponibilidade acontecem.
- [Physio](/support/physio) — tratamentos registrados junto a um programa de reabilitação.
- [Availability](/support/availability) — onde o retorno do jogador ao treino é refletido.
- [Player Profile](/support/player) — o resumo de lesões/disponibilidade do jogador.
