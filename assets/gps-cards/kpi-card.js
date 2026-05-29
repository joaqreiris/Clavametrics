import { BaseCard } from './base-card.js';
import { formatValue, getDirectionIndicator, buildSparklineSVG } from './card-utils.js';

export class KpiCard extends BaseCard {
  _buildBody() {
    const c = this.config;
    const fmtVal = formatValue(c.value, c.format, c.decimals ?? 0);
    const dir = c.comparison
      ? getDirectionIndicator(c.value, c.comparison.value, c.comparison.direction)
      : null;

    const div = document.createElement('div');
    div.className = 'gp-kpi-body';
    div.innerHTML = `
      <div class="gp-kpi-val">${fmtVal}</div>
      ${dir ? `
        <div class="gp-kpi-cmp gp-kpi-cmp--${dir.color}">
          <i class="ti ${dir.icon}"></i>
          ${dir.text}${c.comparison.label ? ` <span class="gp-kpi-cmp-lbl">${c.comparison.label}</span>` : ''}
        </div>` : ''}
      ${c.sparkline?.data ? buildSparklineSVG(c.sparkline.data) : ''}
      ${c.badge ? `<span class="gp-kpi-badge gp-kpi-badge--${c.badge}">${c.badge}</span>` : ''}`;
    return div;
  }

  update(newData) {
    Object.assign(this.config, newData);
    const body = this._el?.querySelector('.gp-c-b');
    if (body) {
      body.innerHTML = '';
      body.appendChild(this._buildBody());
    }
  }
}
