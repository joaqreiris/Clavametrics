---
title: Fichas Clínicas
slug: clinical-records
world: medical
app_page: Clinical Records.html
order: 2
summary: O índice médico em nível de elenco — status, questão ativa, disponibilidade e última revisão de cada jogador num relance, com link para sua ficha clínica individual.
---

## O que é

Fichas Clínicas é o índice em nível de elenco para os arquivos clínicos dos jogadores: um plantel mostrando o status médico, a questão ativa, a disponibilidade e a data da última revisão de cada jogador, a partir do qual você abre a [Ficha Clínica](/support/clinical-record) completa de qualquer jogador.

## Quando você usa

Para uma leitura médica de todo o elenco — quem está apto, modificado, lesionado ou indisponível, quem está com revisão atrasada — e como ponto de partida para a ficha detalhada de um jogador.

## Como funciona

**Leia o plantel.** Cada linha mostra o jogador, a posição, um selo de **status** (Apto, Modificado, Lesionado, Indisponível), sua **questão ativa** (o destaque da lesão atual), dias fora, uma porcentagem de **disponibilidade** para a temporada, a data da **última revisão** e uma barra de **carga** de lesões.

**Use os KPIs e filtros.** Um cabeçalho de KPI conta jogadores aptos / modificados / lesionados / indisponíveis / atrasados e a disponibilidade do elenco; os cards funcionam também como filtros. Um filtro de status e uma **busca** (por nome do jogador ou questão ativa) restringem a lista.

**Abra uma ficha.** Clique em qualquer linha para abrir a [Ficha Clínica](/support/clinical-record) individual daquele jogador.

## Conceitos-chave

**Índice vs ficha individual.** Esta página é a **visão geral** — uma linha por jogador com o status de destaque. O arquivo clínico detalhado, por módulo, vive na [Ficha Clínica](/support/clinical-record) individual. O índice tem link para ela; não é o arquivo em si.

**Acesso.** Alcançar esta página requer o módulo clínico (a página redireciona usuários sem ele), e os campos médicos que ela mostra são impostos pela regra de acesso médico do banco de dados — a mesma que restringe a [Ficha Clínica](/support/clinical-record) (super-admin, ou função admin / owner / fisioterapeuta). Observe que o campo de data de revisão vem do perfil médico, que é somente médico no nível do banco de dados.

## FAQ

**O que a coluna "questão ativa" mostra?** O destaque da lesão ativa atual do jogador (seu tipo/classificação e área corporal) — não o detalhe clínico completo, que está dentro da ficha individual.

**Como encontro jogadores com um dado problema?** Use a busca — ela corresponde a nomes de jogadores e ao texto da questão ativa.

**Como abro o arquivo completo de um jogador?** Clique na linha dele para abrir sua [Ficha Clínica](/support/clinical-record) individual.

> TODO — detalhe de controle de acesso a confirmar: a página carrega uma nota implicando que **funções não médicas (coach / S&C) veem uma visão reduzida** (apenas status, disponibilidade & RTP), mas o código do índice **não** oculta colunas por função de fato — a proteção real é o **bloqueio do módulo** clínico mais a **regra de acesso médico do banco de dados** (campos somente médicos, como a data de revisão, retornam vazios para funções não médicas, e alcançar a página depende das concessões de módulo do clube). Confirme o que uma função não médica realmente consegue abrir e ver aqui, já que a coluna "questão ativa" expõe um destaque de lesão.

## Relacionados

- [Ficha Clínica](/support/clinical-record) — o arquivo individual do jogador que este índice abre.
- [Lesões](/support/injuries) — as lesões por trás das colunas de status e questão ativa.
- [Disponibilidade](/support/availability) — a disponibilidade que a coluna de porcentagem resume.
