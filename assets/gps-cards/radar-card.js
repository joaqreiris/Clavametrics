import { BaseCard } from './base-card.js';

export class RadarCard extends BaseCard {
  _buildBody() {
    const c = this.config;
    const metrics = c.metrics || [];
    if (!metrics.length) return this._emptyState();

    const canvas = document.createElement('canvas');
    canvas.id = 'radar-' + this.id;
    canvas.style.maxHeight = '260px';
    this._canvas = canvas;
    return canvas;
  }

  _afterRender() {
    if (typeof Chart === 'undefined' || !this._canvas) return;
    const c       = this.config;
    const metrics = c.metrics || [];
    const scale   = c.scale || { min: -3, max: 3 };

    const datasets = [{
      label: c.player?.name || 'Player',
      data: metrics.map(m => m.zScore ?? m.value ?? 0),
      borderColor: 'var(--cm-accent)',
      backgroundColor: 'rgba(var(--cm-accent-rgb, 99,102,241), 0.15)',
      pointRadius: 4,
      pointBackgroundColor: 'var(--cm-accent)',
    }];
    if (c.baseline) {
      datasets.push({
        label: c.baseline.label || 'Baseline',
        data: c.baseline.values || metrics.map(() => 0),
        borderColor: 'var(--cm-border-strong)',
        backgroundColor: 'transparent',
        borderDash: [4, 4],
        pointRadius: 2,
      });
    }

    this._chart = new Chart(this._canvas, {
      type: 'radar',
      data: {
        labels: metrics.map(m => m.label),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: scale.min,
            max: scale.max,
            ticks: { display: false },
            pointLabels: { font: { size: 10 } },
          },
        },
        plugins: { legend: { display: datasets.length > 1 } },
      },
    });
  }

  update({ metrics, baseline } = {}) {
    if (!this._chart) return;
    if (metrics) {
      this.config.metrics = metrics;
      this._chart.data.datasets[0].data = metrics.map(m => m.zScore ?? m.value ?? 0);
    }
    if (baseline) {
      this.config.baseline = baseline;
      if (this._chart.data.datasets[1]) {
        this._chart.data.datasets[1].data = baseline.values;
      }
    }
    this._chart.update();
  }

  destroy() {
    this._chart?.destroy();
    super.destroy();
  }
}
