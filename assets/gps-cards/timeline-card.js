import { BaseCard } from './base-card.js';
import { CHART_COLORS } from './chart-card.js';

export class TimelineCard extends BaseCard {
  _buildBody() {
    const div = document.createElement('div');
    div.style.cssText = `position:relative;height:${this.config.height || 200}px`;
    const canvas = document.createElement('canvas');
    canvas.id = 'timeline-' + this.id;
    div.appendChild(canvas);
    this._canvas = canvas;
    return div;
  }

  _afterRender() {
    if (typeof Chart === 'undefined') return;
    const c    = this.config;
    const data = c.data || [];

    const labels = data.map(d => d.label || d.date);
    const values = data.map(d => d.value);
    const isMatch = data.map(d => !!d.isMatch);

    const pointColors = isMatch.map(m =>
      m ? CHART_COLORS.danger : CHART_COLORS.primary
    );

    const datasets = [{
      label: c.metric_key || 'Value',
      data: values,
      borderColor: CHART_COLORS.primary,
      backgroundColor: 'transparent',
      pointBackgroundColor: pointColors,
      pointRadius: 4,
      tension: 0.3,
    }];

    if (c.showAverage && values.length) {
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      datasets.push({
        label: 'Average',
        data: values.map(() => avg),
        borderColor: CHART_COLORS.neutral,
        borderDash: [5, 5],
        pointRadius: 0,
      });
    }

    if (c.showTrendline && values.length >= 2) {
      const n = values.length;
      const sumX = values.reduce((_, __, i) => _ + i, 0);
      const sumY = values.reduce((s, v) => s + v, 0);
      const sumXY = values.reduce((s, v, i) => s + i * v, 0);
      const sumX2 = values.reduce((s, _, i) => s + i * i, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      datasets.push({
        label: 'Trend',
        data: values.map((_, i) => slope * i + intercept),
        borderColor: CHART_COLORS.warning,
        borderDash: [3, 3],
        pointRadius: 0,
      });
    }

    this._chart = new Chart(this._canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            title: { display: !!c.unit, text: c.unit || '' },
          },
        },
        plugins: {
          legend: { display: datasets.length > 1, position: 'bottom' },
        },
      },
    });
  }

  update({ data } = {}) {
    if (!this._chart || !data) return;
    this.config.data = data;
    this._chart.data.labels = data.map(d => d.label || d.date);
    this._chart.data.datasets[0].data = data.map(d => d.value);
    this._chart.update();
  }

  destroy() {
    this._chart?.destroy();
    super.destroy();
  }
}
