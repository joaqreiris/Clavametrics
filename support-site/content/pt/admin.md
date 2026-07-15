---
title: Admin
slug: admin
world: admin
app_page: Admin.html
order: 1
summary: A central de controle do clube — membros, funções e permissões por seção, integrações GPS (pull do Catapult / push do StatSports), notificações, assinatura e registro de auditoria.
---

## O que é

O Admin é a central de controle do clube: gerencia os membros da comissão técnica e suas funções, concede acesso por seção, conecta provedores de GPS, roteia notificações e mostra a assinatura e o registro de auditoria. Apenas os **owners e admins** do clube podem abri-lo — todos os outros são redirecionados para o hub.

## Quando você usa

Na configuração inicial e sempre que o clube mudar: convidar ou remover membros da comissão técnica, alterar a função de um membro, conceder ou revogar acesso a módulos, atribuir membros a equipes e conectar ou remapear uma integração de GPS.

## Como funciona

**Navegue entre as seções.** As abas cobrem **Membros**, **Funções**, **Assinatura**, **Notificações**, **Integrações** e **Registro de auditoria**.

**Gerencie membros.** A tabela de Membros lista a comissão técnica com sua função, seções concedidas, última atividade e status. A partir da linha de um membro você **altera a função dele**, **edita suas seções** (concede/revoga módulos), o atribui a **equipes** ou copia o e-mail dele. **Convide** um novo membro por e-mail com uma função (e equipes opcionais) — ele recebe um convite e, ao aceitar, as permissões padrão da função são aplicadas.

**Defina funções e templates.** Em Funções você edita o **conjunto de módulos padrão** de cada função (seu template) e pode aplicar em lote um template a todos com aquela função.

**Conecte o GPS.** Em Integrações você conecta o **Catapult** ou o **StatSports** (veja Conceitos-chave), mapeia os atletas deles aos seus jogadores e os parâmetros deles às suas métricas, e verifica/sincroniza.

**Roteie notificações, revise a cobrança, audite.** Notificações roteia alertas (por exemplo, um desconforto reportado) por função e escopo; Assinatura mostra o plano e links para a cobrança; o Registro de auditoria lista as ações recentes do clube.

## Conceitos-chave

**Funções.** A função de um membro é uma de: **owner, admin, coach** (e variantes de coach — assistente, GK), **treinador de S&C, preparador físico, analista, fisioterapeuta** (responsável médico), **nutricionista, staff**, além de **jogador**. Owner e admin têm acesso completo e irrestrito a todos os módulos.

**O modelo de permissões de dois níveis.** O acesso a cada seção do app é controlado em duas camadas:

1. **Templates de função** — cada função tem um conjunto padrão de módulos para o clube (seu template). Quando alguém entra com uma função, esse template é aplicado automaticamente.
2. **Concessões por membro** — um admin pode sobrescrever o acesso de um membro individual, concedendo ou revogando módulos específicos.

Os módulos concedidos a um membro são armazenados como linhas indexadas por módulo. Um marcador especial **`__managed__`** significa que o membro está em modo *restrito*: ele vê apenas os módulos explicitamente concedidos. Se um membro **não** tiver nenhuma linha de módulo, ele obtém **acesso completo** (o modelo falha aberto) — então restringir um membro significa colocá-lo no modo gerenciado com uma lista explícita. Owners e admins sempre obtêm tudo, independentemente disso.

**Seções de módulos.** As seções que podem ser concedidas incluem planejamento (planner, planejamento diário, planejador anual, biblioteca/histórico de sessões), elenco (elenco, escalação, disponibilidade, avaliações, relatórios de partida), performance (bem-estar, RPE, monitor de carga, GPS), S&C (planejador de academia, S&C individual, biblioteca de academia, nutrição) e área médica (clínico, lesões, tratamentos, reabilitação, sala de vídeo). É por isso que, por exemplo, os módulos médicos podem ser retidos de funções não médicas.

**Integrações de GPS — pull vs push.** Os dois provedores se conectam de formas diferentes:

- O **Catapult** é uma integração de **pull**: você cola um **token de API do clube** (do OpenField) e escolhe uma região; o ClavaMetrics então puxa suas atividades sob demanda ou em uma sincronização. O token é armazenado como um segredo (nunca exibido de volta), e você mapeia os atletas e parâmetros do Catapult aos seus jogadores e métricas.
- O **StatSports** é uma integração de **push**: você combina com o seu **gerente de conta StatSports** para habilitar a API de terceiros e insere a chave; os dados são entregues ao ClavaMetrics em vez de puxados.

**Escopo do clube.** Tudo aqui tem escopo do seu clube (membros, permissões, integrações). Os super-admins de plataforma (uma lista separada de admins de plataforma) podem operar entre clubes.

## FAQ

**Quem pode abrir o Admin?** Apenas owners e admins — outras funções são redirecionadas para o hub.

**Como impeço que um coach veja dados médicos?** Coloque o membro no modo gerenciado e conceda apenas os módulos que ele deve ter — deixando de fora as seções clínico/lesões/tratamentos/reabilitação. (O arquivo clínico também tem seu próprio bloqueio médico em nível de banco de dados — veja [Ficha Clínica](/support/clinical-record).)

**Qual é a diferença entre um template de função e as seções de um membro?** O template é o padrão para todos com aquela função; as seções de um membro são suas concessões individuais, que podem sobrescrever o template.

**Como o Catapult é diferente do StatSports?** O Catapult é puxado com um token de API do clube que você insere; o StatSports é enviado (push) ao ClavaMetrics depois que o seu gerente de conta StatSports habilita a API.

## Relacionados

- [Análise GPS](/support/gps-analysis) — onde os dados de GPS sincronizados são analisados.
- [Monitor de Carga](/support/load-monitor) — o modelo ACWR configurado pelo clube se aplica a todo o clube.
- [Ficha Clínica](/support/clinical-record) — os módulos médicos bloqueados aqui, além do seu próprio bloqueio de banco de dados.
- [Hub da Comissão Técnica](/support/hub) — a home onde as funções não admin chegam.
