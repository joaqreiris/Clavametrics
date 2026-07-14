---
title: Ficha Clínica
slug: clinical-record
world: medical
app_page: Clinical Record.html
order: 3
summary: O arquivo clínico completo de um jogador — perfil médico, medicações, triagens, episódios, cirurgias, estudos e documentos — restrito a funções médicas.
---

## O que é

A Ficha Clínica é o arquivo médico completo de um jogador: seu perfil médico, medicações, triagens, episódios de doença/lesão, cirurgias, estudos de imagem e documentos clínicos. É o dado mais sensível do app e é restrito a funções médicas.

## Quando você usa

Quando a comissão médica precisa do panorama clínico completo de um jogador — revisar o histórico, registrar uma triagem ou episódio, registrar uma cirurgia ou estudo, ou fazer upload de um relatório. É o arquivo detalhado por trás do índice de nível de elenco [Fichas Clínicas](/support/clinical-records).

## Como funciona

**Abra um jogador.** Você chega a uma ficha a partir do índice [Fichas Clínicas](/support/clinical-records) (por jogador). A página carrega o arquivo daquele jogador em várias abas.

**Leia a visão geral.** A visão geral mostra KPIs de destaque, uma linha do tempo de lesões e um **mapa de calor corporal** (veja Conceitos-chave).

**Trabalhe os módulos.** As abas cobrem cada parte do arquivo — histórico de lesões, doenças & episódios (incluindo etapas de retorno ao jogo por concussão), histórico cirúrgico, tratamentos (somente leitura, da Fisioterapia), estudos de imagem e documentos. Você adiciona ou edita entradas em cada módulo, e faz upload de imagens ou documentos (arquivos de imagem/PDF até o limite de tamanho).

**Perfil de base.** Um card de base médica contém o perfil do jogador — tipo sanguíneo, alergias, condições crônicas, histórico familiar, médico responsável, seguro e datas de revisão — editável a partir de seu modal.

## Conceitos-chave

**Os sete módulos.** A ficha é construída a partir de sete tabelas médicas:

| Módulo | Contém |
| --- | --- |
| Perfil médico | Tipo sanguíneo, alergias, condições crônicas, histórico familiar, médico responsável, seguro, datas de revisão |
| Medicações | Nome, dose, frequência, motivo, flag de suplemento, isenção de uso terapêutico, datas, ativo |
| Triagens | Exames cardíacos/preventivos (ECG, eco, teste de esforço, visão, dental…), status, resultado, datas |
| Episódios | Episódios de doença / concussão / outros — status, sistema, diagnóstico, datas, dias perdidos |
| Cirurgias | Procedimento, data, lateralidade, cirurgião, clínica, implantes, desfecho |
| Estudos | Imagem & laboratório (RM, ultrassom, raio-X, TC, laboratório…), área corporal, achado, arquivo |
| Documentos | Relatórios, consentimentos, atestados, seguro, outros — título, arquivo |

Lesões e tratamentos (de [Lesões](/support/injuries) e [Fisioterapia](/support/physio)) também são exibidos aqui para contexto. Esta documentação descreve os campos; o conteúdo clínico é domínio da comissão médica.

**O mapa de calor corporal.** O mapa de calor mapeia as lesões em regiões corporais: cada região mostra o número de lesões ali e é colorida pela pior gravidade registrada (leve / moderada / grave). As lesões ativas se destacam, e clicar em uma região filtra o histórico de lesões para ela — uma leitura rápida de onde um jogador se lesiona.

**Índice vs arquivo individual.** A página [Fichas Clínicas](/support/clinical-records) é o **índice do elenco** — uma visão geral em nível de plantel com o status e a questão de destaque de cada jogador. Esta **ficha individual** é o arquivo detalhado de um jogador. Você vai do índice para a ficha.

**Acesso — restrito a funções médicas.** Esta é a parte rigorosa, e é imposta em dois lugares:

- **A página** redireciona qualquer um que não seja uma função médica para o hub (o bloqueio do módulo clínico).
- **O banco de dados** impõe o acesso médico em cada tabela clínica: um usuário só vê esses dados se for um **super-admin** ou se sua função for **admin, owner ou fisioterapeuta**. Uma função de coach ou S&C não passa.
- **Os documentos** vivem em um bucket de armazenamento **privado** (não público); os arquivos são servidos por **URLs assinadas** de curta duração, e as próprias regras de acesso do bucket exigem o mesmo acesso médico e o mesmo clube. Portanto, os documentos clínicos nunca são abertamente acessíveis.

## FAQ

**Quem pode abrir a ficha clínica de um jogador?** Apenas funções médicas — super-admin, ou um usuário cuja função seja admin, owner ou fisioterapeuta. Os demais são redirecionados, e o banco de dados não retorna nenhum dado clínico a eles.

**Os documentos enviados são públicos?** Não. Estão em um bucket privado e são abertos via URLs assinadas de curta duração, restritas a funções médicas dentro do mesmo clube.

**Qual é a diferença entre isto e a página Fichas Clínicas?** Fichas Clínicas é o índice em nível de elenco; esta é a ficha completa de um jogador. Você abre uma ficha a partir do índice.

**Esta página dá orientação de tratamento?** Não — ela armazena e exibe os dados clínicos do jogador. As decisões clínicas permanecem com a comissão médica.

## Relacionados

- [Fichas Clínicas](/support/clinical-records) — o índice do elenco de onde você abre uma ficha.
- [Lesões](/support/injuries) — lesões que também alimentam o mapa de calor e o histórico.
- [Fisioterapia](/support/physio) — tratamentos mostrados aqui somente leitura.
- [Reabilitação & Preventivos](/support/rehab) — programas de reabilitação para o jogador.
