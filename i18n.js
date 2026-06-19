/* ClavaMetrics marketing i18n — EN / ES / PT
   - Detects region (es-* -> es, pt-* -> pt, else en)
   - Remembers the visitor's choice in localStorage (overrides detection)
   - Swaps [data-i18n] text and [data-i18n-ph] placeholders
   - Wires the .mk-lang button into a language dropdown
   English is the base text in the HTML; this file overwrites it for ES/PT. */
(function () {
  "use strict";

  var LANGS = ["en", "es", "pt"];
  var LABEL = { en: "EN", es: "ES", pt: "PT" };
  var NAME  = { en: "English", es: "Español", pt: "Português" };

  // Hero rotator words per language
  var ROTATOR = {
    en: ["football clubs", "multisport academies", "national federations", "performance staff", "youth academies"],
    es: ["clubes de fútbol", "academias multideporte", "federaciones nacionales", "cuerpos técnicos", "academias juveniles"],
    pt: ["clubes de futebol", "academias multiesportivas", "federações nacionais", "equipes de performance", "academias de base"]
  };

  // How-it-works tab panel content per language
  var HOW = {
    en: {
      plan:    { step: "Step 01 · Plan",    title: "Design the microcycle in minutes",
        desc: "Lay out the week with drag-and-drop session blocks, colour-coded by focus. Reuse templates from your library and assign work to whole categories or individual athletes.",
        list: ["Drag-and-drop weekly planner", "Reusable session & block library", "Individual plans inside the squad plan"] },
      monitor: { step: "Step 02 · Monitor", title: "See workload before it becomes an injury",
        desc: "Every session feeds acute:chronic workload ratios automatically. The moment an athlete trends into the danger zone, ClavaMetrics flags it for the staff.",
        list: ["Automatic ACWR per athlete", "Spike & ramp-rate alerts", "Wellness and RPE plotted against load"] },
      analyze: { step: "Step 03 · Analyze", title: "Turn GPS and session data into answers",
        desc: "Pull distance, high-speed running and sprint counts straight from Catapult or StatSports, and compare what was planned against what actually happened.",
        list: ["Native Catapult & StatSports sync", "Session-vs-plan comparison", "Shareable match & GPS reports"] },
      decide:  { step: "Step 04 · Decide",  title: "Walk into the session knowing what to do",
        desc: "ClavaMetrics surfaces the day's flags — who to pull back, who's cleared to return, who slept badly — so the staff makes the call with the full picture.",
        list: ["Daily auto-generated flags", "Return-to-play sign-off from physio", "One source of truth for the whole staff"] }
    },
    es: {
      plan:    { step: "Paso 01 · Planificar", title: "Diseña el microciclo en minutos",
        desc: "Arma la semana con bloques de sesión drag-and-drop, codificados por color según el objetivo. Reutiliza plantillas de tu biblioteca y asigna trabajo a categorías enteras o atletas individuales.",
        list: ["Planificador semanal drag-and-drop", "Biblioteca de sesiones y bloques reutilizable", "Planes individuales dentro del plan del plantel"] },
      monitor: { step: "Paso 02 · Monitorear", title: "Detecta la carga antes de que sea una lesión",
        desc: "Cada sesión alimenta automáticamente los ratios de carga aguda:crónica. En cuanto un atleta entra en zona de riesgo, ClavaMetrics lo avisa al staff.",
        list: ["ACWR automático por atleta", "Alertas de picos y ramp-rate", "Bienestar y RPE cruzados con la carga"] },
      analyze: { step: "Paso 03 · Analizar", title: "Convierte el GPS y los datos de sesión en respuestas",
        desc: "Trae distancia, carrera de alta velocidad y sprints directo de Catapult o StatSports, y compara lo planificado con lo que realmente pasó.",
        list: ["Sincronización nativa con Catapult y StatSports", "Comparación sesión vs. plan", "Reportes de partido y GPS para compartir"] },
      decide:  { step: "Paso 04 · Decidir", title: "Llega a la sesión sabiendo qué hacer",
        desc: "ClavaMetrics destaca las alertas del día — a quién frenar, quién está habilitado para volver, quién durmió mal — para que el staff decida con el panorama completo.",
        list: ["Alertas diarias autogeneradas", "Alta de vuelta a la competencia firmada por el fisio", "Una única fuente de verdad para todo el staff"] }
    },
    pt: {
      plan:    { step: "Passo 01 · Planejar", title: "Desenhe o microciclo em minutos",
        desc: "Monte a semana com blocos de sessão de arrastar e soltar, codificados por cor conforme o foco. Reutilize modelos da sua biblioteca e atribua trabalho a categorias inteiras ou atletas individuais.",
        list: ["Planejador semanal de arrastar e soltar", "Biblioteca reutilizável de sessões e blocos", "Planos individuais dentro do plano do elenco"] },
      monitor: { step: "Passo 02 · Monitorar", title: "Veja a carga antes que vire lesão",
        desc: "Cada sessão alimenta automaticamente as razões de carga aguda:crônica. No momento em que um atleta entra na zona de risco, o ClavaMetrics avisa a equipe.",
        list: ["ACWR automático por atleta", "Alertas de picos e ramp-rate", "Bem-estar e RPE cruzados com a carga"] },
      analyze: { step: "Passo 03 · Analisar", title: "Transforme o GPS e os dados de sessão em respostas",
        desc: "Puxe distância, corrida em alta velocidade e sprints direto do Catapult ou StatSports, e compare o planejado com o que realmente aconteceu.",
        list: ["Sincronização nativa com Catapult e StatSports", "Comparação sessão vs. plano", "Relatórios de jogo e GPS para compartilhar"] },
      decide:  { step: "Passo 04 · Decidir", title: "Chegue à sessão sabendo o que fazer",
        desc: "O ClavaMetrics destaca os alertas do dia — quem segurar, quem está liberado para voltar, quem dormiu mal — para a equipe decidir com o quadro completo.",
        list: ["Alertas diários gerados automaticamente", "Liberação de retorno ao jogo assinada pelo fisio", "Uma única fonte de verdade para toda a equipe"] }
    }
  };

  // key -> { en, es, pt }
  var DICT = {
    // ── Nav ──
    "nav.product":   { en: "Product",       es: "Producto",        pt: "Produto" },
    "nav.how":       { en: "How it works",  es: "Cómo funciona",   pt: "Como funciona" },
    "nav.pricing":   { en: "Pricing",       es: "Precios",         pt: "Preços" },
    "nav.customers": { en: "Customers",     es: "Clientes",        pt: "Clientes" },
    "nav.signin":    { en: "Sign in",       es: "Iniciar sesión",  pt: "Entrar" },
    "nav.startfree": { en: "Start free",    es: "Empezar gratis",  pt: "Começar grátis" },

    // ── Hero ──
    "hero.eyebrow":  { en: "Performance OS for sport", es: "El sistema operativo del rendimiento deportivo", pt: "O sistema operativo da performance esportiva" },
    "hero.h1pre":    { en: "The performance OS for",   es: "El sistema operativo de rendimiento para",        pt: "O sistema operativo de performance para" },
    "hero.sub":      { en: "Plan microcycles, monitor load, track availability and analyze GPS — across every category, in one workspace. From the senior squad down to the Sub-14.",
                       es: "Planifica microciclos, monitorea la carga, controla la disponibilidad y analiza el GPS — en cada categoría, en un solo espacio. Del primer equipo hasta la Sub-14.",
                       pt: "Planeje microciclos, monitore a carga, acompanhe a disponibilidade e analise o GPS — em todas as categorias, num só espaço. Do time principal até o Sub-14." },
    "hero.demo":     { en: "Book a demo",   es: "Agenda una demo", pt: "Agende uma demo" },
    "hero.trust1":   { en: "14 days free",  es: "14 días gratis",  pt: "14 dias grátis" },
    "hero.trust2":   { en: "No credit card required", es: "Sin tarjeta de crédito", pt: "Sem cartão de crédito" },
    "hero.trust3":   { en: "Cancel anytime", es: "Cancela cuando quieras", pt: "Cancele quando quiser" },

    // ── Section eyebrows + headings ──
    "sec.modules.eye": { en: "Modules", es: "Módulos", pt: "Módulos" },
    "sec.modules.h2":  { en: "Everything performance staff needs", es: "Todo lo que el cuerpo técnico necesita", pt: "Tudo o que a equipe de performance precisa" },
    "sec.loop.eye":    { en: "The loop", es: "El ciclo", pt: "O ciclo" },
    "sec.loop.h2":     { en: "From plan to decision, in one loop", es: "Del plan a la decisión, en un solo ciclo", pt: "Do plano à decisão, num só ciclo" },
    "sec.watch.eye":   { en: "Watch", es: "Ver", pt: "Veja" },
    "sec.watch.h2":    { en: "See the whole loop in 90 seconds", es: "Mira todo el ciclo en 90 segundos", pt: "Veja o ciclo inteiro em 90 segundos" },
    "sec.who.eye":     { en: "Who it's for", es: "Para quién es", pt: "Para quem é" },
    "sec.who.h2":      { en: "Built for everyone in the building", es: "Pensado para todo el club", pt: "Feito para todo o clube" },
    "sec.devices.eye": { en: "Anywhere", es: "En cualquier lugar", pt: "Em qualquer lugar" },
    "sec.devices.h2":  { en: "Staff on desktop. Athletes on mobile.", es: "El staff en el escritorio. Los atletas en el móvil.", pt: "A equipe no desktop. Os atletas no celular." },
    "sec.testi.eye":   { en: "Testimonials", es: "Testimonios", pt: "Depoimentos" },
    "sec.testi.h2":    { en: "From grassroots to the first division", es: "Desde el fútbol base hasta primera división", pt: "Da base à primeira divisão" },
    "sec.faq.eye":     { en: "FAQ", es: "FAQ", pt: "FAQ" },
    "sec.faq.h2":      { en: "Frequently asked", es: "Preguntas frecuentes", pt: "Perguntas frequentes" },

    // ── Multi-device ──
    "devices.staff.tag":  { en: "Web platform · Staff", es: "Plataforma web · Staff", pt: "Plataforma web · Equipe" },
    "devices.athlete.tag": { en: "Mobile app · Athletes", es: "App móvil · Atletas", pt: "App · Atletas" },
    "devices.staff.h3":  { en: "Plan, monitor and analyze", es: "Planifica, monitorea y analiza", pt: "Planeje, monitore e analise" },
    "devices.staff.p":   { en: "The full performance OS — planner, load monitor, GPS analysis and reports — on one screen.",
                           es: "El sistema completo — planificador, monitor de carga, análisis GPS y reportes — en una sola pantalla.",
                           pt: "O sistema completo — planejador, monitor de carga, análise GPS e relatórios — numa só tela." },
    "devices.athlete.h3": { en: "Check in on the go", es: "Registra desde donde estés", pt: "Faça o check-in de onde estiver" },
    "devices.athlete.p":  { en: "Wellness, RPE and today's session — in the athlete's pocket.",
                            es: "Bienestar, RPE y la sesión de hoy — en el bolsillo del atleta.",
                            pt: "Bem-estar, RPE e a sessão de hoje — no bolso do atleta." },

    // ── Final CTA ──
    "cta.eye": { en: "Get started", es: "Empezá", pt: "Comece" },
    "cta.h2":  { en: "Run every category from one place", es: "Gestiona todas las categorías desde un solo lugar", pt: "Gerencie todas as categorias num só lugar" },
    "cta.p":   { en: "Set up your club workspace in minutes. Start free on youth categories, and add paid tiers only where you need them.",
                 es: "Configura el espacio de tu club en minutos. Empieza gratis en las categorías juveniles y suma planes pagos solo donde los necesites.",
                 pt: "Configure o espaço do seu clube em minutos. Comece grátis nas categorias de base e adicione planos pagos só onde precisar." },

    // ── Footer ──
    "foot.brand.p":     { en: "The performance OS for clubs and federations. Every sport, every category, one workspace.",
                          es: "El sistema operativo del rendimiento para clubes y federaciones. Cada deporte, cada categoría, un solo espacio.",
                          pt: "O sistema operativo da performance para clubes e federações. Cada esporte, cada categoria, um só espaço." },
    "foot.col.product":   { en: "Product", es: "Producto", pt: "Produto" },
    "foot.features":      { en: "Features", es: "Funciones", pt: "Funcionalidades" },
    "foot.col.solutions": { en: "Solutions", es: "Soluciones", pt: "Soluções" },
    "foot.sol.football":  { en: "Football clubs", es: "Clubes de fútbol", pt: "Clubes de futebol" },
    "foot.sol.multisport":{ en: "Multisport", es: "Multideporte", pt: "Multiesportivo" },
    "foot.sol.federations":{ en: "Federations", es: "Federaciones", pt: "Federações" },
    "foot.sol.medical":   { en: "Medical & rehab", es: "Médico y rehab", pt: "Médico e reabilitação" },
    "foot.col.company":   { en: "Company", es: "Empresa", pt: "Empresa" },
    "foot.about":         { en: "About", es: "Nosotros", pt: "Sobre" },
    "foot.contact":       { en: "Contact", es: "Contacto", pt: "Contato" },
    "foot.docs":          { en: "Docs", es: "Docs", pt: "Docs" },
    "foot.copy":          { en: "© ClavaMetrics, Inc. · Performance OS for sport",
                            es: "© ClavaMetrics, Inc. · El sistema operativo del rendimiento deportivo",
                            pt: "© ClavaMetrics, Inc. · O sistema operativo da performance esportiva" },
    "foot.privacy": { en: "Privacy", es: "Privacidad", pt: "Privacidade" },
    "foot.terms":   { en: "Terms",   es: "Términos",   pt: "Termos" },
    "foot.dpa":     { en: "DPA",      es: "DPA",        pt: "DPA" },
    "foot.status":  { en: "Status",  es: "Estado",     pt: "Status" },

    // ── Modules cards ──
    "mod.planner.t": { en: "Drill Designer", es: "Drill Designer", pt: "Drill Designer" },
    "mod.planner.d": { en: "Build microcycles and daily sessions with drag-and-drop blocks, tagged by focus.", es: "Construye microciclos y sesiones diarias con bloques drag-and-drop, etiquetados por objetivo.", pt: "Monte microciclos e sessões diárias com blocos de arrastar e soltar, marcados por foco." },
    "mod.load.t": { en: "Load monitor", es: "Monitor de carga", pt: "Monitor de carga" },
    "mod.load.d": { en: "Acute:chronic workload ratios and alerts that flag spikes before they become injuries.", es: "Ratios de carga aguda:crónica y alertas que avisan los picos antes de que se vuelvan lesiones.", pt: "Razões de carga aguda:crônica e alertas que sinalizam picos antes que virem lesões." },
    "mod.avail.t": { en: "Availability", es: "Disponibilidad", pt: "Disponibilidade" },
    "mod.avail.d": { en: "Daily presence, session minutes and status across the whole squad at a glance.", es: "Presencia diaria, minutos de sesión y estado de todo el plantel de un vistazo.", pt: "Presença diária, minutos de sessão e status de todo o elenco num relance." },
    "mod.gps.t": { en: "GPS analysis", es: "Análisis GPS", pt: "Análise GPS" },
    "mod.gps.d": { en: "Native Catapult & StatSports sync — distance, sprints and high-speed running by session.", es: "Sincronización nativa con Catapult y StatSports — distancia, sprints y carrera de alta velocidad por sesión.", pt: "Sincronização nativa com Catapult e StatSports — distância, sprints e corrida em alta velocidade por sessão." },
    "mod.wellness.t": { en: "Wellness & RPE", es: "Bienestar y RPE", pt: "Bem-estar e RPE" },
    "mod.wellness.d": { en: "Athlete check-ins for sleep, soreness and effort, plotted against planned load.", es: "Check-ins del atleta de sueño, dolor y esfuerzo, cruzados con la carga planificada.", pt: "Check-ins do atleta de sono, dores e esforço, cruzados com a carga planejada." },
    "mod.physio.t": { en: "Physio & rehab", es: "Fisio y rehab", pt: "Fisio e reabilitação" },
    "mod.physio.d": { en: "Injury logs, rehab planners and return-to-play protocols shared with the medical staff.", es: "Registro de lesiones, planificadores de rehab y protocolos de vuelta a la competencia compartidos con el cuerpo médico.", pt: "Registro de lesões, planejadores de reabilitação e protocolos de retorno ao jogo compartilhados com a equipe médica." },
    "mod.match.t": { en: "Match reports", es: "Reportes de partido", pt: "Relatórios de jogo" },
    "mod.match.d": { en: "Post-match minutes, ratings and GPS output rolled into one shareable report.", es: "Minutos, valoraciones y datos GPS post-partido reunidos en un reporte para compartir.", pt: "Minutos, avaliações e dados de GPS pós-jogo reunidos num relatório para compartilhar." },
    "mod.nutrition.t": { en: "Nutrition", es: "Nutrición", pt: "Nutrição" },
    "mod.nutrition.d": { en: "Hydration, body composition and meal guidance tracked alongside training load.", es: "Hidratación, composición corporal y pautas de alimentación junto a la carga de entrenamiento.", pt: "Hidratação, composição corporal e orientação alimentar junto à carga de treino." },

    // ── Who it's for cards ──
    "who.football.t": { en: "Football clubs", es: "Clubes de fútbol", pt: "Clubes de futebol" },
    "who.football.d": { en: "Run senior, reserves and every youth category from one workspace — each with its own staff and plan.", es: "Gestiona primera, reserva y todas las juveniles desde un solo espacio — cada una con su staff y su plan.", pt: "Gerencie o time principal, os reservas e todas as categorias de base num só espaço — cada uma com sua equipe e seu plano." },
    "who.multisport.t": { en: "Multisport academies", es: "Academias multideporte", pt: "Academias multiesportivas" },
    "who.multisport.d": { en: "Basketball, volleyball, swimming, athletics and more — one performance language across every discipline.", es: "Básquet, vóley, natación, atletismo y más — un solo lenguaje de rendimiento en cada disciplina.", pt: "Basquete, vôlei, natação, atletismo e mais — uma só linguagem de performance em cada modalidade." },
    "who.federations.t": { en: "National federations", es: "Federaciones nacionales", pt: "Federações nacionais" },
    "who.federations.d": { en: "Centralize the performance data of every team and category, with multi-tenant access and data residency.", es: "Centraliza los datos de rendimiento de cada equipo y categoría, con acceso multi-tenant y residencia de datos.", pt: "Centralize os dados de performance de cada equipe e categoria, com acesso multi-tenant e residência de dados." },
    "who.sc.t": { en: "Performance & S&C", es: "Rendimiento y preparación física", pt: "Performance e preparação física" },
    "who.sc.d": { en: "Plan, prescribe and monitor load with the depth a strength & conditioning team actually needs.", es: "Planifica, prescribe y monitorea la carga con la profundidad que un equipo de preparación física realmente necesita.", pt: "Planeje, prescreva e monitore a carga com a profundidade que uma equipe de preparação física realmente precisa." },
    "who.medical.t": { en: "Medical & rehab", es: "Médico y rehab", pt: "Médico e reabilitação" },
    "who.medical.d": { en: "Track injuries, build rehab plans and manage return-to-play in sync with the training calendar.", es: "Registra lesiones, arma planes de rehab y gestiona la vuelta a la competencia en sintonía con el calendario.", pt: "Acompanhe lesões, monte planos de reabilitação e gerencie o retorno ao jogo em sintonia com o calendário." },
    "who.directors.t": { en: "Performance directors", es: "Directores de rendimiento", pt: "Diretores de performance" },
    "who.directors.d": { en: "One dashboard across every category to oversee availability, load and methodology club-wide.", es: "Un solo dashboard de todas las categorías para supervisar disponibilidad, carga y metodología en todo el club.", pt: "Um só painel de todas as categorias para supervisionar disponibilidade, carga e metodologia em todo o clube." },

    // ── How-it-works tab labels ──
    "how.tab.plan":    { en: "Plan", es: "Planificar", pt: "Planejar" },
    "how.tab.monitor": { en: "Monitor", es: "Monitorear", pt: "Monitorar" },
    "how.tab.analyze": { en: "Analyze", es: "Analizar", pt: "Analisar" },
    "how.tab.decide":  { en: "Decide", es: "Decidir", pt: "Decidir" },

    // ── Testimonials ──
    "testi.intro": { en: "Clubs of every size run their performance week on ClavaMetrics — the same tools scale from a single youth category to a full first team.", es: "Clubes de todos los tamaños corren su semana de rendimiento en ClavaMetrics — las mismas herramientas escalan desde una sola categoría juvenil hasta un primer equipo completo.", pt: "Clubes de todos os tamanhos rodam sua semana de performance no ClavaMetrics — as mesmas ferramentas escalam de uma única categoria de base até um time principal inteiro." },
    "testi.q1": { en: "\"We were running four spreadsheets and a WhatsApp group. Now the whole Sub-17 staff plans, logs wellness and tracks load in one place — and it took us an afternoon to set up.\"", es: "\"Teníamos cuatro planillas y un grupo de WhatsApp. Ahora todo el cuerpo técnico de la Sub-17 planifica, registra bienestar y controla la carga en un solo lugar — y nos llevó una tarde configurarlo.\"", pt: "\"A gente usava quatro planilhas e um grupo de WhatsApp. Agora toda a comissão do Sub-17 planeja, registra bem-estar e acompanha a carga num só lugar — e levou uma tarde para configurar.\"" },
    "testi.r1": { en: "Fitness coach · Youth academy", es: "Preparador físico · Academia juvenil", pt: "Preparador físico · Categoria de base" },
    "testi.q2": { en: "\"The ACWR alerts paid for the platform in the first month. We caught two ramp-rate spikes before they turned into soft-tissue injuries — the medical and S&C staff finally read from the same screen.\"", es: "\"Las alertas de ACWR pagaron la plataforma en el primer mes. Frenamos dos picos de ramp-rate antes de que se volvieran lesiones musculares — el cuerpo médico y el de preparación física por fin leen la misma pantalla.\"", pt: "\"Os alertas de ACWR pagaram a plataforma no primeiro mês. Pegamos dois picos de ramp-rate antes de virarem lesões musculares — a equipe médica e a de preparação física finalmente leem a mesma tela.\"" },
    "testi.r2": { en: "Performance director · Pro club", es: "Director de rendimiento · Club profesional", pt: "Diretor de performance · Clube profissional" },
    "testi.q3": { en: "\"Rolling one methodology across every category used to be impossible. With ClavaMetrics our federation sees availability and load for all teams from one dashboard — without taking autonomy from each coach.\"", es: "\"Bajar una sola metodología a todas las categorías era imposible. Con ClavaMetrics nuestra federación ve la disponibilidad y la carga de todos los equipos desde un solo dashboard — sin quitarle autonomía a cada entrenador.\"", pt: "\"Levar uma única metodologia para todas as categorias era impossível. Com o ClavaMetrics nossa federação vê a disponibilidade e a carga de todas as equipes num só painel — sem tirar a autonomia de cada treinador.\"" },
    "testi.r3": { en: "Head of methodology · Federation", es: "Responsable de metodología · Federación", pt: "Responsável de metodologia · Federação" },

    // ── FAQ ──
    "faq.q1": { en: "What exactly is ClavaMetrics?", es: "¿Qué es exactamente ClavaMetrics?", pt: "O que é exatamente o ClavaMetrics?" },
    "faq.a1": { en: "A centralized performance platform for clubs and federations of every sport. Plan training, monitor load, track availability and analyze GPS — for every category, from one place, with one bill.", es: "Una plataforma de rendimiento centralizada para clubes y federaciones de cualquier deporte. Planifica entrenamientos, monitorea la carga, controla la disponibilidad y analiza GPS — para cada categoría, desde un solo lugar, con una sola factura.", pt: "Uma plataforma de performance centralizada para clubes e federações de qualquer esporte. Planeje treinos, monitore a carga, acompanhe a disponibilidade e analise GPS — para cada categoria, de um só lugar, com uma só fatura." },
    "faq.q2": { en: "Does it work for sports other than football?", es: "¿Funciona para deportes además del fútbol?", pt: "Funciona para esportes além do futebol?" },
    "faq.a2": { en: "Yes. The same planning, load and availability tools work for basketball, volleyball, swimming, athletics, rugby and more. Multisport academies run every discipline in one workspace.", es: "Sí. Las mismas herramientas de planificación, carga y disponibilidad funcionan para básquet, vóley, natación, atletismo, rugby y más. Las academias multideporte gestionan cada disciplina en un solo espacio.", pt: "Sim. As mesmas ferramentas de planejamento, carga e disponibilidade funcionam para basquete, vôlei, natação, atletismo, rugby e mais. Academias multiesportivas gerenciam cada modalidade num só espaço." },
    "faq.q3": { en: "How do athletes receive their sessions?", es: "¿Cómo reciben los atletas sus sesiones?", pt: "Como os atletas recebem suas sessões?" },
    "faq.a3": { en: "Athletes get their plan, wellness check-ins and RPE forms on the mobile app. Staff build and analyze everything on the web platform — the two stay in sync automatically.", es: "Los atletas reciben su plan, los check-ins de bienestar y los formularios de RPE en la app móvil. El staff construye y analiza todo en la plataforma web — ambas se sincronizan automáticamente.", pt: "Os atletas recebem seu plano, os check-ins de bem-estar e os formulários de RPE no app. A equipe monta e analisa tudo na plataforma web — os dois se sincronizam automaticamente." },
    "faq.q4": { en: "Do you integrate with Catapult or StatSports?", es: "¿Se integra con Catapult o StatSports?", pt: "Integra com Catapult ou StatSports?" },
    "faq.a4": { en: "On Profesional and Full tiers, ClavaMetrics connects to your existing Catapult or StatSports account and syncs sessions automatically — no CSV exports needed.", es: "En los planes Profesional y Full, ClavaMetrics se conecta a tu cuenta de Catapult o StatSports y sincroniza las sesiones automáticamente — sin exportar CSV.", pt: "Nos planos Profesional e Full, o ClavaMetrics se conecta à sua conta do Catapult ou StatSports e sincroniza as sessões automaticamente — sem exportar CSV." },
    "faq.q5": { en: "Is there a free plan?", es: "¿Hay un plan gratis?", pt: "Existe um plano grátis?" },
    "faq.a5": { en: "The Iniciación tier is free forever for categories under 15 athletes. Every paid tier includes a 14-day trial with no card required.", es: "El plan Iniciación es gratis para siempre para categorías de menos de 15 atletas. Cada plan pago incluye 14 días de prueba sin tarjeta.", pt: "O plano Iniciación é grátis para sempre para categorias com menos de 15 atletas. Cada plano pago inclui 14 dias de teste sem cartão." },

    // ════════ CONTACT ════════
    "ct.h1": { en: "See ClavaMetrics on your own squad", es: "Conoce ClavaMetrics con tu propio plantel", pt: "Veja o ClavaMetrics com o seu próprio elenco" },
    "ct.b1.t": { en: "30-minute walkthrough", es: "Recorrido de 30 minutos", pt: "Tour de 30 minutos" },
    "ct.b1.d": { en: "A focused session with someone who knows performance, not a sales pitch.", es: "Una sesión enfocada con alguien que sabe de rendimiento, no un discurso de ventas.", pt: "Uma sessão focada com alguém que entende de performance, não um discurso de vendas." },
    "ct.b2.t": { en: "Set up around your categories", es: "Configurado según tus categorías", pt: "Configurado em torno das suas categorias" },
    "ct.b2.d": { en: "We'll show planning, load and availability mapped to your teams.", es: "Te mostramos planificación, carga y disponibilidad mapeadas a tus equipos.", pt: "Mostramos planejamento, carga e disponibilidade mapeados para suas equipes." },
    "ct.b3.t": { en: "Integrations & migration", es: "Integraciones y migración", pt: "Integrações e migração" },
    "ct.b3.d": { en: "Bringing GPS data or spreadsheets across? We'll cover how.", es: "¿Traes datos de GPS o planillas? Vemos cómo hacerlo.", pt: "Vai trazer dados de GPS ou planilhas? A gente mostra como." },
    "ct.free.pre": { en: "Prefer to explore? ", es: "¿Prefieres explorar? ", pt: "Prefere explorar? " },
    "ct.lbl.name": { en: "Full name", es: "Nombre completo", pt: "Nome completo" },
    "ct.lbl.email": { en: "Work email", es: "Email de trabajo", pt: "Email de trabalho" },
    "ct.lbl.club": { en: "Club / organization", es: "Club / organización", pt: "Clube / organização" },
    "ct.lbl.role": { en: "Your role", es: "Tu rol", pt: "Sua função" },
    "ct.lbl.sport": { en: "Sport", es: "Deporte", pt: "Esporte" },
    "ct.lbl.size": { en: "Athletes", es: "Atletas", pt: "Atletas" },
    "ct.lbl.msg": { en: "Anything we should know?", es: "¿Algo que debamos saber?", pt: "Algo que devemos saber?" },
    "ct.ph.msg": { en: "How many categories, current tools, what you'd like to solve…", es: "Cuántas categorías, herramientas actuales, qué te gustaría resolver…", pt: "Quantas categorias, ferramentas atuais, o que gostaria de resolver…" },
    "ct.opt.select": { en: "Select…", es: "Selecciona…", pt: "Selecione…" },
    "ct.role.coach": { en: "Head coach", es: "Entrenador principal", pt: "Treinador principal" },
    "ct.role.sc": { en: "Strength & conditioning", es: "Preparación física", pt: "Preparação física" },
    "ct.role.physio": { en: "Physio / medical", es: "Fisio / médico", pt: "Fisio / médico" },
    "ct.role.analyst": { en: "Performance analyst", es: "Analista de rendimiento", pt: "Analista de performance" },
    "ct.role.director": { en: "Performance director", es: "Director de rendimiento", pt: "Diretor de performance" },
    "ct.role.mgmt": { en: "Club management", es: "Dirigencia del club", pt: "Gestão do clube" },
    "ct.opt.other": { en: "Other", es: "Otro", pt: "Outro" },
    "ct.sport.football": { en: "Football", es: "Fútbol", pt: "Futebol" },
    "ct.sport.basket": { en: "Basketball", es: "Básquetbol", pt: "Basquete" },
    "ct.sport.volley": { en: "Volleyball", es: "Vóleibol", pt: "Vôlei" },
    "ct.sport.rugby": { en: "Rugby", es: "Rugby", pt: "Rugby" },
    "ct.sport.swim": { en: "Swimming", es: "Natación", pt: "Natação" },
    "ct.sport.athletics": { en: "Athletics", es: "Atletismo", pt: "Atletismo" },
    "ct.sport.multi": { en: "Multisport", es: "Multideporte", pt: "Multiesportivo" },
    "ct.size.u15": { en: "Under 15", es: "Menos de 15", pt: "Menos de 15" },
    "ct.size.xl": { en: "400+ (federation)", es: "400+ (federación)", pt: "400+ (federação)" },
    "ct.submit": { en: "Request demo", es: "Solicitar demo", pt: "Solicitar demo" },
    "ct.note": { en: "By submitting you agree to our Privacy Policy. No spam, ever.", es: "Al enviar aceptas nuestra Política de Privacidad. Nada de spam, nunca.", pt: "Ao enviar, você concorda com nossa Política de Privacidade. Sem spam, nunca." },
    "ct.success.t": { en: "Request received", es: "Solicitud recibida", pt: "Solicitação recebida" },
    "ct.success.d": { en: "Thanks — we'll be in touch within one business day to set up your walkthrough.", es: "Gracias — te contactamos dentro de un día hábil para coordinar el recorrido.", pt: "Obrigado — entramos em contato em até um dia útil para agendar o tour." },
    "ct.success.back": { en: "Back to home", es: "Volver al inicio", pt: "Voltar ao início" },
    "ct.logos": { en: "Trusted by performance staff at clubs & federations", es: "Usado por cuerpos técnicos de clubes y federaciones", pt: "Usado por equipes de performance de clubes e federações" },
    "ct.badge": { en: "Request a demo", es: "Solicita una demo", pt: "Solicite uma demo" },
    "ct.reply": { en: "We reply within one business day", es: "Respondemos dentro de un día hábil", pt: "Respondemos em até um dia útil" },
    "ct.orfree": { en: "Or start free, no demo needed", es: "O empieza gratis, sin demo", pt: "Ou comece grátis, sem demo" },

    // ════════ PRICING ════════
    "pr.eyebrow": { en: "Per-category pricing", es: "Precios por categoría", pt: "Preços por categoria" },
    "pr.h1": { en: "Pay for the categories <em>you actually run.</em>", es: "Paga solo por las categorías <em>que realmente tienes.</em>", pt: "Pague só pelas categorias <em>que você realmente tem.</em>" },
    "pr.sub": { en: "Mix tiers across senior, reserves, and youth — one workspace, one bill, and only what each squad needs. No per-athlete surprises.", es: "Combina planes entre primera, reserva y juveniles — un espacio, una factura, y solo lo que cada equipo necesita. Sin sorpresas por atleta.", pt: "Combine planos entre o time principal, reservas e categorias de base — um espaço, uma fatura, e só o que cada equipe precisa. Sem surpresas por atleta." },
    "pr.monthly": { en: "Monthly", es: "Mensual", pt: "Mensal" },
    "pr.annual": { en: "Annual", es: "Anual", pt: "Anual" },
    "pr.tier1.tag": { en: "For grassroots and youth categories getting started.", es: "Para fútbol base y categorías juveniles que arrancan.", pt: "Para a base e categorias juvenis que estão começando." },
    "pr.tier2.tag": { en: "For developing categories with real planning needs.", es: "Para categorías en desarrollo con necesidades reales de planificación.", pt: "Para categorias em desenvolvimento com necessidades reais de planejamento." },
    "pr.tier3.tag": { en: "For senior & pre-pro teams running full performance ops.", es: "Para equipos de primera y pre-profesionales con operación completa de rendimiento.", pt: "Para times principais e pré-profissionais com operação completa de performance." },
    "pr.tier4.tag": { en: "For elite squads with unlimited rosters and reporting.", es: "Para planteles de élite con rosters ilimitados y reportes completos.", pt: "Para elencos de elite com plantéis ilimitados e relatórios." },
    "pr.per": { en: "/ category / mo", es: "/ categoría / mes", pt: "/ categoria / mês" },
    "pr.peryr": { en: "/ category / yr", es: "/ categoría / año", pt: "/ categoria / ano" },
    "pr.permo": { en: "/ mo", es: "/ mes", pt: "/ mês" },
    "pr.eq.suffix": { en: "/mo · billed annually", es: "/mes · facturado anualmente", pt: "/mês · faturado anualmente" },
    "pr.tier1.meta": { en: "Up to 15 athletes · manual data only", es: "Hasta 15 atletas · solo datos manuales", pt: "Até 15 atletas · só dados manuais" },
    "pr.tier2.meta": { en: "Up to 30 athletes · CSV imports", es: "Hasta 30 atletas · importación CSV", pt: "Até 30 atletas · importação CSV" },
    "pr.tier3.meta": { en: "Up to 80 athletes · GPS analysis", es: "Hasta 80 atletas · análisis GPS", pt: "Até 80 atletas · análise GPS" },
    "pr.tier4.meta": { en: "Unlimited athletes · everything included", es: "Atletas ilimitados · todo incluido", pt: "Atletas ilimitados · tudo incluído" },
    "pr.cta.free": { en: "Get started free", es: "Empezar gratis", pt: "Começar grátis" },
    "pr.cta.trial": { en: "Start 14-day trial", es: "Probar 14 días gratis", pt: "Testar 14 dias grátis" },
    "pr.badge": { en: "Most popular", es: "Más elegido", pt: "Mais popular" },
    "pr.f.roster": { en: "Roster & availability", es: "Plantel y disponibilidad", pt: "Elenco e disponibilidade" },
    "pr.f.rpe": { en: "Simple <strong>RPE</strong> form", es: "Formulario <strong>RPE</strong> simple", pt: "Formulário <strong>RPE</strong> simples" },
    "pr.f.injlog": { en: "Manual injuries log", es: "Registro manual de lesiones", pt: "Registro manual de lesões" },
    "pr.f.app": { en: "Athlete mobile app", es: "App móvil para atletas", pt: "App para atletas" },
    "pr.f.nogps": { en: "No GPS analysis yet", es: "Sin análisis GPS todavía", pt: "Sem análise GPS ainda" },
    "pr.f.alliniciacion": { en: "Everything in <strong>Iniciación</strong>", es: "Todo lo de <strong>Iniciación</strong>", pt: "Tudo do <strong>Iniciación</strong>" },
    "pr.f.micro": { en: "Microcycles & daily planning", es: "Microciclos y planificación diaria", pt: "Microciclos e planejamento diário" },
    "pr.f.sleep": { en: "Wellness + sleep tracking", es: "Bienestar + seguimiento del sueño", pt: "Bem-estar + monitoramento do sono" },
    "pr.f.csvimport": { en: "<strong>CSV</strong> GPS import", es: "Importación GPS por <strong>CSV</strong>", pt: "Importação GPS por <strong>CSV</strong>" },
    "pr.f.basicload": { en: "Basic load monitoring", es: "Monitoreo básico de carga", pt: "Monitoramento básico de carga" },
    "pr.f.allbasico": { en: "Everything in <strong>Básico</strong>", es: "Todo lo de <strong>Básico</strong>", pt: "Tudo do <strong>Básico</strong>" },
    "pr.f.gpssync": { en: "<strong>Catapult</strong> + <strong>StatSports</strong> sync", es: "Sincronización <strong>Catapult</strong> + <strong>StatSports</strong>", pt: "Sincronização <strong>Catapult</strong> + <strong>StatSports</strong>" },
    "pr.f.acwr": { en: "ACWR & load alerts", es: "ACWR y alertas de carga", pt: "ACWR e alertas de carga" },
    "pr.f.matchgps": { en: "Match reports + GPS analysis", es: "Reportes de partido + análisis GPS", pt: "Relatórios de jogo + análise GPS" },
    "pr.f.physionut": { en: "Physio & nutrition modules", es: "Módulos de fisio y nutrición", pt: "Módulos de fisio e nutrição" },
    "pr.f.dashboards": { en: "Custom dashboards", es: "Dashboards personalizados", pt: "Painéis personalizados" },
    "pr.f.allprofesional": { en: "Everything in <strong>Profesional</strong>", es: "Todo lo de <strong>Profesional</strong>", pt: "Tudo do <strong>Profesional</strong>" },
    "pr.f.unlimited": { en: "Unlimited athletes", es: "Atletas ilimitados", pt: "Atletas ilimitados" },
    "pr.f.predictive": { en: "Predictive injury models", es: "Modelos predictivos de lesiones", pt: "Modelos preditivos de lesões" },
    "pr.f.seats": { en: "Multi-staff seats (unlimited)", es: "Asientos multi-staff (ilimitados)", pt: "Assentos multi-equipe (ilimitados)" },
    "pr.f.sla": { en: "Priority support & SLA", es: "Soporte prioritario y SLA", pt: "Suporte prioritário e SLA" },
    "pr.f.dailycal": { en: "Daily planning & calendar", es: "Planificación diaria y calendario", pt: "Planejamento diário e calendário" },
    "pr.f.exlib": { en: "Exercises Library (browse)", es: "Exercises Library (explorar)", pt: "Exercises Library (explorar)" },
    "pr.f.rpewell": { en: "RPE + wellness logging", es: "RPE + bienestar (registro)", pt: "RPE + bem-estar (registro)" },
    "pr.f.treatlog": { en: "Physio treatment log", es: "Registro de tratamientos del fisio", pt: "Registro de tratamentos do fisio" },
    "pr.f.drilldesign": { en: "<strong>Drill Designer</strong> (create exercises)", es: "<strong>Drill Designer</strong> (crear ejercicios)", pt: "<strong>Drill Designer</strong> (criar exercícios)" },
    "pr.f.annualgym": { en: "Annual Planner & gym", es: "Annual Planner y gimnasio", pt: "Annual Planner e academia" },
    "pr.f.gpscsv": { en: "<strong>GPS Analysis</strong> (CSV import)", es: "<strong>GPS Analysis</strong> (importación CSV)", pt: "<strong>GPS Analysis</strong> (importação CSV)" },
    "pr.f.evalinj": { en: "Evaluations & injury tracking", es: "Evaluaciones y seguimiento de lesiones", pt: "Avaliações e acompanhamento de lesões" },
    "pr.f.wellanalysis": { en: "Wellness/RPE analysis & trends", es: "Análisis y tendencias de bienestar/RPE", pt: "Análise e tendências de bem-estar/RPE" },
    "pr.f.loadmon": { en: "<strong>Load Monitor</strong> (ACWR · CTL/ATL/TSB)", es: "<strong>Load Monitor</strong> (ACWR · CTL/ATL/TSB)", pt: "<strong>Load Monitor</strong> (ACWR · CTL/ATL/TSB)" },
    "pr.f.indplan": { en: "Individual Planner (per athlete)", es: "Individual Planner (por atleta)", pt: "Individual Planner (por atleta)" },
    "pr.f.physiorehab": { en: "Physio & Rehab Planner", es: "Fisio y Rehab Planner", pt: "Fisio e Rehab Planner" },
    "pr.f.matchlineup": { en: "Match reports & lineup", es: "Reportes de partido y alineación", pt: "Relatórios de jogo e escalação" },
    "pr.f.multistaff": { en: "Multi-staff & roles", es: "Multi-staff y roles", pt: "Multi-staff e funções" },
    "pr.f.nutrition": { en: "Nutrition module", es: "Módulo de nutrición", pt: "Módulo de nutrição" },
    "pr.f.videoroom": { en: "Video Room", es: "Video Room", pt: "Video Room" },
    "pr.mix.h3": { en: "Mix tiers across your categories.", es: "Combina planes entre tus categorías.", pt: "Combine planos entre suas categorias." },
    "pr.mix.p": { en: "You don't pay one fixed plan per club — each category picks its own tier. The Sub-14 stays free while the senior squad runs on Profesional. Your bill reflects exactly what each squad uses.", es: "No pagas un plan fijo por club — cada categoría elige su propio plan. La Sub-14 sigue gratis mientras la primera usa Profesional. Tu factura refleja exactamente lo que usa cada equipo.", pt: "Você não paga um plano fixo por clube — cada categoria escolhe seu próprio plano. O Sub-14 fica grátis enquanto o time principal usa o Profesional. Sua fatura reflete exatamente o que cada equipe usa." },
    "pr.mix.hint": { en: "Tap a tier to build your own mix.", es: "Tocá un tier para armar tu propia mezcla.", pt: "Toque em um nível para montar sua própria combinação." },
    "pr.cat.senior": { en: "Senior", es: "Primera", pt: "Principal" },
    "pr.cat.senior.sub": { en: "28 athletes · GPS · match analysis", es: "28 atletas · GPS · análisis de partido", pt: "28 atletas · GPS · análise de jogo" },
    "pr.cat.reserves": { en: "Reserves", es: "Reserva", pt: "Reservas" },
    "pr.cat.reserves.sub": { en: "22 athletes · GPS · load monitoring", es: "22 atletas · GPS · monitoreo de carga", pt: "22 atletas · GPS · monitoramento de carga" },
    "pr.cat.sub17.sub": { en: "24 athletes · CSV imports", es: "24 atletas · importación CSV", pt: "24 atletas · importação CSV" },
    "pr.cat.sub14.sub": { en: "14 athletes · RPE + wellness", es: "14 atletas · RPE + bienestar", pt: "14 atletas · RPE + bem-estar" },
    "pr.calc.total": { en: "Monthly total", es: "Total mensual", pt: "Total mensal" },
    "pr.calc.vs": { en: "vs $600+ flat-rate competitors", es: "vs $600+ de competidores con tarifa plana", pt: "vs $600+ de concorrentes com tarifa fixa" },
    "pr.cfg.add": { en: "Add category", es: "Agregar categoría", pt: "Adicionar categoria" },
    "pr.cfg.subtotal": { en: "Subtotal", es: "Subtotal", pt: "Subtotal" },
    "pr.cfg.discount": { en: "Volume discount", es: "Descuento por volumen", pt: "Desconto por volume" },
    "pr.cmp.h2": { en: "Compare features by tier", es: "Compara funciones por plan", pt: "Compare funcionalidades por plano" },
    "pr.cmp.sub": { en: "Everything in ClavaMetrics, mapped against the four category tiers.", es: "Todo lo de ClavaMetrics, mapeado contra los cuatro planes de categoría.", pt: "Tudo do ClavaMetrics, mapeado contra os quatro planos de categoria." },
    "pr.cmp.feature": { en: "Feature", es: "Función", pt: "Funcionalidade" },
    "pr.cmp.athletes": { en: "Athletes per category", es: "Atletas por categoría", pt: "Atletas por categoria" },
    "pr.cmp.seats": { en: "Staff seats", es: "Asientos de staff", pt: "Assentos de equipe" },
    "pr.cmp.micro": { en: "Microcycles & daily planner", es: "Microciclos y planificador diario", pt: "Microciclos e planejador diário" },
    "pr.cmp.sessions": { en: "Exercises Library", es: "Exercises Library", pt: "Exercises Library" },
    "pr.cmp.tactical": { en: "Tactical planner canvas", es: "Pizarra de planificación táctica", pt: "Quadro de planejamento tático" },
    "pr.cmp.rpe": { en: "RPE & wellness", es: "RPE y bienestar", pt: "RPE e bem-estar" },
    "pr.cmp.acwr": { en: "ACWR & load alerts", es: "ACWR y alertas de carga", pt: "ACWR e alertas de carga" },
    "pr.cmp.predictive": { en: "Predictive injury models", es: "Modelos predictivos de lesiones", pt: "Modelos preditivos de lesões" },
    "pr.cmp.csv": { en: "CSV imports", es: "Importaciones CSV", pt: "Importações CSV" },
    "pr.cmp.sync": { en: "Catapult / StatSports sync", es: "Sincronización Catapult / StatSports", pt: "Sincronização Catapult / StatSports" },
    "pr.cmp.support": { en: "Support", es: "Soporte", pt: "Suporte" },
    "pr.cmp.unlimited": { en: "Unlimited", es: "Ilimitado", pt: "Ilimitado" },
    "pr.cmp.basic": { en: "Basic", es: "Básico", pt: "Básico" },
    "pr.cmp.community": { en: "Community", es: "Comunidad", pt: "Comunidade" },
    "pr.cmp.email": { en: "Email", es: "Email", pt: "Email" },
    "pr.cmp.prioemail": { en: "Priority email", es: "Email prioritario", pt: "Email prioritário" },
    "pr.cmp.g.limits": { en: "Limits", es: "Límites", pt: "Limites" },
    "pr.cmp.g.planning": { en: "Planning", es: "Planificación", pt: "Planejamento" },
    "pr.cmp.g.perf": { en: "Performance & load", es: "Rendimiento y carga", pt: "Desempenho e carga" },
    "pr.cmp.g.health": { en: "Health", es: "Salud", pt: "Saúde" },
    "pr.cmp.g.collab": { en: "Collaboration", es: "Colaboración", pt: "Colaboração" },
    "pr.cmp.g.support": { en: "Support", es: "Soporte", pt: "Suporte" },
    "pr.cmp.roster": { en: "Roster & availability", es: "Plantel y disponibilidad", pt: "Elenco e disponibilidade" },
    "pr.cmp.daily": { en: "Daily planning & calendar", es: "Planificación diaria y calendario", pt: "Planejamento diário e calendário" },
    "pr.cmp.exlib": { en: "Exercises Library", es: "Exercises Library", pt: "Exercises Library" },
    "pr.cmp.drill": { en: "Drill Designer", es: "Drill Designer", pt: "Drill Designer" },
    "pr.cmp.annual": { en: "Annual Planner", es: "Annual Planner", pt: "Annual Planner" },
    "pr.cmp.individual": { en: "Individual Planner", es: "Individual Planner", pt: "Individual Planner" },
    "pr.cmp.wellanalysis": { en: "Wellness analysis & trends", es: "Análisis y tendencias de bienestar", pt: "Análise e tendências de bem-estar" },
    "pr.cmp.gps": { en: "GPS Analysis (CSV)", es: "GPS Analysis (CSV)", pt: "GPS Analysis (CSV)" },
    "pr.cmp.gym": { en: "Gym (planner + library)", es: "Gimnasio (planner + librería)", pt: "Academia (planner + biblioteca)" },
    "pr.cmp.loadmon": { en: "Load Monitor (ACWR · CTL/ATL/TSB)", es: "Load Monitor (ACWR · CTL/ATL/TSB)", pt: "Load Monitor (ACWR · CTL/ATL/TSB)" },
    "pr.cmp.matchlineup": { en: "Match reports & lineup", es: "Reportes de partido y alineación", pt: "Relatórios de jogo e escalação" },
    "pr.cmp.treatments": { en: "Treatments (physio log)", es: "Tratamientos (registro fisio)", pt: "Tratamentos (registro fisio)" },
    "pr.cmp.evalinj": { en: "Evaluations & injuries", es: "Evaluaciones y lesiones", pt: "Avaliações e lesões" },
    "pr.cmp.rehab": { en: "Rehab Planner", es: "Rehab Planner", pt: "Rehab Planner" },
    "pr.cmp.nutrition": { en: "Nutrition", es: "Nutrición", pt: "Nutrição" },
    "pr.cmp.video": { en: "Video Room", es: "Video Room", pt: "Video Room" },
    "pr.cmp.multistaff": { en: "Multi-staff & roles", es: "Multi-staff y roles", pt: "Multi-staff e funções" },
    "pr.cmp.sla": { en: "SLA + Slack", es: "SLA + Slack", pt: "SLA + Slack" },
    "pr.ent.eyebrow": { en: "Enterprise & federations", es: "Enterprise y federaciones", pt: "Enterprise e federações" },
    "pr.ent.h3": { en: "Running <em>10+ categories</em> or a national federation?", es: "¿Manejas <em>10+ categorías</em> o una federación nacional?", pt: "Gerencia <em>10+ categorias</em> ou uma federação nacional?" },
    "pr.ent.p": { en: "Custom contracts for clubs and federations with multi-tenant needs, on-prem data residency, SSO/SAML, and dedicated onboarding. Volume pricing applies after 10 paid categories.", es: "Contratos a medida para clubes y federaciones con necesidades multi-tenant, residencia de datos on-prem, SSO/SAML y onboarding dedicado. Precio por volumen a partir de 10 categorías pagas.", pt: "Contratos sob medida para clubes e federações com necessidades multi-tenant, residência de dados on-prem, SSO/SAML e onboarding dedicado. Preço por volume a partir de 10 categorias pagas." },
    "pr.ent.regions": { en: "EU & LATAM regions", es: "Regiones EU y LATAM", pt: "Regiões EU e LATAM" },
    "pr.ent.api": { en: "API access", es: "Acceso API", pt: "Acesso API" },
    "pr.ent.dpa": { en: "Custom DPA", es: "DPA a medida", pt: "DPA sob medida" },
    "pr.ent.org": { en: "Organization", es: "Organización", pt: "Organização" },
    "pr.ent.cats": { en: "Categories", es: "Categorías", pt: "Categorias" },
    "pr.ent.ph.org": { en: "Club name or federation", es: "Nombre del club o federación", pt: "Nome do clube ou federação" },
    "pr.ent.opt1": { en: "10–20 categories", es: "10–20 categorías", pt: "10–20 categorias" },
    "pr.ent.opt2": { en: "20–50 categories", es: "20–50 categorías", pt: "20–50 categorias" },
    "pr.ent.opt3": { en: "50+ categories", es: "50+ categorías", pt: "50+ categorias" },
    "pr.ent.opt4": { en: "National federation", es: "Federación nacional", pt: "Federação nacional" },
    "pr.ent.talk": { en: "Talk to sales", es: "Hablar con ventas", pt: "Falar com vendas" },
    "pr.ent.meta": { en: "Avg. response · under 24h", es: "Respuesta promedio · menos de 24h", pt: "Resposta média · menos de 24h" },
    "pr.faq.q1": { en: "How does per-category pricing actually work?", es: "¿Cómo funciona el precio por categoría?", pt: "Como funciona o preço por categoria?" },
    "pr.faq.a1": { en: "You register one club workspace, then assign a tier to each category from the Admin panel. The Sub-14 can stay on Iniciación (free) while the senior squad runs on Profesional. You only pay for the categories that need paid features, billed monthly or annually as one consolidated invoice.", es: "Registras un espacio de club y después asignas un plan a cada categoría desde el panel de Admin. La Sub-14 puede quedar en Iniciación (gratis) mientras la primera usa Profesional. Solo pagas por las categorías que necesitan funciones pagas, facturadas mensual o anualmente en una factura consolidada.", pt: "Você registra um espaço de clube e depois atribui um plano a cada categoria pelo painel de Admin. O Sub-14 pode ficar no Iniciación (grátis) enquanto o time principal usa o Profesional. Você só paga pelas categorias que precisam de recursos pagos, faturadas mensal ou anualmente numa fatura consolidada." },
    "pr.faq.q2": { en: "Can I change a category's tier mid-month?", es: "¿Puedo cambiar el plan de una categoría a mitad de mes?", pt: "Posso mudar o plano de uma categoria no meio do mês?" },
    "pr.faq.a2": { en: "Yes. Upgrades take effect immediately and are prorated to the day. Downgrades take effect at the end of the current billing period — no data is lost, the affected features simply become read-only until you re-upgrade.", es: "Sí. Las mejoras se aplican al instante y se prorratean al día. Las bajas de plan se aplican al final del período de facturación actual — no se pierde nada, las funciones afectadas quedan en solo lectura hasta que vuelvas a subir de plan.", pt: "Sim. Os upgrades entram em vigor na hora e são rateados por dia. Os downgrades entram no fim do período de faturamento atual — nada se perde, os recursos afetados ficam apenas em leitura até você fazer upgrade de novo." },
    "pr.faq.q3": { en: "Do you offer a free trial?", es: "¿Ofrecen prueba gratis?", pt: "Vocês oferecem teste grátis?" },
    "pr.faq.a3": { en: "Every paid tier comes with a 14-day trial, no card required. The Iniciación tier is free forever for categories under 15 athletes.", es: "Cada plan pago incluye 14 días de prueba, sin tarjeta. El plan Iniciación es gratis para siempre para categorías de menos de 15 atletas.", pt: "Cada plano pago inclui 14 dias de teste, sem cartão. O plano Iniciación é grátis para sempre para categorias com menos de 15 atletas." },
    "pr.faq.q4": { en: "What happens to my data if I cancel?", es: "¿Qué pasa con mis datos si cancelo?", pt: "O que acontece com meus dados se eu cancelar?" },
    "pr.faq.a4": { en: "Your data stays available for 90 days in read-only mode after cancellation. You can export anything (CSV, JSON, full backup) at any time from the Admin panel. After 90 days the workspace is permanently deleted.", es: "Tus datos quedan disponibles 90 días en modo solo lectura después de cancelar. Puedes exportar todo (CSV, JSON, backup completo) en cualquier momento desde el panel de Admin. Pasados los 90 días, el espacio se elimina de forma permanente.", pt: "Seus dados ficam disponíveis por 90 dias em modo somente leitura após o cancelamento. Você pode exportar tudo (CSV, JSON, backup completo) a qualquer momento pelo painel de Admin. Depois de 90 dias, o espaço é excluído permanentemente." },
    "pr.faq.q5": { en: "How do I get my GPS data into ClavaMetrics?", es: "¿Cómo subo mis datos de GPS a ClavaMetrics?", pt: "Como envio meus dados de GPS para a ClavaMetrics?" },
    "pr.faq.a5": { en: "Export a CSV from your GPS or tracking provider and upload it — ClavaMetrics turns it into dashboards and analysis. CSV import is available from the Básico tier up.", es: "Exportá un CSV desde tu proveedor de GPS o tracking y subilo — ClavaMetrics lo convierte en dashboards y análisis. La importación CSV está disponible desde el plan Básico.", pt: "Exporte um CSV do seu provedor de GPS ou tracking e faça upload — a ClavaMetrics o transforma em dashboards e análises. A importação CSV está disponível a partir do plano Básico." },
    "pr.faq.q6": { en: "How is billing handled?", es: "¿Cómo se maneja la facturación?", pt: "Como funciona o faturamento?" },
    "pr.faq.a6": { en: "One consolidated invoice per club, monthly or annual. We accept credit card, ACH (US), SEPA (EU) and bank transfer for annual contracts over $5K. All invoices are available in the Billing dashboard.", es: "Una factura consolidada por club, mensual o anual. Aceptamos tarjeta de crédito, ACH (US), SEPA (EU) y transferencia bancaria para contratos anuales de más de $5K. Todas las facturas están en el panel de Facturación.", pt: "Uma fatura consolidada por clube, mensal ou anual. Aceitamos cartão de crédito, ACH (US), SEPA (EU) e transferência bancária para contratos anuais acima de $5K. Todas as faturas ficam no painel de Faturamento." }
  };

  function detect() {
    try {
      var saved = localStorage.getItem("cm_lang");
      if (saved && LANGS.indexOf(saved) !== -1) return saved;
    } catch (e) {}
    var navs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || "en"];
    for (var i = 0; i < navs.length; i++) {
      var code = (navs[i] || "").toLowerCase();
      if (code.indexOf("es") === 0) return "es";
      if (code.indexOf("pt") === 0) return "pt";
    }
    return "en";
  }

  var current = detect();

  function t(key) {
    var e = DICT[key];
    if (!e) return null;
    return (e[current] != null) ? e[current] : e.en;
  }

  function apply() {
    document.documentElement.setAttribute("lang", current);

    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) {
      var v = t(els[i].getAttribute("data-i18n"));
      if (v != null) els[i].textContent = v;
    }
    // Elements whose translation contains inline markup (<strong>, <em>, ...)
    var htmls = document.querySelectorAll("[data-i18n-html]");
    for (var h = 0; h < htmls.length; h++) {
      var hv = t(htmls[h].getAttribute("data-i18n-html"));
      if (hv != null) htmls[h].innerHTML = hv;
    }
    var phs = document.querySelectorAll("[data-i18n-ph]");
    for (var j = 0; j < phs.length; j++) {
      var pv = t(phs[j].getAttribute("data-i18n-ph"));
      if (pv != null) phs[j].setAttribute("placeholder", pv);
    }

    var cur = document.querySelector(".mk-lang .lang-cur");
    if (cur) cur.textContent = LABEL[current];

    // Rotator: set first translated word + restart
    api.rotator = ROTATOR[current] || ROTATOR.en;
    var rot = document.getElementById("rotator");
    if (rot) rot.innerHTML = "<span>" + api.rotator[0] + "</span>";
    if (typeof window.__startRotator === "function") window.__startRotator();

    // How-it-works tabs: expose translated data + re-render active tab
    api.how = HOW[current] || HOW.en;
    if (typeof window.__renderHow === "function") window.__renderHow();
  }

  function setLang(l) {
    if (LANGS.indexOf(l) === -1) return;
    current = l;
    try { localStorage.setItem("cm_lang", l); } catch (e) {}
    apply();
  }

  var api = {
    setLang: setLang,
    t: t,
    rotator: ROTATOR[current] || ROTATOR.en,
    how: HOW[current] || HOW.en,
    get current() { return current; }
  };
  window.CM_I18N = api;

  function injectStyles() {
    if (document.getElementById("cm-i18n-style")) return;
    var s = document.createElement("style");
    s.id = "cm-i18n-style";
    s.textContent =
      ".mk-lang{cursor:pointer;}" +
      ".mk-lang-menu{display:none;position:fixed;z-index:2000;min-width:148px;background:var(--cm-surface,#fff);" +
      "border:1px solid var(--cm-border,#e3e8e5);border-radius:12px;box-shadow:var(--cm-shadow-3,0 18px 40px -12px rgba(0,0,0,.25));" +
      "padding:6px;}" +
      ".mk-lang-menu.open{display:block;}" +
      ".mk-lang-menu button{display:flex;width:100%;align-items:center;gap:8px;background:transparent;border:0;cursor:pointer;" +
      "text-align:left;padding:9px 10px;border-radius:8px;font:500 13px/1 var(--cm-font-sans,system-ui);color:var(--cm-fg,#1a201d);}" +
      ".mk-lang-menu button:hover{background:var(--cm-bg-soft,#f3f6f4);}" +
      ".mk-lang-menu button.is-on{color:var(--cm-accent,#15803d);font-weight:600;}";
    document.head.appendChild(s);
  }

  function wireButton() {
    var btn = document.querySelector(".mk-lang");
    if (!btn) return;
    btn.innerHTML = '<span class="lang-cur">' + LABEL[current] + '</span><i class="ti ti-chevron-down"></i>';

    var menu = document.querySelector(".mk-lang-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "mk-lang-menu";
      var html = "";
      for (var i = 0; i < LANGS.length; i++) {
        var l = LANGS[i];
        html += '<button type="button" data-lang="' + l + '"' + (l === current ? ' class="is-on"' : "") + ">" + LABEL[l] + " · " + NAME[l] + "</button>";
      }
      menu.innerHTML = html;
      document.body.appendChild(menu);
    }

    function place() {
      var r = btn.getBoundingClientRect();
      menu.style.top = (r.bottom + 6) + "px";
      menu.style.right = (window.innerWidth - r.right) + "px";
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      place();
      menu.classList.toggle("open");
    });
    menu.addEventListener("click", function (e) {
      var b = e.target.closest("[data-lang]");
      if (!b) return;
      setLang(b.getAttribute("data-lang"));
      var items = menu.querySelectorAll("[data-lang]");
      for (var k = 0; k < items.length; k++) items[k].classList.toggle("is-on", items[k].getAttribute("data-lang") === current);
      menu.classList.remove("open");
    });
    document.addEventListener("click", function () { menu.classList.remove("open"); });
    window.addEventListener("resize", function () { menu.classList.remove("open"); });
  }

  function init() {
    injectStyles();
    wireButton();
    apply();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
