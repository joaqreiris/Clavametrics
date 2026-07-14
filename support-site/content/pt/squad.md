---
title: Elenco
slug: squad
world: squad
app_page: Squad.html
order: 1
summary: O hub de elenco para uma equipe ou categoria — jogadores agrupados por posição, com perfis, ações em massa, importação/exportação CSV e um construtor de escalação.
---

## O que é

Elenco é o hub de plantel para uma equipe ou categoria: cada jogador, agrupado por posição, com seus detalhes-chave, links de perfil, e as ferramentas para adicionar, editar, importar, organizar e montar escalações a partir deles.

## Quando você usa

Use-o para configurar e manter o elenco — adicionar ou importar jogadores, manter posições e detalhes atualizados, mover jogadores entre categorias — e para preparar um jogo com o construtor de escalação. A partir daqui você abre o perfil completo ou dossiê de qualquer jogador.

## Como funciona

**Encontre jogadores.** Busque por nome, número da camisa ou nacionalidade; refine por posição com as pílulas — **All, GK, CB, FB, MF, WG, ST** (cada uma com uma contagem ao vivo) — e restrinja a uma categoria com o seletor de equipe. Na lista, você pode ordenar por jogador, idade ou data de ingresso.

**Alterne visualizações.** Quatro visualizações apresentam o mesmo elenco de forma diferente:

- **Lista** — uma tabela ordenável: número, jogador (foto, nome, data de nascimento), posição, idade, pé, altura/peso, função (equipe) e um menu de ações. As linhas são agrupadas por posição.
- **Cartões** — uma grade de fotos com número da camisa, nome, posição, idade e pé.
- **Gráfico de profundidade** — jogadores empilhados sob seu grupo de posição.
- **Escalação** — um campo com um seletor de formação (4-3-3, 4-4-2, 4-2-3-1, 3-5-2 e mais), um seletor de jogo e escudo do rival, que você pode salvar, exportar e imprimir.

**Gerencie um jogador.** Adicione um jogador com **Adicionar jogador**, ou abra o menu de um jogador para **Editar** (foto, nome, número, posições primária e secundárias, data de nascimento, nacionalidade, altura, peso, pé dominante, participações em equipes), **Ver perfil** (abre a página do jogador) ou **Exportar dossiê** (abre o dossiê imprimível).

**Trabalhe em massa.** Selecione jogadores com suas caixas de seleção para revelar ações em massa: **Arquivar** (ocultar de forma reversível), **Exportar** (CSV da seleção), **Mover para equipe** — com dois modos, *Adicionar à equipe* (manter participações existentes) ou *Mover para cá* (substituí-las) — e **Alterar posição/status** em toda a seleção.

**Importar / exportar.** **Importar CSV** pré-visualiza as linhas antes de criar os jogadores (colunas: primeiro nome, sobrenome, número, posição, data de nascimento, nacionalidade, altura, peso, pé dominante, com aliases de posição normalizados). **Exportar CSV** baixa o elenco (ou a seleção atual).

## Conceitos-chave

**Posições e grupos.** O aplicativo normaliza muitos códigos de posição (e aliases em espanhol como PORTERO, DEFENSA, EXTREMO, DELANTERO) em códigos canônicos e os agrupa para exibição e filtragem:

| Grupo | Pílula de filtro | Códigos de exemplo |
| --- | --- | --- |
| Goleiros | GK | GK |
| Defensores | CB / FB | CB, LB, RB, WB, LWB, RWB |
| Meio-campistas | MF | CDM, CM, CAM, DM, AM |
| Pontas | WG | LM, RM, LW, RW |
| Atacantes | ST | SS, CF, ST, "9" |

Um jogador tem uma posição **primária** (usada para agrupamento e o distintivo colorido) e posições **secundárias** opcionais ("também joga").

**Participação em equipe / categoria.** Um jogador pertence a uma **equipe primária** (mostrada na coluna Função) e pode ter participações adicionais — para que um atleta possa aparecer, digamos, tanto no Sub-23 quanto na equipe principal. Os modos *Mover para equipe* decidem se uma mudança adiciona uma participação ou substitui todas elas.

**Status do jogador.** No nível do elenco, um jogador carrega um status — disponível, lesionado, modificado ou indisponível. A aptidão diária para treinar é gerenciada em [Availability](/support/availability); o status no nível do elenco é o indicador no nível do plantel.

**Arquivamento.** Remover um jogador o arquiva (exclusão suave) em vez de excluí-lo — ele sai das visualizações normais, mas pode ser restaurado a partir do filtro de arquivados.

## FAQ

**Como adiciono um elenco inteiro de uma vez?** Use Importar CSV — ele pré-visualiza as linhas analisadas (nome, número, posição, data de nascimento, nacionalidade, altura, peso, pé) antes de criar os jogadores, e normaliza os aliases de posição.

**Um jogador pode estar em duas categorias?** Sim. Os jogadores suportam múltiplas participações em equipes com uma marcada como primária; use *Mover para equipe → Adicionar à equipe* para adicionar uma categoria sem remover as outras.

**Qual é a diferença entre arquivar e excluir?** Arquivar oculta o jogador, mas é reversível; não há exclusão definitiva no fluxo normal — jogadores arquivados podem ser restaurados.

**Onde vejo o histórico completo de um jogador?** Abra **Ver perfil** para a página do jogador, ou **Exportar dossiê** para o resumo imprimível.

> TODO — não foi possível confirmar pelo código, por favor verifique: (1) a coluna **Ingressou** está presente, mas atualmente renderiza "—" para todos, então pode ainda não estar conectada a uma data. (2) O status de jogador **"modificado"** aparece no formulário, mas está desabilitado ali — seu significado exato e como é definido não fica claro apenas pela página.

## Relacionados

- [Availability](/support/availability) — aptidão diária para treinar desses jogadores.
- [Load Monitor](/support/load-monitor) — ACWR de todo o elenco construído a partir do mesmo plantel.
- [Calendar](/support/calendar) — jogos para os quais o construtor de escalação prepara.
