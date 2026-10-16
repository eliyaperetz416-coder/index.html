// Keyboard + on-screen buttons. Emits discrete lane changes and a held nitro flag.
export class Input {
  constructor() {
    this.onLane = () => {}; this.onNitro = () => {}; this.onPause = () => {}; this.onAnyStart = () => {};
    this.nitroHeld = false;
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
  }
  _key(e, down) {
    if (e.repeat) return;
    const k = e.key;
    if (down) {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.onLane(-1);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.onLane(1);
      else if (k === 'Escape' || k === 'p' || k === 'P') this.onPause();
      else if (k === 'Enter') this.onAnyStart();
    }
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Shift') {
      if (down && k === ' ') this.onAnyStart();
      this.setNitro(down);
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  }
  setNitro(v) { if (this.nitroHeld !== v) { this.nitroHeld = v; this.onNitro(v); } }
}
