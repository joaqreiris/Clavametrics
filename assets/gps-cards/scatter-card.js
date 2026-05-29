import { BaseCard } from './base-card.js';
import { formatValue } from './card-utils.js';

export class ScatterCard extends BaseCard {
  _buildBody() {
    const c    = this.config;
    const data = c.data || [];
    if (!data.length) return this._emptyState();

    const W = 480, H = 240, PL = 52, PR = 16, PT = 16, PB = 40;
    const iW = W - PL - PR, iH = H - PT - PB;

    const xs = data.map(d => d.x), ys = data.map(d => d.y);
    const xMin = c.xAxis?.min ?? Math.min(...xs), xMax = c.xAxis?.max ?? Math.max(...xs);
    const yMin = c.yAxis?.min ?? Math.min(...ys), yMax = c.yAxis?.max ?? Math.max(...ys);
    const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1;

    const px = x => PL + ((x - xMin) / xRange) * iW;
    const py = y => PT + iH - ((y - yMin) / yRange) * iH;

    const avgX = xs.reduce((s, v) => s + v, 0) / xs.length;
    const avgY = ys.reduce((s, v) => s + v, 0) / ys.length;

    const GRID_LINES = 4;
    let gridH = '', gridV = '';
    for (let i = 0; i <= GRID_LINES; i++) {
      const ratio = i / GRID_LINES;
      const gx = PL + ratio * iW, gy = PT + ratio * iH;
      gridV += `<line x1="${gx.toFixed(1)}" y1="${PT}" x2="${gx.toFixed(1)}" y2="${PT + iH}" stroke="var(--cm-border-soft)" stroke-width="1"/>`;
      gridH += `<line x1="${PL}" y1="${gy.toFixed(1)}" x2="${PL + iW}" y2="${gy.toFixed(1)}" stroke="var(--cm-border-soft)" stroke-width="1"/>`;
    }

    const points = data.map(d => {
      const cx = px(d.x).toFixed(1), cy = py(d.y).toFixed(1);
      const lbl = d.label || d.name || '';
      return `<g class="gp-scatter-pt" data-player-id="${d.player_id || ''}" style="cursor:${c.onPointClick ? 'pointer' : 'default'}">
        <circle cx="${cx}" cy="${cy}" r="8" fill="var(--cm-accent)" opacity="0.85"/>
        ${lbl ? `<text x="${cx}" y="${(parseFloat(cy) + 4).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">${lbl.substring(0, 3)}</text>` : ''}
      </g>`;
    }).join('');

    const xLabel = c.xAxis?.label || '';
    const yLabel = c.yAxis?.label || '';
    const avgXpx = px(avgX).toFixed(1);
    const avgYpx = py(avgY).toFixed(1);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.classList.add('gp-scatter-svg');
    svg.innerHTML = `
      <g>${gridH}${gridV}</g>
      ${c.showAverages ? `
        <line x1="${avgXpx}" y1="${PT}" x2="${avgXpx}" y2="${PT + iH}" stroke="var(--cm-border-strong)" stroke-width="1" stroke-dasharray="4 3"/>
        <line x1="${PL}" y1="${avgYpx}" x2="${PL + iW}" y2="${avgYpx}" stroke="var(--cm-border-strong)" stroke-width="1" stroke-dasharray="4 3"/>
      ` : ''}
      <text x="${PL + iW / 2}" y="${H - 6}" text-anchor="middle" font-size="9" fill="var(--cm-fg-muted)">${xLabel}</text>
      <text x="10" y="${PT + iH / 2}" text-anchor="middle" font-size="9" fill="var(--cm-fg-muted)" transform="rotate(-90,10,${PT + iH / 2})">${yLabel}</text>
      <text x="${PL}" y="${H - 6}" font-size="8" fill="var(--cm-fg-muted)">${formatValue(xMin, c.xAxis?.format, 0)}</text>
      <text x="${PL + iW}" y="${H - 6}" text-anchor="end" font-size="8" fill="var(--cm-fg-muted)">${formatValue(xMax, c.xAxis?.format, 0)}</text>
      ${points}`;

    if (c.onPointClick) {
      svg.addEventListener('click', e => {
        const pt = e.target.closest('.gp-scatter-pt');
        if (pt?.dataset.playerId) c.onPointClick(pt.dataset.playerId);
      });
    }

    const div = document.createElement('div');
    div.style.overflowX = 'auto';
    div.appendChild(svg);
    return div;
  }

  update({ data } = {}) {
    if (data) this.config.data = data;
    const body = this._el?.querySelector('.gp-c-b');
    if (body) { body.innerHTML = ''; body.appendChild(this._buildBody()); }
  }
}
