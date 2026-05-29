import { BaseCard } from './base-card.js';
import { formatValue } from './card-utils.js';

export class RankingCard extends BaseCard {
  _buildBody() {
    const c    = this.config;
    const data = (c.data || []).slice(0, c.limit || 10);
    if (!data.length) return this._emptyState();

    const maxVal = data[0]?.max ?? data[0]?.value ?? 1;
    const div    = document.createElement('div');
    div.className = 'gp-rank';

    data.forEach((row, idx) => {
      const pct  = maxVal ? (row.value / maxVal) * 100 : 0;
      const fmtd = formatValue(row.value, c.format, c.decimals ?? 0);
      const highlight = idx < (c.highlightTop || 3) ? 'top' : '';
      const el = document.createElement('div');
      el.className = `gp-rank-row${highlight ? ' gp-rank-top' : ''}`;
      el.dataset.playerId = row.player_id || '';
      el.innerHTML = `
        <span class="gp-rank-pos">${idx + 1}</span>
        <div class="gp-rank-bar">
          <div class="gp-rank-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <span class="gp-rank-name">${row.name}${row.number != null ? ` · #${row.number}` : ''}</span>
        <span class="gp-rank-val">${fmtd}${c.unit ? ' ' + c.unit : ''}</span>`;

      if (c.onRowClick) {
        this._on(el, 'click', () => c.onRowClick(row.player_id));
        el.style.cursor = 'pointer';
      }
      div.appendChild(el);
    });

    return div;
  }

  update({ data } = {}) {
    if (data) this.config.data = data;
    const body = this._el?.querySelector('.gp-c-b');
    if (body) {
      body.innerHTML = '';
      body.appendChild(this._buildBody());
    }
  }
}
