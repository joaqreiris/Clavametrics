---
title: Dossiê
slug: dossier
world: squad
app_page: Dossier.html
order: 5
summary: O gerador configurável de dossiê do jogador — ative blocos, escolha quais testes aparecem, compare com o elenco, salve templates e exporte um PDF com a marca do clube.
---

## O que é

O Dossiê é um gerador configurável de relatório por jogador: você escolhe quais blocos e testes aparecem, ele compara o jogador com o elenco, e renderiza um dossiê de uma página com a marca do clube que você pode imprimir ou exportar para PDF.

## Quando você usa

Quando você precisa de um instantâneo compartilhável de um jogador — para uma revisão, uma nota de scouting, ou um perfil impresso. Você chega a ele a partir do [Elenco](/support/squad) ou do [Perfil do Jogador](/support/player) via "Exportar dossiê".

## Como funciona

**Escolha o jogador e configure.** Abra o dossiê de um jogador e ligue ou desligue blocos, escolha quais testes mostrar, e escolha quais métricas colocar em tendência. A prévia re-renderiza ao vivo enquanto você altera a configuração.

**Exporte.** Imprimir ou **Exportar PDF** produz a folha com a marca do clube (escudo do clube, identidade do jogador, KPIs e os blocos habilitados). O dossiê pode ser renderizado em inglês, espanhol ou português.

## Conceitos-chave

**Blocos configuráveis.** O dossiê é construído a partir de blocos ativáveis: **Técnico** (um radar de atributos subjetivos /10), **Atlético** (barras de percentil para os testes selecionados), **Produção** (metas da temporada, assistências, avaliações), **Scouting** (um resumo editável em texto livre) e **Evolução** (sparklines de tendência para as métricas que você escolhe). Cada bloco pode ser mostrado ou ocultado.

**Testes selecionáveis.** No bloco Atlético você escolhe exatamente quais testes físicos aparecem, de um catálogo agrupado como Saltos & potência (CMJ, squat jump, drop jump, salto horizontal), Velocidade & agilidade (sprint, mudança de direção 505, Illinois) e Resistência (30-15 IFT, Yo-Yo IR1, Cooper). Cada um mostra o valor mais recente do jogador e, quando possível, um percentil.

**Percentis vs a coorte do elenco.** O percentil de um teste é calculado contra a **coorte da equipe** do jogador — os outros jogadores da mesma equipe com um valor para aquele teste. Requer **pelo menos quatro pares** para ser mostrado; abaixo disso a barra recai para um preenchimento neutro em vez de um percentil, porque um percentil com menos de quatro pares não é significativo. Essa é a mesma regra de coorte/mínimo de pares que o módulo [Avaliações](/support/evaluations) usa.

**Templates salvos.** Uma configuração de dossiê — quais blocos, quais testes, quais tendências — pode ser **salva como um template** (para todo o clube) e recarregada, para que você possa manter, digamos, uma predefinição de "Dossiê físico" e uma de "Dossiê de scouting" e aplicar qualquer uma com um clique.

**O resumo de scouting.** O bloco de scouting é texto livre que você edita inline; ele é impresso com o que você escrever e só é armazenado no jogador quando você o salva explicitamente.

## FAQ

**Posso escolher o que vai no dossiê?** Sim — ative os blocos, escolha quais testes aparecem no bloco Atlético, e escolha as métricas de tendência. A prévia atualiza ao vivo.

**Por que um teste mostra uma barra simples em vez de um percentil?** Porque a coorte da equipe tem menos de quatro pares com aquele teste — não o suficiente para calcular um percentil válido.

**Posso reutilizar uma configuração?** Sim — salve-a como um template e aplique-a a qualquer jogador.

**Como o exporto?** Imprimir ou Exportar PDF; a saída é uma folha de uma página com a marca do clube.

## Relacionados

- [Perfil do Jogador](/support/player) — o agregador na tela a partir do qual este dossiê é impresso.
- [Avaliações](/support/evaluations) — os testes e a mesma comparação de coorte/mínimo de pares.
- [Elenco](/support/squad) — onde você abre o dossiê de um jogador.
