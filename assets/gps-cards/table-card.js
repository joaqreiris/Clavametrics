import { BaseCard } from './base-card.js';
import { formatValue, calculateZScore, getZScoreColorClass, debounce } from './card-utils.js';

export class TableCard extends BaseCard {
  constructor(config) {
    super(config);
    this._sortKey = config.sort?.key || null;
    this._sortDir = config.sort?.direction || 'desc';
    this._search  = '';
    this._filters = {};
    this._data    = config.data || [];
  }

  _buildBody() {
    const c = this.config;
    const wrap = document.createElement('div');
    wrap.className = 'gp-table-wrap';

    // Controls row
    const controls = document.createElement('div');
    controls.className = 'gp-table-controls';
    if (c.search) {
      controls.innerHTML += `<input type="text" class="gp-table-search" placeholder="${c.searchPlaceholder || 'Search...'}">`;
    }
    if (c.filters?.length) {
      c.filters.forEach(f => {
        const sel = document.createElement('select');
        sel.className = 'gp-table-filter';
        sel.dataset.key = f.key;
        sel.innerHTML = `<option value="">${f.label}: All</option>` +
          f.options.map(o => `<option value="${o}">${o}</option>`).join('');
        controls.appendChild(sel);
      });
    }
    if (controls.children.length) wrap.appendChild(controls);

    // Table
    const tableEl = document.createElement('div');
    tableEl.className = 'gp-table-scroll';
    wrap.appendChild(tableEl);
    this._tableEl = tableEl;
    this._renderTable();

    return wrap;
  }

  _afterRender() {
    const wrap = this._el.querySelector('.gp-table-wrap');
    const searchInput = wrap?.querySelector('.gp-table-search');
    if (searchInput) {
      this._on(searchInput, 'input', debounce(e => {
        this._search = e.target.value.toLowerCase();
        this._renderTable();
      }));
    }
    wrap?.querySelectorAll('.gp-table-filter').forEach(sel => {
      this._on(sel, 'change', e => {
        this._filters[e.target.dataset.key] = e.target.value;
        this._renderTable();
      });
    });
  }

  _renderTable() {
    const c     = this.config;
    const cols  = c.columns || [];
    let rows    = this._filteredRows();
    if (this._sortKey) rows = this._sortRows(rows);

    const tbl = document.createElement('table');
    tbl.className = 'gp-zt';

    // Header
    const thead = document.createElement('thead');
    const hr    = document.createElement('tr');
    cols.forEach(col => {
      const th = document.createElement('th');
      if (col.sticky) th.classList.add('sticky');
      if (col.width)  th.style.width = col.width + 'px';
      th.innerHTML = col.label;
      if (col.sortable) {
        th.classList.add('sortable');
        if (this._sortKey === col.key) th.classList.add(this._sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        this._on(th, 'click', () => this._toggleSort(col.key));
      }
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    tbl.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="${cols.length}" class="gp-empty">${this.config.emptyState?.message || 'No data'}</td>`;
      tbody.appendChild(tr);
    } else {
      const colValues = {};
      if (cols.some(col => col.coloring === 'zscore')) {
        cols.filter(col => col.coloring === 'zscore').forEach(col => {
          colValues[col.key] = rows.map(r => r[col.key]);
        });
      }
      rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.dataset.rowId = row.id || row.player_id || '';
        cols.forEach(col => {
          const td = document.createElement('td');
          if (col.sticky) td.classList.add('sticky');
          const raw = row[col.key];

          if (col.cellRenderer === 'metric' && col.coloring === 'zscore' && colValues[col.key]) {
            const z = calculateZScore(raw, colValues[col.key]);
            const cls = getZScoreColorClass(z);
            td.classList.add('gp-zc', cls);
          }

          td.textContent = raw != null
            ? (col.format ? formatValue(raw, col.format, col.decimals ?? 0) : raw)
            : '—';
          tr.appendChild(td);
        });

        if (c.rowAction) {
          this._on(tr, 'click', () => c.rowAction(row));
          tr.style.cursor = 'pointer';
        }
        if (c.highlightedRowId && String(c.highlightedRowId) === String(row.id || row.player_id)) {
          tr.classList.add('is-highlighted');
        }
        tbody.appendChild(tr);
      });
    }
    tbl.appendChild(tbody);

    this._tableEl.innerHTML = '';
    this._tableEl.appendChild(tbl);
  }

  _filteredRows() {
    const c = this.config;
    return this._data.filter(row => {
      if (this._search) {
        const haystack = [row.player_name, row.name, row.title]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(this._search)) return false;
      }
      for (const [key, val] of Object.entries(this._filters)) {
        if (val && String(row[key]) !== val) return false;
      }
      return true;
    });
  }

  _sortRows(rows) {
    const key = this._sortKey;
    const dir = this._sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }

  _toggleSort(key) {
    if (this._sortKey === key) {
      this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortKey = key;
      this._sortDir = 'desc';
    }
    this._renderTable();
  }

  update({ data } = {}) {
    if (data) this._data = data;
    this._renderTable();
  }

  highlightRow(rowId) {
    this.config.highlightedRowId = rowId;
    this._tableEl?.querySelectorAll('tr').forEach(tr => {
      tr.classList.toggle('is-highlighted', tr.dataset.rowId === String(rowId));
    });
  }
}
