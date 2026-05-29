import { BaseCard } from './base-card.js';
import { getDirectionIndicator } from './card-utils.js';

export class GaugeCard extends BaseCard {
  _buildBody() {
    const c     = this.config;
    const value = c.value ?? 0;
    const min   = c.min ?? 0;
    const max   = c.max ?? 2.0;
    const zones = c.zones || [
      { from: 0, to: 0.8,  color: 'var(--cm-info)',    label: 'Under-training' },
      { from: 0.8, to: 1.3, color: 'var(--cm-success)', label: 'Sweet spot' },
      { from: 1.3, to: 1.5, color: 'var(--cm-warning)', label: 'Caution' },
      { from: 1.5, to: 2.0, color: 'var(--cm-danger)',  label: 'High risk' },
    ];

    const R = 70, CX = 100, CY = 90;
    const toAngle = v => Math.PI + ((v - min) / (max - min)) * Math.PI;
    const arcPath = (fromV, toV, r) => {
      const a1 = toAngle(fromV), a2 = toAngle(toV);
      const x1 = CX + r * Math.cos(a1), y1 = CY + r * Math.sin(a1);
      const x2 = CX + r * Math.cos(a2), y2 = CY + r * Math.sin(a2);
      const large = (a2 - a1) > Math.PI ? 1 : 0;
      return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };

    const zoneArcs = zones.map(z => {
      const from = Math.max(z.from, min);
      const to   = Math.min(z.to, max);
      if (to <= from) return '';
      return `<path d="${arcPath(from, to, R)}" fill="none" stroke="${z.color}" stroke-width="18" stroke-linecap="butt"/>`;
    }).join('');

    const needleAngle = toAngle(Math.min(Math.max(value, min), max));
    const nx = CX + (R - 15) * Math.cos(needleAngle);
    const ny = CY + (R - 15) * Math.sin(needleAngle);

    const activeZone = zones.slice().reverse().find(z => value >= z.from) || zones[0];
    const dir = c.comparison ? getDirectionIndicator(value, c.comparison.value, 'lower_better') : null;

    const div = document.createElement('div');
    div.className = 'gp-gauge-body';
    div.innerHTML = `
      <svg viewBox="0 0 200 110" class="gp-gauge-svg" aria-label="${c.title}: ${value}">
        ${zoneArcs}
        <line x1="${CX}" y1="${CY}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--cm-fg-strong)" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${CX}" cy="${CY}" r="4" fill="var(--cm-fg-strong)"/>
        <text x="${CX}" y="${CY - 18}" text-anchor="middle" font-size="20" font-weight="700" fill="var(--cm-fg-strong)">${value.toFixed(2)}</text>
      </svg>
      <div class="gp-gauge-meta">
        <span class="gp-gauge-zone">${activeZone.label}</span>
        ${dir ? `<span class="gp-kpi-cmp gp-kpi-cmp--${dir.color}"><i class="ti ${dir.icon}"></i> ${dir.text}${c.comparison.label ? ' ' + c.comparison.label : ''}</span>` : ''}
        ${c.detail ? `<span class="gp-gauge-detail">Acute: ${c.detail.acute} · Chronic: ${c.detail.chronic}</span>` : ''}
      </div>`;
    return div;
  }

  update({ value, comparison, detail } = {}) {
    if (value !== undefined) this.config.value = value;
    if (comparison) this.config.comparison = comparison;
    if (detail) this.config.detail = detail;
    const body = this._el?.querySelector('.gp-c-b');
    if (body) { body.innerHTML = ''; body.appendChild(this._buildBody()); }
  }
}
