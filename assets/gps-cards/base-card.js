// Base class for all GPS dashboard cards

export class BaseCard {
  constructor(config) {
    this.id        = config.id || crypto.randomUUID();
    this.cardId    = config.cardId;
    this.size      = config.size || 'M';
    this.title     = config.title || '';
    this.subtitle  = config.subtitle || '';
    this.config    = config;
    this.container = null;
    this._listeners = [];
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  render(container) {
    this.container = container;
    const el = this._buildWrapper();
    this._applySize(el);
    el.querySelector('.gp-c-b').appendChild(this._buildBody());
    this._attachEvents(el);
    container.appendChild(el);
    this._el = el;
    this._afterRender();
  }

  update(newData) {
    // Subclasses override to refresh body content
  }

  destroy() {
    this._listeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
    this._listeners = [];
    if (this._el) this._el.remove();
  }

  setSize(size) {
    this.size = size;
    if (this._el) this._applySize(this._el);
    this._emit('card:resize', { size });
  }

  // Map S/M/L/full → CSS size tokens (sm/md/lg/full)
  static _cssSize(size) {
    return { S: 'sm', M: 'md', L: 'lg', full: 'full', Full: 'full', sm: 'sm', md: 'md', lg: 'lg' }[size] || 'md';
  }

  serialize() {
    return {
      card_id:  this.cardId,
      type:     this.constructor.name,
      size:     this.size,
      position: this._el ? [...this._el.parentElement.children].indexOf(this._el) : 0,
      config:   this.config,
    };
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _buildWrapper() {
    const el = document.createElement('div');
    el.className = 'gp-c';
    el.dataset.cardId = this.cardId;
    el.dataset.size   = this.size;
    el.setAttribute('draggable', 'true');
    el.innerHTML = `
      <div class="gp-c-h">
        <span class="ttl">${this.title}</span>
        ${this.subtitle ? `<span class="sub">${this.subtitle}</span>` : ''}
        <div class="right">
          <div class="size-toggle">
            <button data-size="S">S</button>
            <button data-size="M">M</button>
            <button data-size="L">L</button>
            <button data-size="full">Full</button>
          </div>
          <button class="card-action" data-action="remove" title="Remove card">
            <i class="ti ti-x"></i>
          </button>
          <button class="card-action drag-handle" title="Drag to reorder">
            <i class="ti ti-grip-vertical"></i>
          </button>
        </div>
      </div>
      <div class="gp-c-b"></div>`;
    return el;
  }

  _buildBody() {
    // Subclasses override
    return document.createTextNode('');
  }

  _afterRender() {
    // Subclasses override (e.g. init Chart.js instance)
  }

  _applySize(el) {
    el.dataset.size = BaseCard._cssSize(this.size);
    el.querySelectorAll('.size-toggle button').forEach(btn => {
      btn.classList.toggle('is-on', btn.dataset.size === this.size);
    });
  }

  _attachEvents(el) {
    // Size toggle
    el.querySelectorAll('.size-toggle button').forEach(btn => {
      const fn = () => this.setSize(btn.dataset.size);
      btn.addEventListener('click', fn);
      this._listeners.push({ el: btn, type: 'click', fn });
    });

    // Remove
    const removeBtn = el.querySelector('[data-action="remove"]');
    if (removeBtn) {
      const fn = () => this._emit('card:remove', { cardId: this.cardId });
      removeBtn.addEventListener('click', fn);
      this._listeners.push({ el: removeBtn, type: 'click', fn });
    }

    // Drag
    const dragFn = () => this._emit('card:dragstart', { cardId: this.cardId });
    el.addEventListener('dragstart', dragFn);
    this._listeners.push({ el, type: 'dragstart', fn: dragFn });

    const dragEndFn = () => this._emit('card:dragend', { cardId: this.cardId });
    el.addEventListener('dragend', dragEndFn);
    this._listeners.push({ el, type: 'dragend', fn: dragEndFn });
  }

  _emit(eventName, detail) {
    if (this._el) {
      this._el.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail }));
    }
  }

  _on(el, type, fn) {
    el.addEventListener(type, fn);
    this._listeners.push({ el, type, fn });
  }

  _emptyState(message = 'No data available') {
    const div = document.createElement('div');
    div.className = 'gp-empty';
    div.textContent = message;
    return div;
  }
}
