---
title: Chat & Tarefas
slug: chat-tasks
world: overview
app_page: Chat & Tasks.html
order: 2
summary: Chat da equipe mais um quadro de tarefas — envie mensagens em canais e DMs, e gerencie tarefas atribuídas por pessoa ou por função, com prazos e lembretes.
---

## O que é

Chat & Tarefas combina o chat da equipe da comissão técnica (canais e mensagens diretas, com anexos de arquivos) e um quadro de tarefas onde as tarefas podem ser atribuídas a uma pessoa ou a uma função inteira, com prazos, prioridades e lembretes.

## Quando você usa

Para a coordenação do dia a dia: envie mensagens à comissão técnica, compartilhe um arquivo e acompanhe quem precisa fazer o quê — de tarefas de dia de jogo a acompanhamentos médicos — em um quadro simples.

## Como funciona

**Chat.** Um canal de equipe e mensagens diretas, com anexos de arquivos e prévias de links inline; documentos podem ser fixados em um canal. As mensagens carregam um tipo (texto simples ou arquivo, entre outros).

**Tarefas.** Um quadro com colunas — **Backlog, Em Progresso, Bloqueado/Revisão, Concluído** — e filtros (Todas, Minhas, Atrasadas, Vencem hoje, Dia de jogo, Médicas, Rotina). Crie uma tarefa com um título, descrição, **prazo**, **prioridade** (baixa/média/alta/urgente) e **categoria** (geral, dia de jogo, médica, rotina, evento), atribua-a, adicione **lembretes**, e mova-a pelo quadro. Concluir uma tarefa notifica o criador e os responsáveis.

## Conceitos-chave

**Por pessoa vs por função.** Uma tarefa pode ser atribuída de duas formas:

- **Por pessoa** — a um membro específico; apenas ele é notificado.
- **Por função** — a uma função (por exemplo, todos os fisioterapeutas); **todos com aquela função** na equipe são os responsáveis, e todos eles são notificados.

A atribuição baseada em função é o que permite delegar uma tarefa à "comissão médica" ou aos "coaches" sem nomear indivíduos — o app resolve a função para os membros atuais.

**Lembretes / alarmes.** Uma tarefa pode carregar um ou mais lembretes — predefinições como um dia ou uma hora antes, na data de vencimento, ou um horário personalizado. Cada lembrete é armazenado com seu horário de disparo e um marcador de enviado; a entrega é feita por um processo agendado (veja o TODO sobre o canal de entrega exato).

**Status e notificações.** As tarefas se movem Backlog → Em Progresso → Bloqueado/Revisão → Concluído. A transição para Concluído gera uma notificação para o criador e os responsáveis. Notificações de outros módulos (como uma adaptação de fisioterapia) também fluem por este sistema.

## FAQ

**Posso atribuir uma tarefa a uma função inteira?** Sim — atribua por função e todos com aquela função na equipe a recebem (e uma notificação); ou atribua por pessoa para um único membro.

**Como os lembretes disparam?** Você define os horários de lembrete na tarefa; um processo agendado os envia (o canal exato — push/e-mail/in-app — não foi confirmado nesta página).

**Posso anexar arquivos no chat?** Sim — anexos e prévias de links inline são suportados, e documentos podem ser fixados em um canal.

> TODO — não foi possível confirmar pelo código, favor verificar: (1) os tipos de mensagem **`task_ref`**, **`report_share`** e **`system`** estão declarados mas não parecem conectados à UI (apenas texto e arquivo são claramente usados). (2) O **mecanismo de entrega de lembretes** (qual canal realmente os envia) roda fora desta página e não foi confirmado. (3) O vínculo de uma tarefa a um **jogador/sessão/lesão** específico não é um campo explícito aqui (a categoria infere o contexto). (4) Uma ação de **compartilhar no chat** (por exemplo, compartilhar um relatório ou vídeo em uma mensagem) não foi encontrada conectada.

## Relacionados

- [Hub da Comissão Técnica](/support/hub) — exibe suas tarefas abertas.
- [Fisioterapia](/support/physio) — as adaptações de fisioterapia geram notificações neste sistema.
- [RPE](/support/rpe) — os lembretes para os jogadores são enviados de lá por WhatsApp, separados destes lembretes de tarefas.
