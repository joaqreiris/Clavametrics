/* =============================================================
   GPS Analysis — "Agregar gráfico" panel (Section 7) renderer.
   Visual reference: evidence-template path (default) with the
   scientific gallery + one open reference popover, plus the
   custom path state. No data logic.
   ============================================================= */
(function () {
  'use strict';

  /* =============================================================
     PLANTILLAS CIENTÍFICAS  ·  EDITÁ SOLO ESTE ARRAY
     -------------------------------------------------------------
     Para AGREGAR un gráfico nuevo con info científica: copiá el
     bloque modelo de abajo, pegalo dentro de TPLS y completá los
     campos. No hace falta tocar nada más — el render, la grilla,
     las pills de cita y el popover se arman solos.

     Esquema de cada plantilla:
       id      {string}  identificador único (slug, sin espacios)
       nm      {string}  nombre visible de la card
       ds      {string}  descripción de 1 línea
       cite    {string}  texto de la pill de cita (ej. 'Gabbett 2016')
       type    {string}  tipo de gráfico que genera (texto del pie)
       icon    {string}  ícono Tabler, prefijo 'ti-' (ver nota *)
       color   {string}  color del ícono: token --cm-* o cualquier CSS
       info    {string}  etiqueta gris de contexto (solo informativa)
       demoOpen{bool}    OPCIONAL: true muestra el popover de
                         referencia abierto en esta card (solo 1)
       ref     {object}  contenido del popover científico:
         title  {string}  título de la referencia
         author {string}  autor · publicación · año
         body   {string}  explicación breve (2–3 frases)
         doi    {string}  DOI o '—' si no aplica

     (*) NOTA íconos: en producción funciona cualquier ícono Tabler
         (https://tabler.io/icons). En esta página de referencia, si
         el nombre no está en ref-icons.js se dibuja un punto neutro
         como fallback — agregá el path a ref-icons.js si querés que
         se vea idéntico acá también.

     ---- MODELO PARA COPIAR (descomentá y completá) -------------
     {
       id: 'mi-grafico',
       nm: 'Nombre del gráfico',
       ds: 'Qué muestra, en una línea.',
       cite: 'Autor AÑO', type: 'Línea + banda',
       icon: 'ti-chart-line', color: 'var(--cm-info)',
       info: 'suele usarse en …',
       demoOpen: false,
       ref: {
         title: 'Título de la referencia',
         author: 'Apellido, X. (AÑO) · Publicación',
         body: 'Explicación breve del método y cómo se lee.',
         doi: '10.xxxx/xxxxx',
       },
     },
     ============================================================= */
  const TPLS = [
    {
      id: 'acwr', nm: 'ACWR — Carga aguda:crónica', demoOpen: true,
      ds: 'Ratio de carga aguda (7d) sobre crónica (28d) con zona de seguridad.',
      cite: 'Gabbett 2016', type: 'Línea + banda', icon: 'ti-activity-heartbeat', color: 'var(--cm-accent)',
      info: 'suele usarse en cargas',
      ref: { title: 'Acute:Chronic Workload Ratio', author: 'Gabbett, T. (2016) · Br J Sports Med',
        body: 'Relaciona la carga reciente (aguda, ~7 días) con la habitual (crónica, ~28 días). Valores entre 0.8 y 1.3 se asocian a menor riesgo de lesión; picos por encima de 1.5 elevan el riesgo.',
        doi: '10.1136/bjsports-2015-095788' },
    },
    {
      id: 'monotony', nm: 'Monotonía / Strain',
      ds: 'Monotonía (media/SD diaria) y strain semanal del método de Foster.',
      cite: 'Foster 1998', type: 'Barras + KPI', icon: 'ti-wave-sine', color: 'var(--cm-info)',
      info: 'suele usarse en cargas',
      ref: { title: 'Training Monotony & Strain', author: 'Foster, C. (1998) · Med Sci Sports Exerc',
        body: 'La monotonía es la media de la carga diaria dividida por su desvío. El strain multiplica la carga semanal por la monotonía. Monotonía alta sostenida se vincula a estancamiento y enfermedad.',
        doi: '10.1097/00005768-199807000-00023' },
    },
    {
      id: 'ff', nm: 'Fitness · Fatiga · Forma',
      ds: 'Modelo CTL / ATL / TSB para leer condición y frescura.',
      cite: 'Banister', type: 'Multi-línea', icon: 'ti-chart-line', color: 'var(--cm-violet)',
      info: 'suele usarse en planificación',
      ref: { title: 'Modelo Fitness-Fatiga (CTL/ATL/TSB)', author: 'Banister, E. (1991) · impulse-response',
        body: 'CTL (fitness) es la carga crónica; ATL (fatiga) la aguda; TSB (forma) es su diferencia. TSB positivo indica frescura; muy negativo, fatiga acumulada.',
        doi: '—' },
    },
    {
      id: 'zones', nm: 'Zonas de velocidad',
      ds: 'Distancia por umbral de velocidad (caminata → sprint).',
      cite: 'Dwyer 2012', type: 'Barras apiladas', icon: 'ti-stack-2', color: 'var(--cm-success)',
      info: 'suele usarse en GPS',
      ref: { title: 'Speed Zone Distribution', author: 'Dwyer & Gabbett (2012) · J Strength Cond Res',
        body: 'Reparte la distancia recorrida en umbrales de velocidad. Permite separar volumen de baja intensidad del trabajo de alta velocidad y sprint, clave para dosificar exposición.',
        doi: '10.1519/JSC.0b013e318236a3d2' },
    },
    {
      id: 'zscore', nm: 'Outliers z-score',
      ds: 'Desvíos del jugador respecto a su propia media (±z).',
      cite: 'z-score', type: 'Scatter + ref', icon: 'ti-chart-dots', color: 'var(--cm-warning)',
      info: 'suele usarse en monitoreo',
      ref: { title: 'Desvío estandarizado (z-score)', author: 'Estadística estándar',
        body: 'Expresa cuántos desvíos típicos se aleja un valor de la media del propio jugador. |z| ≥ 2 marca sesiones atípicas que conviene revisar (carga inusual o error de dato).',
        doi: '—' },
    },
    {
      id: 'variation', nm: 'Variación vs equivalentes',
      ds: 'Compara al jugador contra su grupo de posición o rol.',
      cite: 'Benchmark', type: 'Barras + Δ', icon: 'ti-arrows-diff', color: 'var(--cm-neutral)',
      info: 'suele usarse en comparativas',
      ref: { title: 'Comparación con equivalentes', author: 'Benchmark posicional',
        body: 'Sitúa la métrica del jugador frente a la mediana de jugadores de su misma posición o rol, mostrando el delta. Útil para detectar quién carga por encima o debajo de su grupo.',
        doi: '—' },
    },
  ];

  function tplCard(t, popOpen) {
    const help = `<button class="ac-help" title="Ver referencia científica"><i class="ti ti-help"></i></button>`;
    const pop = popOpen ? `<div class="ac-refpop">
        <div class="ac-refpop-h"><span class="ic"><i class="ti ti-book"></i></span>
          <span class="m"><span class="t">${t.ref.title}</span><span class="a">${t.ref.author}</span></span></div>
        <div class="ac-refpop-b"><p>${t.ref.body}</p>
          <span class="doi"><i class="ti ti-link"></i>DOI <a href="#">${t.ref.doi}</a></span></div>
      </div>` : '';
    return `<div class="ac-tpl${popOpen ? ' has-pop' : ''}">
        <div class="ac-tpl-top">
          <span class="spark" style="background:color-mix(in srgb, ${t.color} 14%, var(--cm-surface)); color:${t.color}"><i class="ti ${t.icon}"></i></span>
          <span class="nm">${t.nm}</span>
          ${help}
        </div>
        <div class="ds">${t.ds}</div>
        <div class="ac-tpl-tags">
          <span class="ac-cite"><i class="ti ti-quote"></i>${t.cite}</span>
          <span class="ac-info"><i class="ti ti-info-circle"></i>${t.info}</span>
        </div>
        <div class="ac-tpl-foot">
          <span class="type"><i class="ti ti-chart-histogram"></i>${t.type}</span>
          <button class="ac-add"><i class="ti ti-plus"></i>Agregar</button>
        </div>
        ${pop}
      </div>`;
  }

  /* ---------- path cards ---------- */
  function pathCard(o) {
    return `<button class="ac-path${o.on ? ' is-on' : ''}">
        <span class="pic"><i class="ti ${o.icon}"></i></span>
        <span class="pbody">
          <span class="nm">${o.nm}${o.badge ? `<span class="badge">${o.badge}</span>` : ''}</span>
          <span class="ds">${o.ds}</span>
        </span>
        <span class="tick"><i class="ti ti-check"></i></span>
      </button>`;
  }

  function header() {
    return `<div class="ac-head">
        <span class="ic"><i class="ti ti-chart-histogram"></i></span>
        <span class="tt">
          <h2>Agregar gráfico</h2>
          <span class="sub"><i class="ti ti-layout-dashboard"></i>al dashboard · <b>Load Monitoring</b></span>
        </span>
        <button class="ac-x"><i class="ti ti-x"></i></button>
      </div>`;
  }

  function paths(active) {
    return `<div class="ac-paths">
        ${pathCard({ icon: 'ti-flask', nm: 'Plantilla basada en evidencia', badge: 'recomendado', ds: 'Cards listas, validadas científicamente.', on: active === 'tpl' })}
        ${pathCard({ icon: 'ti-adjustments-alt', nm: 'Crear a medida', ds: 'Elegí métricas, tipo y agregación · abre el Chart builder.', on: active === 'custom' })}
      </div>`;
  }

  /* ---------- evidence panel (default) ---------- */
  function evidencePanel() {
    // demoOpen marca qué card muestra el popover de referencia abierto
    // (solo para la página de referencia). Si ninguna lo trae, abre la 1ª.
    const hasFlag = TPLS.some(t => t.demoOpen);
    const cards = TPLS.map((t, i) => tplCard(t, hasFlag ? !!t.demoOpen : i === 0)).join('');
    return `<div class="ac-panel">
        ${header()}
        ${paths('tpl')}
        <div class="ac-gallery">
          <div class="ac-gallery-h">
            <span class="t">Plantillas</span><span class="n">${TPLS.length}</span>
            <span class="all"><i class="ti ti-circle-check"></i>Todas se pueden agregar a cualquier dashboard</span>
          </div>
          <div class="ac-grid">${cards}</div>
        </div>
        <div class="ac-foot">
          <span class="hint"><i class="ti ti-bulb"></i>Las plantillas traen métricas, tipo y umbrales ya configurados.</span>
          <span class="btns"><button class="ac-btn-ghost">Cancelar</button></span>
        </div>
      </div>`;
  }

  /* ---------- custom panel (other path active) ---------- */
  function customPanel() {
    return `<div class="ac-panel" style="width:600px">
        ${header()}
        ${paths('custom')}
        <div class="ac-custom">
          <span class="ic"><i class="ti ti-adjustments-alt"></i></span>
          <span class="t">Crear a medida</span>
          <span class="d">Elegí las métricas, el tipo de gráfico y la agregación. Se abre el Chart builder con un lienzo en blanco.</span>
          <button class="go"><i class="ti ti-arrow-right"></i>Abrir Chart builder</button>
        </div>
        <div class="ac-foot">
          <span class="hint"><i class="ti ti-bulb"></i>¿No sabés por dónde empezar? Probá una plantilla basada en evidencia.</span>
          <span class="btns"><button class="ac-btn-ghost">Cancelar</button></span>
        </div>
      </div>`;
  }

  function stage(inner) {
    const ph = Array.from({ length: 6 }).map(() => '<div class="gp-c"></div>').join('');
    return `<div class="ac-stage">
        <div class="ac-stage-dash">${ph}</div>
        <div class="ac-stage-scrim"></div>
        <div class="ac-stage-inner">${inner}</div>
      </div>`;
  }

  function build(root) {
    const blockA = `<div class="ref-block">
        <div class="ref-block-h"><span class="t">Panel · plantilla basada en evidencia</span><span class="d">estado por defecto · galería abierta</span>
          <span class="note"><i class="ti ti-flask"></i>Dos caminos arriba · galería con citas + popover de referencia</span></div>
        ${stage(evidencePanel())}
      </div>`;

    const blockB = `<div class="ref-block">
        <div class="ref-block-h"><span class="t">Panel · crear a medida</span><span class="d">segundo camino activo</span>
          <span class="note"><i class="ti ti-adjustments-alt"></i>Deriva al Chart builder con lienzo en blanco</span></div>
        ${stage(customPanel())}
      </div>`;

    root.innerHTML = blockA + blockB;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('addChartSection');
    if (root) build(root);
  });
})();
