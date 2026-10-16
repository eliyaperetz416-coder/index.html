// Main loop: requestAnimationFrame with a clamped delta. Pauses while the tab is hidden.

export class Loop {
  constructor(tick) {
    this.tick = tick;
    this.running = false;
    this.last = 0;
    this.frame = (t) => {
      if (!this.running) return;
      requestAnimationFrame(this.frame);
      const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      this.tick(dt, t / 1000);
    };
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }
}
