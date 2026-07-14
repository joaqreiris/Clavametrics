---
title: Sala de Vídeo
slug: video-room
world: overview
app_page: Video Room.html
order: 3
summary: Uma biblioteca de vídeos que vincula (não hospeda) seus vídeos do Google Drive / Dropbox e conecta cada um a sessões, jogadores e jogos.
---

## O que é

A Sala de Vídeo é uma biblioteca de vídeos: ela **vincula** vídeos que ficam no Google Drive ou Dropbox do seu clube (ela não hospeda os arquivos) e conecta cada vídeo às sessões, jogadores e jogos aos quais ele se relaciona.

## Quando você usa

Para manter as filmagens de jogos e treinos organizadas e em contexto — adicionar um link do Drive/Dropbox, marcar a qual sessão, jogadores ou jogo ele pertence, e encontrá-lo mais tarde na biblioteca ou a partir dessas páginas vinculadas.

## Como funciona

**Adicione um vídeo.** Cole um link do Google Drive ou Dropbox (um arquivo ou uma pasta) e dê um título; o provedor e o tipo são detectados automaticamente, e uma miniatura opcional pode ser definida. O ClavaMetrics armazena o **link e seus metadados** — o arquivo permanece no seu Drive/Dropbox.

**Navegue pela biblioteca.** Uma grade de cartões com busca por título e filtros por tipo de vínculo (sessão / jogador / jogo / não vinculado), data e equipe.

**Abra um vídeo.** A visualização de detalhe incorpora o player do Drive/Dropbox, contém **observações** da equipe, mostra os detalhes da fonte, e permite **vincular** o vídeo a sessões, jogadores e jogos. Esses vínculos são de mão dupla — o vídeo então também aparece em cada sessão, perfil de jogador e jogo vinculado.

**Compartilhe.** Você pode **copiar o link** (a URL subjacente do Drive/Dropbox) ou **abri-lo** no provedor.

## Conceitos-chave

**Uma biblioteca de links, não um host.** O modelo central é que o ClavaMetrics mantém um **link** para cada vídeo mais seu contexto, não o arquivo de vídeo. O acesso à filmagem real é governado pelo compartilhamento do seu Google Drive / Dropbox; o ClavaMetrics gerencia a organização em torno dele.

**Vinculação de contexto.** O verdadeiro poder de organização é vincular um vídeo a uma ou mais **sessões, jogadores e jogos**. Como os vínculos são bidirecionais, o mesmo clipe aparece onde quer que seja relevante — na sessão, no jogador, no jogo — sem duplicar nada.

## FAQ

**O ClavaMetrics armazena meus vídeos?** Não — o arquivo permanece no seu Google Drive ou Dropbox; a Sala de Vídeo armazena o link e o contexto (a qual sessão/jogadores/jogo ele pertence).

**Como compartilho um vídeo?** Copie seu link (a URL do Drive/Dropbox) ou abra-o no provedor. Compartilhamento/permissões são governados pelo seu Drive/Dropbox.

**Como encontro os vídeos de um jogador?** Vincule vídeos ao jogador; eles então aparecem no contexto desse jogador. Você também pode filtrar a biblioteca por tipo de vínculo.

> TODO — importante, resumo vs. código: o módulo foi descrito como **"clipes · marcação · compartilhar"**, mas a página **não** implementa extração de clipes, marcação com carimbo de tempo, ou marcadores de evento dentro de um vídeo — ela faz vinculação **no nível do vídeo** a sessões/jogadores/jogos apenas. Também **não** há compartilhamento-no-chat ou fluxo interno de link de compartilhamento (apenas copiar a URL do Drive/Dropbox ou abrir no provedor). Confirme se clipe/marcação e compartilhamento-no-chat são recursos planejados, e reformule qualquer texto de "clipes/marcação" no aplicativo que sugira que eles existem hoje.

## Relacionados

- [Player Profile](/support/player) — onde os vídeos vinculados de um jogador aparecem.
- [Match Reports](/support/match-reports) — o jogo ao qual um vídeo pode ser vinculado.
- [Chat & Tasks](/support/chat-tasks) — chat da equipe (o compartilhamento de vídeo no chat ainda não está conectado — veja o TODO).
