---
title: RPE
slug: rpe
world: performance
app_page: RPE.html
order: 3
summary: O monitor de session-RPE — colete a percepção de esforço de cada jogador após uma sessão, transforme em carga s-RPE (RPE × duração) e alimente o ACWR.
---

## O que é

A página RPE é o monitor de session-RPE: ela coleta a **taxa de percepção de esforço** de cada jogador após uma sessão, calcula a carga da sessão (**[s-RPE](glossary#s-rpe) = RPE × duration**), e mostra quem respondeu, quem está faltando e quão difícil o elenco achou a sessão.

## Quando você usa

Logo após uma sessão. Os jogadores enviam seu RPE de um celular (sem necessidade de login) enquanto está fresco; a equipe acompanha as respostas chegando, cobra as que ainda faltam e revisa a carga interna do elenco. Esses valores de s-RPE são o que o [Load Monitor](/support/load-monitor) transforma em [ACWR](glossary#acwr).

## Como funciona

**Escolha a sessão.** Escolha uma sessão no seletor (por padrão, a sessão de hoje quando há exatamente uma). Se não houver sessão hoje, ele informa; se houver várias, você escolhe qual.

**Leia o resumo.** Quatro números ficam no topo: **RPE enviados** (respondidos / elenco), **s-RPE médio**, contagem de **RPE alto (≥8)** e envios **atrasados / não vinculados**.

**Trabalhe as duas abas.** **Respondidos** lista os jogadores que enviaram, ordenados do maior RPE primeiro; **Pendentes** lista os que não enviaram, com uma ação de um toque **Lembrar quem falta** via WhatsApp. Cada cartão de jogador pode ser exibido como uma linha **Numérica** ou um **Medidor** (um mostrador de 0–10 com zonas verde/âmbar/vermelha), e mostra o valor de RPE, a carga da sessão (s-RPE, em au), a duração, este jogador versus a média do elenco, quaisquer áreas doloridas relatadas, um comentário e o horário do envio.

**Colete dos jogadores.** Gere um **link de compartilhamento tokenizado** (escolha a equipe, opcionalmente anexe-o a uma sessão), depois copie-o ou envie-o via WhatsApp. Os jogadores o abrem, avaliam a sessão e enviam — sem necessidade de conta.

**Trate envios atrasados / não vinculados.** RPE enviado sem uma sessão anexada aparece em um grupo **Atrasado — precisa de uma sessão**; atribua cada um à sessão correta para que sua carga possa ser calculada, ou use **Auto-vincular** para anexar os envios soltos de hoje às sessões de hoje. A página também se atualiza sozinha para que novas respostas apareçam sem recarregar.

## Conceitos-chave

**RPE (taxa de percepção de esforço).** A avaliação subjetiva de um jogador sobre quão difícil a sessão pareceu, em uma escala de **1–10** — a contraparte de carga interna à carga externa de GPS. É melhor capturada logo após a sessão enquanto a impressão está fresca.

**s-RPE (carga da sessão).** O número central: **s-RPE = RPE × duração da sessão em minutos**, em unidades arbitrárias (au). Uma sessão de 60 minutos avaliada em 7 é 420 au. Ele combina *quão difícil* com *quão longo* em um único número de carga interna por jogador por sessão.

**Faixas de intensidade.** O RPE é codificado por cores: verde para uma sessão leve (≤ 4), âmbar para moderada (5–7) e vermelho para difícil (≥ 8). A contagem de **RPE alto (≥8)** destaca os jogadores que acharam a sessão mais difícil.

**Carga interna vs. externa.** O RPE é carga *interna* — a percepção do atleta. O GPS (veja [GPS Analysis](/support/gps-analysis)) é carga *externa* — distância, velocidade, acelerações. Ler ambos juntos dá o quadro mais completo; um pode estar alto enquanto o outro não.

**Como ele alimenta o ACWR.** O s-RPE de cada sessão é um valor de carga interna diária. O [Load Monitor](/support/load-monitor) soma esses valores em janelas aguda e crônica e calcula a razão aguda:crônica — então uma coleta de RPE completa e oportuna aqui é o que torna o ACWR significativo.

## FAQ

**Que escala os jogadores usam?** 1–10. A carga é então RPE × a duração da sessão em minutos.

**Como a carga da sessão é calculada?** s-RPE = RPE × duração (minutos), exibida em unidades arbitrárias (au) em cada cartão de jogador.

**Como os jogadores enviam sem uma conta?** Através de um link de compartilhamento tokenizado que você gera e envia (copiar ou WhatsApp); eles avaliam a sessão e enviam — sem login.

**Um envio não está contando para a carga — por quê?** Provavelmente está não vinculado (sem sessão anexada). Atribua-o a uma sessão a partir do grupo "Atrasado — precisa de uma sessão", ou use Auto-vincular.

**Por que um RPE completo importa?** Porque o Load Monitor constrói o ACWR a partir desses valores de s-RPE — respostas faltantes deixam lacunas no histórico de carga de um jogador.

> TODO — não foi possível confirmar pelo código, por favor verifique: (1) um controle de **tendência / histórico de carga** por jogador aparece no cartão, mas está rotulado como em-breve. (2) Nenhum botão de **exportação** dedicado foi encontrado nesta página (coleta e revisão são o foco; totais semanais e ACWR ficam no Load Monitor).

## Relacionados

- [Load Monitor](/support/load-monitor) — transforma esses valores de s-RPE em ACWR.
- [GPS Analysis](/support/gps-analysis) — carga externa, ao lado desta carga interna.
- [Daily Planning](/support/daily-planning) — os AU planejados que você define antes da sessão, versus o s-RPE relatado depois.
