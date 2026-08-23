/* ── cm-charts.js — shared Chart.js adapter (Evaluations & friends) ─────────────
 *
 * Unifies the hand-rolled DOM/SVG charts with the visual language of the GPS
 * dashboard (assets/gp-builder): same gridlines, tick colors, label rotation
 * policy, dashed reference lines and dark-mode-aware tokens — WITHOUT coupling
 * to gp-builder's data model (12k lines, GPS-specific). Requires chart.umd.js
 * (same CDN build GPS Analysis loads); every caller must keep a DOM fallback
 * for when Chart.js is absent (CDN blocked) — check cmCharts.ready() first.
 *
 * All user-visible strings are passed IN by the caller (already localized);
 * this file is i18n-free by design.
 */
(function () {
  if (window.cmCharts) return;

  // ── theme tokens (read live at mount so dark mode & tweaks are honored) ──
  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }
  function tokens() {
    return {
      grid:    'rgba(148,163,184,0.18)',                    // same as gp-builder
      tick:    cssVar('--cm-fg-faint', '#9CA3AF'),
      tickCat: cssVar('--cm-fg-muted', '#6B7280'),
      strong:  cssVar('--cm-fg-strong', '#111827'),
      ok:      cssVar('--cm-chart-ok', '#475569'),           // slate — at/above
      warn:    cssVar('--cm-warning', '#D97706'),
      bad:     cssVar('--cm-danger', '#DC2626'),
      good:    cssVar('--cm-success', '#16A34A'),
      info:    cssVar('--cm-info', '#2563EB'),
      surface: cssVar('--cm-surface', '#FFFFFF'),
    };
  }
  // band key → color (semantic). Callers tag each band with one of these keys.
  function bandColor(t, key) {
    return ({ good: t.good, ok: t.ok, info: t.info, warn: t.warn, bad: t.bad })[key] || t.ok;
  }

  function destroy(el) {
    if (el && el.__cmChart) { try { el.__cmChart.destroy(); } catch (e) {} el.__cmChart = null; }
  }

  // ── plugin: value labels above bars ──
  var _valueLabels = {
    id: 'cmValueLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.fmt) return;
      var meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || meta.data.length > 40) return;   // too dense → skip
      var ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 10.5px ' + (opts.mono || 'ui-monospace, monospace');
      ctx.fillStyle = opts.color || '#6B7280';
      ctx.textAlign = 'center';
      var ds = chart.data.datasets[0].data;
      meta.data.forEach(function (bar, i) {
        var v = ds[i];
        if (v == null) return;
        ctx.fillText(opts.fmt(v), bar.x, bar.y - 6);
      });
      ctx.restore();
    },
  };

  // ── plugin: dashed average line + pill label (collision-free: pinned inside
  //    the chart area, on the side the caller says is emptier) ──
  var _avgLine = {
    id: 'cmAvgLine',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || opts.value == null) return;
      var y = chart.scales.y.getPixelForValue(opts.value);
      var area = chart.chartArea;
      if (y < area.top || y > area.bottom) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = opts.lineColor || '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(area.left, y); ctx.lineTo(area.right, y); ctx.stroke();
      if (opts.label) {
        ctx.setLineDash([]);
        ctx.font = '600 10px ' + (opts.mono || 'ui-monospace, monospace');
        var w = ctx.measureText(opts.label).width + 14;
        var h = 18;
        var x = opts.side === 'left' ? area.left + 6 : area.right - w - 6;
        var py = Math.max(area.top + 2, y - h - 4);
        ctx.fillStyle = opts.pillBg || '#111827';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, py, w, h, 5); ctx.fill(); }
        else ctx.fillRect(x, py, w, h);
        ctx.fillStyle = opts.pillFg || '#FFFFFF';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(opts.label, x + 7, py + h / 2 + 0.5);
      }
      ctx.restore();
    },
  };

  // ── plugin: horizontal reference band zones (translucent) behind the bars ──
  var _bandZones = {
    id: 'cmBandZones',
    beforeDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.bands || !opts.bands.length) return;
      var area = chart.chartArea, scale = chart.scales.y, ctx = chart.ctx;
      ctx.save();
      opts.bands.forEach(function (b) {
        var yFrom = scale.getPixelForValue(Math.max(scale.min, b.from));
        var yTo = scale.getPixelForValue(Math.min(scale.max, b.to));
        if (yTo >= yFrom) return;                     // fully outside the visible range
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.07;
        ctx.fillRect(area.left, yTo, area.right - area.left, yFrom - yTo);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        if (b.to <= scale.max) { ctx.beginPath(); ctx.moveTo(area.left, yTo); ctx.lineTo(area.right, yTo); ctx.stroke(); }
      });
      ctx.restore();
    },
  };

  /**
   * Team bar chart — one bar per player.
   * opts: {
   *   rows: [{ label, value, pid, cls? ('warn'|'bad'|''), bandKey? }],
   *   fmt: v => string, unit, avg, avgLabel, side ('left'|'right'),
   *   bands: [{ from, to, key }] (absolute-value zones; bar colored by its zone),
   *   neutral: bool (no semantic coloring at all),
   *   tipLines: (row) => [string,...]   // extra tooltip lines (Δ baseline, method…)
   *   onBarClick: pid => void
   * }
   */
  function teamBars(el, opts) {
    if (typeof Chart === 'undefined' || !el) return false;
    destroy(el);
    el.innerHTML = '';
    var t = tokens();
    var rows = opts.rows || [];
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100%;height:340px';
    var canvas = document.createElement('canvas');
    wrap.appendChild(canvas); el.appendChild(wrap);

    var withBands = !!(opts.bands && opts.bands.length);
    var colors = rows.map(function (r) {
      if (withBands && r.bandKey) return bandColor(t, r.bandKey);
      if (opts.neutral) return t.ok;
      return r.cls === 'bad' ? t.bad : r.cls === 'warn' ? t.warn : t.ok;
    });
    var maxV = rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0);
    var bandsDrawn = withBands ? opts.bands.map(function (b) { return { from: b.from, to: b.to, color: bandColor(t, b.key) }; }) : null;

    el.__cmChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          data: rows.map(function (r) { return r.value; }),
          backgroundColor: colors,
          borderRadius: 5,
          maxBarThickness: 48,
          borderSkipped: 'bottom',
        }],
      },
      plugins: [_valueLabels, _avgLine, _bandZones],
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 320 },
        layout: { padding: { top: 18 } },
        onClick: function (ev, els) {
          if (!els || !els.length || !opts.onBarClick) return;
          var r = rows[els[0].index];
          if (r && r.pid) opts.onBarClick(r.pid);
        },
        onHover: function (ev, els) {
          if (ev && ev.native && ev.native.target) ev.native.target.style.cursor = (els && els.length && opts.onBarClick) ? 'pointer' : 'default';
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxV * 1.1 || 1,
            grid: { color: t.grid, drawTicks: false },
            border: { display: false },
            ticks: { font: { size: 10 }, color: t.tick, padding: 6,
              callback: function (v) { return (opts.fmt ? opts.fmt(v) : v); } },
            title: opts.unit ? { display: true, text: opts.unit, color: t.tick, font: { size: 10 } } : undefined,
          },
          x: {
            grid: { display: false, drawTicks: false },
            border: { display: true },
            // horizontal while they fit; Chart.js rotates up to 52° only when needed (gp-builder policy)
            ticks: { font: { size: 10.5 }, color: t.tickCat, minRotation: 0, maxRotation: 52, autoSkip: true, autoSkipPadding: 4 },
          },
        },
        plugins: {
          legend: { display: false },
          cmValueLabels: { fmt: opts.fmt, color: t.tickCat },
          cmAvgLine: opts.avg != null ? { value: opts.avg, label: opts.avgLabel || '', side: opts.side || 'right', pillBg: t.strong, pillFg: t.surface } : {},
          cmBandZones: bandsDrawn ? { bands: bandsDrawn } : {},
          tooltip: {
            displayColors: false,
            callbacks: {
              title: function (items) { return items[0] ? rows[items[0].dataIndex].label : ''; },
              label: function (item) {
                var r = rows[item.dataIndex];
                var lines = [(opts.fmt ? opts.fmt(r.value) : r.value) + (opts.unit ? ' ' + opts.unit : '')];
                if (opts.tipLines) lines = lines.concat(opts.tipLines(r) || []);
                return lines;
              },
            },
          },
        },
      },
    });
    return true;
  }

  /**
   * Individual trend line (over time).
   * opts: { points: [{label, value}], fmt, unit, avg, avgLabel, tipLines?(point,i) }
   */
  function trendLine(el, opts) {
    if (typeof Chart === 'undefined' || !el) return false;
    destroy(el);
    el.innerHTML = '';
    var t = tokens();
    var pts = opts.points || [];
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100%;height:300px';
    var canvas = document.createElement('canvas');
    wrap.appendChild(canvas); el.appendChild(wrap);

    el.__cmChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: pts.map(function (p) { return p.label; }),
        datasets: [{
          data: pts.map(function (p) { return p.value; }),
          borderColor: t.ok,
          borderWidth: 2.25,
          tension: 0.25,
          fill: true,
          backgroundColor: 'rgba(71,85,105,0.07)',
          pointRadius: pts.map(function (_, i) { return i === pts.length - 1 ? 5 : 3.5; }),
          pointBackgroundColor: pts.map(function (_, i) { return i === pts.length - 1 ? t.strong : t.surface; }),
          pointBorderColor: t.strong,
          pointBorderWidth: 2,
        }],
      },
      plugins: [_avgLine],
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 320 },
        layout: { padding: { top: 14, right: 10 } },
        scales: {
          y: {
            grace: '18%',
            grid: { color: t.grid, drawTicks: false },
            border: { display: false },
            ticks: { font: { size: 10 }, color: t.tick, padding: 6,
              callback: function (v) { return (opts.fmt ? opts.fmt(v) : v); } },
            title: opts.unit ? { display: true, text: opts.unit, color: t.tick, font: { size: 10 } } : undefined,
          },
          x: {
            grid: { display: false, drawTicks: false },
            border: { display: false },
            ticks: { font: { size: 10.5 }, color: t.tickCat, minRotation: 0, maxRotation: 52, autoSkip: true, autoSkipPadding: 6 },
          },
        },
        plugins: {
          legend: { display: false },
          cmAvgLine: opts.avg != null ? { value: opts.avg, label: opts.avgLabel || '', side: 'left', pillBg: t.strong, pillFg: t.surface } : {},
          tooltip: {
            displayColors: false,
            callbacks: {
              label: function (item) {
                var i = item.dataIndex;
                var lines = [(opts.fmt ? opts.fmt(pts[i].value) : pts[i].value) + (opts.unit ? ' ' + opts.unit : '')];
                if (opts.tipLines) lines = lines.concat(opts.tipLines(pts[i], i) || []);
                return lines;
              },
            },
          },
        },
      },
    });
    return true;
  }

  window.cmCharts = {
    ready: function () { return typeof Chart !== 'undefined'; },
    teamBars: teamBars,
    trendLine: trendLine,
    destroy: destroy,
    bandColor: function (key) { return bandColor(tokens(), key); },
  };
})();
