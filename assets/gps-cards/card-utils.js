// Shared helpers for all GPS cards

export function formatValue(value, format, decimals = 2, options = {}) {
  if (value == null || isNaN(value)) return '—';
  const formatters = {
    distance: v => {
      if (options.unit === 'km') return (v / 1000).toFixed(decimals) + ' km';
      return Math.round(v).toLocaleString() + ' m';
    },
    speed:    v => v.toFixed(decimals) + ' km/h',
    load:     v => v.toFixed(decimals) + ' AU',
    count:    v => Number(v).toLocaleString(),
    duration: v => Math.round(v) + ' min',
    percent:  v => Math.round(v) + '%',
    number:   v => Number(v).toFixed(decimals),
  };
  return formatters[format] ? formatters[format](value) : String(value);
}

export function getZScoreColorClass(zscore) {
  if (zscore >  2) return 'high';
  if (zscore >  1) return 'mhigh';
  if (zscore >  0.5) return 'warn';
  if (zscore > -0.5) return 'neu';
  if (zscore > -1) return 'low';
  if (zscore > -2) return 'mlow';
  return 'vlow';
}

export function calculateZScore(value, allValues) {
  const valid = allValues.filter(v => v != null && !isNaN(v));
  if (valid.length < 2) return 0;
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
  const std = Math.sqrt(variance) || 1;
  return (value - mean) / std;
}

export function getDirectionIndicator(current, previous, direction = 'auto') {
  if (previous == null || current == null || previous === 0) return null;
  const diff = current - previous;
  const pctDiff = (diff / previous) * 100;
  const isUp = diff > 0;
  let color = 'neutral';
  if (direction === 'higher_better') color = isUp ? 'success' : 'danger';
  else if (direction === 'lower_better') color = isUp ? 'danger' : 'success';
  else color = isUp ? 'success' : 'danger';
  return {
    icon: isUp ? 'ti-arrow-up-right' : 'ti-arrow-down-right',
    color,
    text: `${isUp ? '+' : ''}${pctDiff.toFixed(0)}%`,
  };
}

export function debounce(fn, ms = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

// Build a minimal SVG sparkline from an array of numbers
export function buildSparklineSVG(data) {
  if (!data || data.length < 2) return '';
  const w = 100, h = 30, pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (w - pad * 2));
  const ys = data.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const lx = xs[xs.length - 1].toFixed(1);
  const ly = ys[ys.length - 1].toFixed(1);
  return `<svg viewBox="0 0 ${w} ${h}" class="gp-sparkline" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="var(--cm-accent)" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly}" r="2.5" fill="var(--cm-accent)"/>
  </svg>`;
}
