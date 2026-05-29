import { BaseCard } from './base-card.js';

export const CHART_COLORS = {
  primary:   'var(--cm-accent)',
  secondary: 'var(--cm-info)',
  success:   'var(--cm-success)',
  warning:   'var(--cm-warning)',
  danger:    'var(--cm-danger)',
  neutral:   'var(--cm-fg-muted)',
};

export class ChartCard extends BaseCard {
  _buildBody() {
    const div = document.createElement('div');
    div.style.cssText = `position:relative;height:${this.config.height || 240}px`;
    const canvas = document.createElement('canvas');
    canvas.id = 'chart-' + this.id;
    div.appendChild(canvas);
    this._canvas = canvas;
    return div;
  }

  _afterRender() {
    if (typeof Chart === 'undefined') {
      console.warn('ChartCard: Chart.js not loaded');
      return;
    }
    const { chartType, data, options } = this.config;
    this._chart = new Chart(this._canvas, {
      type: chartType || 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...(options || {}),
        onClick: (evt, items) => {
          if (this.config.onClick && items.length) {
            this.config.onClick(items[0].index, items[0].datasetIndex);
          }
        },
      },
    });
  }

  update({ data, options } = {}) {
    if (!this._chart) return;
    if (data) {
      this._chart.data = data;
    }
    if (options) {
      Object.assign(this._chart.options, options);
    }
    this._chart.update();
  }

  destroy() {
    this._chart?.destroy();
    super.destroy();
  }
}
