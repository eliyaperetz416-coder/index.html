// DOM UI: HUD, touch controls and screens. No game logic in here.
export function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
export const fmt = (n) => Math.round(n).toLocaleString('en-US');

export class UI {
  constructor() {
    this.hudEl = document.getElementById('hud');
    this.controlsEl = document.getElementById('controls');
    this.screensEl = document.getElementById('screens');
    this._buildHud();
    this.btnLeft = null; this.btnRight = null;
  }

  _buildHud() {
    this.hudEl.innerHTML = '';
    const score = h('div', 'hud-score', '<div class="lbl">Score</div><div class="val" data-k="score">0</div>');
    const speed = h('div', 'hud-speed', '<div class="lbl">Speed</div><div><span class="val" data-k="speed">0</span><span class="unit">km/h</span></div>');
    const combo = h('div', 'hud-combo', '<div class="c-count"></div><div class="c-mult"></div><div class="c-bar"><i></i></div>');
    const nitro = h('div', 'hud-nitro', '<div class="n-lbl">NITRO</div><div class="n-bar"><i></i></div>');
    this.popups = h('div', 'popups');
    this.flash = h('div', 'flash');
    this.hudEl.append(score, speed, combo, nitro, this.popups, this.flash);
    this.elScore = score.querySelector('[data-k=score]');
    this.elSpeed = speed.querySelector('[data-k=speed]');
    this.elCombo = combo; this.elComboCount = combo.querySelector('.c-count'); this.elComboMult = combo.querySelector('.c-mult');
    this.elComboBar = combo.querySelector('.c-bar i');
    this.elNitro = nitro; this.elNitroBar = nitro.querySelector('.n-bar i');
    this._last = {};
  }

  setCombo(combo, mult, timeFrac) {
    const on = combo > 0;
    this.elCombo.classList.toggle('on', on);
    if (!on) { this._last.combo = 0; return; }
    if (this._last.combo !== combo) {
      this.elComboCount.textContent = combo + ' COMBO'; this.elComboMult.textContent = '×' + mult.toFixed(1);
      this.elCombo.classList.remove('pulse'); void this.elCombo.offsetWidth; this.elCombo.classList.add('pulse');
      this._last.combo = combo;
    }
    this.elComboBar.style.transform = `scaleX(${Math.max(0, Math.min(1, timeFrac))})`;
  }
  setNitro(meter, active, locked) {
    this.elNitroBar.style.transform = `scaleX(${meter / 100})`;
    this.elNitro.classList.toggle('active', active); this.elNitro.classList.toggle('locked', locked);
    if (this.nitroBtn) { this.nitroBtn.classList.toggle('active', active); this.nitroBtn.classList.toggle('locked', locked); }
  }
  popup(text, kind = '') {
    const e = h('div', 'popup ' + kind, text);
    this.popups.append(e);
    while (this.popups.children.length > 4) this.popups.firstChild.remove();
    e.addEventListener('animationend', () => e.remove());
  }
  flashScreen(kind = 'red') {
    this.flash.className = 'flash'; void this.flash.offsetWidth; this.flash.className = 'flash ' + kind;
  }

  setHud({ score, kmh }) {
    const s = fmt(score), k = String(Math.round(kmh));
    if (this._last.s !== s) { this.elScore.textContent = s; this._last.s = s; }
    if (this._last.k !== k) { this.elSpeed.textContent = k; this._last.k = k; }
  }
  showHud(v) { this.hudEl.style.display = v ? '' : 'none'; }

  // ---- controls ----
  buildButtons(onLane, onNitro) {
    this.controlsEl.innerHTML = '';
    if (onNitro) {
      const n = h('div', 'nitro-btn', 'N<small>NITRO</small>');
      n.addEventListener('pointerdown', (e) => { e.preventDefault(); onNitro(true); });
      const up = () => onNitro(false);
      n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up); n.addEventListener('pointerleave', up);
      this.controlsEl.append(n); this.nitroBtn = n;
    }
    const mk = (cls, label, dir) => {
      const b = h('div', 'side-btn ' + cls, label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); onLane(dir); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      this.controlsEl.append(b); return b;
    };
    this.btnLeft = mk('left', '◀', -1); this.btnRight = mk('right', '▶', 1);
  }
  showControls(v) { this.controlsEl.style.display = v ? '' : 'none'; }

  // ---- screens ----
  clearScreens() { this.screensEl.innerHTML = ''; }
  showScreen(node) { this.clearScreens(); this.screensEl.append(node); return node; }
}
