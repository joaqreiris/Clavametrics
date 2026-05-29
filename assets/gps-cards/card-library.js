import { KpiCard }         from './kpi-card.js';
import { TableCard }       from './table-card.js';
import { ChartCard }       from './chart-card.js';
import { RankingCard }     from './ranking-card.js';
import { ScatterCard }     from './scatter-card.js';
import { GaugeCard }       from './gauge-card.js';
import { RadarCard }       from './radar-card.js';
import { TimelineCard }    from './timeline-card.js';
import { ComparisonCard }  from './comparison-card.js';

export const CARD_CLASSES = {
  kpi:        KpiCard,
  table:      TableCard,
  chart:      ChartCard,
  ranking:    RankingCard,
  scatter:    ScatterCard,
  gauge:      GaugeCard,
  radar:      RadarCard,
  timeline:   TimelineCard,
  comparison: ComparisonCard,
};

export const CARD_LIBRARY = {
  kpi: {
    label: 'KPI Card',
    description: 'Single metric value with comparison and sparkline',
    icon: 'ti-trending-up',
    defaultConfig: { size: 'M', format: 'distance' },
    compatibleWith: ['session_control', 'player_week', 'load_monitoring', 'match_performance', 'microcycle_compare'],
  },
  table: {
    label: 'Data Table',
    description: 'Tabular view with sort, search, and cell coloring',
    icon: 'ti-table',
    defaultConfig: { size: 'full' },
    compatibleWith: ['session_control', 'load_monitoring'],
  },
  ranking: {
    label: 'Squad Ranking',
    description: 'Horizontal bar ranking of players by metric',
    icon: 'ti-trophy',
    defaultConfig: { size: 'M', limit: 10 },
    compatibleWith: ['session_control', 'player_week', 'match_performance'],
  },
  scatter: {
    label: 'Scatter Plot',
    description: 'Two-axis scatter with configurable metrics',
    icon: 'ti-chart-dots',
    defaultConfig: { size: 'L' },
    compatibleWith: ['session_control', 'load_monitoring', 'microcycle_compare'],
  },
  gauge: {
    label: 'ACWR Gauge',
    description: 'Dial gauge for acute:chronic workload ratio',
    icon: 'ti-gauge',
    defaultConfig: { size: 'M' },
    compatibleWith: ['load_monitoring'],
  },
  radar: {
    label: 'Radar Profile',
    description: 'Z-score radar vs squad or personal baseline',
    icon: 'ti-radar',
    defaultConfig: { size: 'M' },
    compatibleWith: ['session_control', 'player_week', 'match_performance'],
  },
  timeline: {
    label: 'Timeline',
    description: 'Metric evolution over sessions with trend line',
    icon: 'ti-timeline',
    defaultConfig: { size: 'L' },
    compatibleWith: ['player_week', 'load_monitoring', 'match_performance', 'microcycle_compare'],
  },
  comparison: {
    label: 'Period Comparison',
    description: 'Side-by-side comparison of two time periods',
    icon: 'ti-arrows-diff',
    defaultConfig: { size: 'M' },
    compatibleWith: ['microcycle_compare', 'player_week'],
  },
  chart: {
    label: 'Chart',
    description: 'Generic Chart.js chart (bar, line, pie, etc.)',
    icon: 'ti-chart-bar',
    defaultConfig: { size: 'L', chartType: 'bar' },
    compatibleWith: ['session_control', 'player_week', 'load_monitoring', 'match_performance', 'microcycle_compare'],
  },
};

export function getAvailableCards(dashboardId) {
  return Object.entries(CARD_LIBRARY)
    .filter(([, card]) => card.compatibleWith.includes(dashboardId))
    .map(([type, card]) => ({ type, ...card }));
}

export function getCardClass(type) {
  return CARD_CLASSES[type] || null;
}

export function instantiateCard(cardConfig) {
  const Cls = getCardClass(cardConfig.type);
  if (!Cls) { console.warn('Unknown card type:', cardConfig.type); return null; }
  return new Cls({ ...cardConfig });
}

// ── Layout persistence helpers ────────────────────────────────────────────────

export async function loadLayout(dashboardId, userId, clubId) {
  const { data, error } = await window.sb
    .from('gps_dashboard_layouts')
    .select('layout')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .eq('dashboard_id', dashboardId)
    .maybeSingle();
  if (error) console.error('loadLayout:', error);
  return data?.layout || null;
}

export async function saveLayout(dashboardId, layout, userId, clubId) {
  const { error } = await window.sb
    .from('gps_dashboard_layouts')
    .upsert(
      { user_id: userId, club_id: clubId, dashboard_id: dashboardId, layout, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,club_id,dashboard_id' }
    );
  if (error) console.error('saveLayout:', error);
}

export function serializeCards(gridEl) {
  return [...gridEl.querySelectorAll('.gp-c')].map((el, idx) => {
    const cardId = el.dataset.cardId;
    return {
      card_id:  cardId,
      type:     el.dataset.type || '',
      size:     el.dataset.size || 'M',
      position: idx,
      config:   JSON.parse(el.dataset.config || '{}'),
    };
  });
}

// ── Drag & drop for a dashboard grid ─────────────────────────────────────────

export function initDragAndDrop(gridEl, onReorder) {
  let dragging = null;

  gridEl.addEventListener('dragstart', e => {
    dragging = e.target.closest('.gp-c');
    if (dragging) dragging.classList.add('is-dragging');
  });

  gridEl.addEventListener('dragend', () => {
    dragging?.classList.remove('is-dragging');
    dragging = null;
  });

  gridEl.addEventListener('dragover', e => {
    e.preventDefault();
    const target = e.target.closest('.gp-c');
    if (!target || target === dragging) return;
    const rect   = target.getBoundingClientRect();
    const after  = e.clientX > rect.left + rect.width / 2;
    target.after(after ? dragging : null);
    if (!after) target.before(dragging);
  });

  gridEl.addEventListener('drop', e => {
    e.preventDefault();
    if (onReorder) onReorder(serializeCards(gridEl));
  });
}

// ── "Add card" modal ─────────────────────────────────────────────────────────

export function openAddCardModal(dashboardId, onAdd) {
  const available = getAvailableCards(dashboardId);

  const overlay = document.createElement('div');
  overlay.className = 'gp-modal-overlay';
  overlay.innerHTML = `
    <div class="gp-modal" role="dialog" aria-modal="true">
      <div class="gp-modal-h">
        <span>Add a card</span>
        <button class="card-action gp-modal-close"><i class="ti ti-x"></i></button>
      </div>
      <div class="gp-modal-body gp-add-card-grid">
        ${available.map(c => `
          <button class="gp-add-card-item" data-type="${c.type}">
            <i class="ti ${c.icon}"></i>
            <span class="name">${c.label}</span>
            <span class="desc">${c.description}</span>
          </button>`).join('')}
      </div>
    </div>`;

  overlay.querySelector('.gp-modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelectorAll('.gp-add-card-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const type       = btn.dataset.type;
      const libEntry   = CARD_LIBRARY[type];
      const cardConfig = { ...(libEntry?.defaultConfig || {}), type, cardId: type + '_' + Date.now() };
      onAdd(cardConfig);
      overlay.remove();
    });
  });

  document.body.appendChild(overlay);
}
