---
title: Lesões
slug: injuries
world: medical
app_page: Injuries.html
order: 1
summary: O registro de lesões — registre a lesão de um jogador, acompanhe-a pelas fases de reabilitação e libere-o de volta à disponibilidade, com a carga de lesões do elenco de relance.
---

## O que é

A tela de Lesões registra e acompanha as lesões dos jogadores desde o início, passando por fases estruturadas de reabilitação, até a liberação para retorno ao jogo — e mostra a carga de lesões do elenco através de KPIs e de um mapa corporal.

## Quando usar

Quando um jogador se lesiona (registre), conforme a reabilitação progride (avance as fases), e quando ele está pronto para retornar (libere/dê alta). É também o lugar para ler o panorama de lesões do elenco — quem está fora, dias perdidos, tempo até o retorno, taxa de relesão.

## Como funciona

**Alterne as abas.** As lesões são agrupadas em **Ativas** (fases iniciais), **Retornando** (fases posteriores, de retorno ao treino) e **Resolvidas** (liberadas). Um seletor de equipe delimita a lista.

**Filtre e leia.** Filtre por **gravidade** (leve / moderada / grave) e **região corporal**, ordene (por gravidade, data ou dias lesionado), e pesquise por jogador, tipo de lesão ou área. Uma faixa de KPIs mostra casos ativos, dias perdidos neste mês, tempo médio até o retorno, e taxa de relesão; um **mapa corporal** do elenco marca as regiões lesionadas.

**Registre uma lesão.** O formulário de registro captura os detalhes da lesão — o jogador, o tipo de lesão, a área corporal, o lado, a gravidade, a categoria (muscular, LCA, ligamentar, tendínea, óssea, outra) e a subclassificação, a data de início, um retorno esperado, o mecanismo e notas. Ao salvar, cria-se a lesão como **ativa** e constroem-se suas **fases de reabilitação** para a categoria.

**Acompanhe as fases.** Cada lesão percorre uma linha do tempo de fases (as fases dependem da categoria da lesão). Você abre uma fase para registrar seus critérios e datas reais, marca-a como concluída para avançar à próxima, ou a reverte com um motivo registrado.

**Libere/dê alta.** Quando o jogador retorna, **Dar alta** define uma data de retorno e notas opcionais: a lesão torna-se **liberada**, suas fases são marcadas como concluídas, a disponibilidade é devolvida a disponível a partir daquela data, e a comissão é notificada.

## Conceitos-chave

**Como uma lesão é acompanhada.** Uma lesão não é um simples sinalizador — é um registro que se move através de **fases de reabilitação** com base em sua categoria (por exemplo, lesões musculares carregam um grau BAMIC; categorias diferentes têm estruturas de fase diferentes). O app acompanha o status e as datas de cada fase; o conteúdo clínico dessas fases cabe à comissão médica aplicar — esta documentação descreve a ferramenta, não o protocolo.

**Relação com a disponibilidade.** Lesões e [Disponibilidade](/support/availability) permanecem sincronizadas, e as entradas manuais de disponibilidade são preservadas:

- Uma lesão ativa aparece na matriz de Disponibilidade como **lesionado** ao longo de seu intervalo de datas (a página de Disponibilidade preenche isso a partir de lesões ativas sem sobrescrever qualquer status que você definiu manualmente).
- Conforme a reabilitação avança para as fases de retorno ao treino, o status do jogador muda para **parcial**.
- Na alta, a disponibilidade é redefinida para **disponível** a partir da data de retorno em diante — mas apenas onde estava **lesionado**, de modo que qualquer outro status que você inseriu manualmente permanece intocado.

**O que "liberada" significa.** Liberar (dar alta) uma lesão registra uma data de retorno, muda a lesão para **liberada**, fecha suas fases, e devolve o jogador à disponibilidade a partir daquela data — além de notificar a comissão de que o jogador está disponível novamente. É a etapa de retorno à disponibilidade da ferramenta, não um julgamento clínico de aptidão (isso cabe à comissão médica).

**Quem pode ver.** Os registros de lesão são delimitados **por jogador/equipe**: qualquer membro da comissão com acesso à equipe daquele jogador pode ver a lesão — incluindo seu tipo, área e notas — porque as lesões orientam a disponibilidade e o planejamento. Isso é diferente do prontuário clínico profundo (histórico médico, medicações, triagens, documentos…), que é restrito a funções médicas — ver [Prontuário Clínico](/support/clinical-record).

## FAQ

**Registrar uma lesão bloqueia automaticamente a disponibilidade do jogador?** A matriz de Disponibilidade preenche uma lesão ativa como **lesionado** ao longo de seu intervalo sem sobrescrever suas entradas manuais; conforme a lesão atinge as fases de retorno, o status torna-se **parcial**, e a alta o devolve a **disponível**.

**Liberar uma lesão vai sobrescrever a disponibilidade que defini manualmente?** Não — a alta só muda de volta para disponível os dias que estavam marcados como **lesionado**. Outros status que você inseriu permanecem como estão.

**Um treinador não-médico pode ver os detalhes da lesão?** Sim — as lesões são visíveis para a comissão com acesso à equipe do jogador (elas orientam a disponibilidade). O prontuário clínico separado e mais profundo é exclusivo da área médica.

**O que acontece com as fases de reabilitação quando eu dou alta?** Todas são marcadas como concluídas, e a lesão move-se para a aba Resolvidas.

> TODO — não foi possível confirmar pelo código da própria página, favor verificar: a página de Lesões **não tem controle de função no lado do cliente** além da proteção geral do módulo; o acesso é imposto pelo banco de dados (a tabela de lesões é legível pela comissão delimitada à equipe do jogador, não restrita a funções médicas). Confirme se isso corresponde à política pretendida para a visibilidade de notas/diagnóstico de lesão.

## Relacionados

- [Disponibilidade](/support/availability) — onde uma lesão aparece como lesionado/parcial/disponível.
- [Fisioterapia](/support/physio) — tratamentos e adaptações para um jogador lesionado.
- [Reabilitação e Preventivos](/support/rehab) — os programas de reabilitação junto às fases.
- [Prontuário Clínico](/support/clinical-record) — o prontuário clínico restrito e mais profundo.
