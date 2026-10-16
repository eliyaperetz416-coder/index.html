// Sound: everything is synthesised with WebAudio (no audio files, works offline).
// The audio context starts on the first touch or key press (browsers, iOS in particular,
// only allow sound after a user gesture).

const NOISE_SECONDS = 1.5;

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.8;
    this.engine = null;
    this.lastPlay = new Map();
  }

  /** Call from a user gesture. Safe to call many times. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      const len = Math.floor(this.ctx.sampleRate * NOISE_SECONDS);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    this.applyVolume();
    if (!on) this.engineStop();
  }

  setVolume(v) {
    this.volume = v;
    this.applyVolume();
  }

  applyVolume() {
    if (this.master) this.master.gain.value = this.enabled ? this.volume * 0.7 : 0;
  }

  get ready() {
    return !!this.ctx && this.enabled && this.ctx.state === 'running';
  }

  /** Short oscillator note with an optional pitch slide. */
  tone(freq, dur, { type = 'square', gain = 0.2, to = null, delay = 0, attack = 0.005 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Filtered noise burst with an optional filter sweep. */
  noise(dur, { type = 'bandpass', freq = 1000, to = null, q = 1, gain = 0.3, delay = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * (NOISE_SECONDS - dur - 0.05 > 0 ? NOISE_SECONDS - dur - 0.05 : 0));
    src.stop(t + dur + 0.02);
  }

  /** Named sound effects. Rapid repeats of the same effect are thinned out. */
  play(name) {
    if (!this.ready) return;
    const now = performance.now();
    const gap = { coin: 40, wall: 120, nearMiss: 150 }[name] ?? 60;
    if (now - (this.lastPlay.get(name) ?? 0) < gap) return;
    this.lastPlay.set(name, now);
    const fx = SFX[name];
    if (fx) fx(this);
  }

  // --- engine ------------------------------------------------------------------------------

  engineStart() {
    // Not `ready`: on the very first tap the context may still be resuming.
    if (!this.ctx || !this.enabled || this.engine) return;
    const c = this.ctx;
    const a = c.createOscillator();
    const b = c.createOscillator();
    a.type = 'sawtooth';
    b.type = 'square';
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    f.Q.value = 4;
    const g = c.createGain();
    g.gain.value = 0;
    a.connect(f);
    b.connect(f);
    f.connect(g).connect(this.master);
    a.start();
    b.start();
    this.engine = { a, b, f, g };
  }

  /** speed m/s, throttle 0..1, boosting bool. Fake gears so the pitch rises and drops. */
  engineUpdate(speed, throttle, boosting) {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    const gearSize = 13;
    const gear = Math.min(5, Math.floor(speed / gearSize));
    const inGear = (speed - gear * gearSize) / gearSize;
    const freq = 55 + gear * 9 + Math.min(1.4, inGear) * 70 + (boosting ? 25 : 0);
    e.a.frequency.setTargetAtTime(freq, t, 0.05);
    e.b.frequency.setTargetAtTime(freq * 0.5, t, 0.05);
    e.f.frequency.setTargetAtTime(380 + speed * 22 + throttle * 500 + (boosting ? 900 : 0), t, 0.08);
    e.g.gain.setTargetAtTime(0.05 + throttle * 0.07 + (boosting ? 0.04 : 0), t, 0.1);
  }

  engineStop() {
    const e = this.engine;
    if (!e) return;
    this.engine = null;
    const t = this.ctx.currentTime;
    e.g.gain.setTargetAtTime(0, t, 0.08);
    e.a.stop(t + 0.4);
    e.b.stop(t + 0.4);
  }
}

const SFX = {
  click: (s) => s.tone(900, 0.05, { type: 'triangle', gain: 0.12 }),
  buy: (s) => {
    s.tone(660, 0.08, { type: 'square', gain: 0.12 });
    s.tone(990, 0.14, { type: 'square', gain: 0.12, delay: 0.07 });
  },
  coin: (s) => {
    s.tone(1320, 0.06, { type: 'square', gain: 0.08 });
    s.tone(1760, 0.1, { type: 'square', gain: 0.08, delay: 0.05 });
  },
  count: (s) => s.tone(520, 0.18, { type: 'square', gain: 0.15 }),
  go: (s) => s.tone(1040, 0.4, { type: 'square', gain: 0.18 }),
  boost: (s) => s.noise(0.45, { freq: 400, to: 3000, q: 2, gain: 0.35 }),
  nitro: (s) => {
    s.noise(0.9, { freq: 300, to: 4000, q: 1.5, gain: 0.45 });
    s.tone(110, 0.6, { type: 'sawtooth', gain: 0.12, to: 330 });
  },
  nearMiss: (s) => s.noise(0.25, { type: 'highpass', freq: 2500, to: 6000, gain: 0.25 }),
  hit: (s) => {
    s.noise(0.3, { type: 'lowpass', freq: 1800, to: 200, gain: 0.6 });
    s.tone(90, 0.25, { type: 'sine', gain: 0.4, to: 40 });
  },
  crash: (s) => {
    s.noise(0.6, { type: 'lowpass', freq: 2500, to: 150, gain: 0.7 });
    s.tone(70, 0.45, { type: 'sine', gain: 0.5, to: 30 });
  },
  wall: (s) => s.noise(0.15, { freq: 2200, q: 3, gain: 0.25 }),
  land: (s) => s.tone(120, 0.2, { type: 'sine', gain: 0.35, to: 50 }),
  launch: (s) => s.noise(0.3, { type: 'highpass', freq: 800, to: 2500, gain: 0.12 }),
  flip: (s) => {
    s.tone(660, 0.1, { type: 'triangle', gain: 0.15 });
    s.tone(880, 0.1, { type: 'triangle', gain: 0.15, delay: 0.08 });
    s.tone(1320, 0.18, { type: 'triangle', gain: 0.15, delay: 0.16 });
  },
  ram: (s) => {
    s.noise(0.25, { freq: 900, q: 4, gain: 0.5 });
    s.tone(180, 0.2, { type: 'square', gain: 0.15, to: 90 });
  },
  oil: (s) => s.noise(0.5, { type: 'lowpass', freq: 600, to: 200, gain: 0.3 }),
  finish: (s) => [523, 659, 784, 1047].forEach((f, i) => s.tone(f, 0.25, { type: 'square', gain: 0.12, delay: i * 0.1 })),
  lose: (s) => [392, 330, 262].forEach((f, i) => s.tone(f, 0.3, { type: 'triangle', gain: 0.15, delay: i * 0.15 })),
};

export const sound = new Sound();
