import { BaseCard } from './base-card.js';
import { formatValue, getDirectionIndicator } from './card-utils.js';

export class ComparisonCard extends BaseCard {
  _buildBody() {
    const c       = this.config;
    const metrics = c.metrics || [];
    if (!metrics.length) return this._emptyState();

    const div = document.createElement('div');
    div.className = 'gp-cmp-body';

    const header = document.createElement('div');
    header.className = 'gp-cmp-header';
    header.innerHTML = `
      <span>Metric</span>
      <span>Current</span>
      <span>Previous</span>
      <span>Diff</span>`;
    div.appendChild(header);

    metrics.forEach(m => {
      const dir = getDirectionIndicator(m.current, m.previous, m.direction || 'auto');
      const row = document.createElement('div');
      row.className = 'gp-cmp-row';
      row.innerHTML = `
        <span class="gp-cmp-label">${m.label}</span>
        <span class="gp-cmp-current">${formatValue(m.current, m.format, m.decimals ?? 0)}${m.unit ? ' ' + m.unit : ''}</span>
        <span class="gp-cmp-previous">${formatValue(m.previous, m.format, m.decimals ?? 0)}${m.unit ? ' ' + m.unit : ''}</span>
        <span class="gp-cmp-diff gp-kpi-cmp--${dir?.color || 'neutral'}">
          ${dir ? `<i class="ti ${dir.icon}"></i> ${dir.text}` : '—'}
        </span>`;
      div.appendChild(row);
    });

    return div;
  }

  update({ metrics } = {}) {
    if (metrics) this.config.metrics = metrics;
    const body = this._el?.querySelector('.gp-c-b');
    if (body) { body.innerHTML = ''; body.appendChild(this._buildBody()); }
  }
}
