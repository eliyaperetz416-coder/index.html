// Procedural audio (WebAudio, zero asset files): engine, wind, rain, effects and a small synthwave loop.
// Browsers (iOS especially) only allow audio after a user gesture, so call unlock() from the first tap/key.
import { save } from './storage.js';

export class AudioSys {
  constructor() {
    this.ctx = null; this.enabled = save.data.settings.sound; this.musicMode = 'menu';
    this.engine = null; this.nextStep = 0; this.step = 0; this.timer = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && this.enabled) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.enabled ? 0.8 : 0; this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.22; this.musicBus.connect(this.master);
    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    // reverb (generated impulse) used by the tunnel world
    const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir; this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0;
    this.master.connect(this.reverb); this.reverb.connect(this.reverbGain); this.reverbGain.connect(ctx.destination);
    this._buildEngine(); this._buildAmbience();
    if (!this.enabled) ctx.suspend();
    this.nextStep = ctx.currentTime + 0.1; this._schedule();
  }

  setEnabled(v) {
    this.enabled = v;
    if (!this.ctx) return;
    if (v) { this.ctx.resume(); this.master.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.05); }
    else { this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); setTimeout(() => { if (!this.enabled) this.ctx.suspend(); }, 300); }
  }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.enabled) this.ctx.resume(); }

  // ---------------- continuous layers ----------------
  _noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(); return s; }

  _buildEngine() {
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; const o2 = c.createOscillator(); o2.type = 'square';
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    const g = c.createGain(); g.gain.value = 0;
    const gm = c.createGain(); gm.gain.value = 0.5;
    o1.connect(f); o2.connect(gm); gm.connect(f); f.connect(g); g.connect(this.sfxBus);
    o1.start(); o2.start();
    // wind
    const wn = this._noiseSrc(); const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 900; wf.Q.value = 0.6; const wg = c.createGain(); wg.gain.value = 0;
    wn.connect(wf); wf.connect(wg); wg.connect(this.sfxBus);
    // nitro roar
    const nn = this._noiseSrc(); const nf = c.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1800; const ng = c.createGain(); ng.gain.value = 0;
    nn.connect(nf); nf.connect(ng); ng.connect(this.sfxBus);
    this.engine = { o1, o2, f, g, wf, wg, ng };
  }

  _buildAmbience() {
    const c = this.ctx;
    const n = this._noiseSrc(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; const g = c.createGain(); g.gain.value = 0;
    n.connect(f); f.connect(g); g.connect(this.sfxBus); this.rainGain = g;
  }

  setWorld(def) {
    if (!this.ctx) { this._pendingWorld = def; return; }
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(def.rain ? 0.09 : 0, t, 0.3);
    this.reverbGain.gain.setTargetAtTime(def.structure === 'tunnel' ? 0.55 : 0, t, 0.3);
  }

  /** per-frame: kmh, top speed (km/h), boost 0..1, active (driving) */
  updateEngine(kmh, topKmh, boost, active) {
    if (!this.ctx || !this.engine) return;
    if (this._pendingWorld) { const w = this._pendingWorld; this._pendingWorld = null; this.setWorld(w); }
    const e = this.engine, t = this.ctx.currentTime;
    const gears = 5, span = topKmh / gears;
    const gear = Math.min(gears - 1, Math.floor(kmh / span)), rpm = Math.min(1, (kmh - gear * span) / span);
    const freq = 48 + gear * 6 + rpm * (70 + gear * 14) + boost * 30;
    e.o1.frequency.setTargetAtTime(freq, t, 0.04); e.o2.frequency.setTargetAtTime(freq * 0.5, t, 0.04);
    e.f.frequency.setTargetAtTime(380 + rpm * 900 + boost * 900, t, 0.05);
    e.g.gain.setTargetAtTime(active ? 0.13 + rpm * 0.05 : 0, t, 0.1);
    const sf = Math.min(1, kmh / 320);
    e.wg.gain.setTargetAtTime(active ? sf * sf * 0.22 : 0, t, 0.15); e.wf.frequency.setTargetAtTime(500 + sf * 1800, t, 0.2);
    e.ng.gain.setTargetAtTime(active ? boost * 0.16 : 0, t, 0.08);
  }

  setMusicMode(m) { this.musicMode = m; }

  // ---------------- one-shot effects ----------------
  _tone(type, f0, f1, dur, vol, when = 0, bus = this.sfxBus) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  _burst(dur, vol, freq, type = 'lowpass', sweepTo = null) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  sfx(name) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'click': this._tone('square', 700, 500, 0.05, 0.08); break;
      case 'close': this._tone('triangle', 660, 990, 0.12, 0.2); this._tone('triangle', 990, 1320, 0.14, 0.18, 0.08); break;
      case 'tight': this._tone('triangle', 660, 990, 0.1, 0.22); this._tone('triangle', 990, 1320, 0.1, 0.2, 0.07); this._tone('sine', 1320, 1980, 0.18, 0.22, 0.14); break;
      case 'whoosh': this._burst(0.35, 0.18, 400, 'bandpass', 3000); break;
      case 'nitro': this._burst(0.6, 0.25, 300, 'bandpass', 4000); this._tone('sawtooth', 120, 400, 0.5, 0.08); break;
      case 'light': this._burst(0.25, 0.4, 1800, 'lowpass', 300); this._tone('sine', 140, 50, 0.25, 0.4); break;
      case 'crash': this._burst(1.1, 0.7, 2600, 'lowpass', 120); this._tone('sine', 110, 30, 0.9, 0.6); this._tone('square', 90, 40, 0.4, 0.15); break;
      case 'lost': this._tone('sawtooth', 440, 160, 0.3, 0.12); break;
      case 'coin': this._tone('square', 1320, 1320, 0.07, 0.08); this._tone('square', 1760, 1760, 0.16, 0.08, 0.07); break;
      case 'buy': this._tone('triangle', 520, 520, 0.1, 0.18); this._tone('triangle', 780, 780, 0.1, 0.18, 0.09); this._tone('triangle', 1040, 1040, 0.22, 0.18, 0.18); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this._tone('triangle', f, f, 0.25, 0.2, i * 0.11)); break;
      case 'go': this._tone('square', 880, 880, 0.18, 0.12); break;
      case 'tick': this._tone('square', 440, 440, 0.1, 0.1); break;
    }
  }

  // ---------------- music ----------------
  _schedule() {
    if (!this.ctx) return;
    const c = this.ctx, stepDur = 60 / 104 / 4;
    while (this.nextStep < c.currentTime + 0.25) { this._playStep(this.step, this.nextStep, stepDur); this.nextStep += stepDur; this.step = (this.step + 1) % 128; }
    this.timer = setTimeout(() => this._schedule(), 60);
  }
  _note(type, freq, t, dur, vol, cutoff) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  _playStep(s, t, d) {
    if (!this.enabled || this.ctx.state !== 'running') return;
    const playing = this.musicMode === 'play';
    const bar = Math.floor(s / 16) % 8, i = s % 16;
    const roots = [45, 45, 41, 43, 45, 45, 41, 43]; // A2 A2 F2 G2 ...  (midi)
    const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const root = roots[bar];
    if (i % 4 === 0 || i === 10) this._note('sawtooth', mf(root - 12), t, d * 3, 0.5, playing ? 700 : 350);
    if (playing) {
      if (i % 4 === 0) this._tone('sine', 120, 40, 0.18, 0.55, t - this.ctx.currentTime, this.musicBus);
      if (i % 2 === 1) this._noteHat(t, d);
      const arp = [0, 7, 12, 15, 12, 7][(i + bar) % 6];
      if (i % 2 === 0) this._note('square', mf(root + 12 + arp), t, d * 1.6, 0.16, 2400);
    } else if (i === 0) {
      this._note('triangle', mf(root + 12), t, d * 14, 0.25, 900); this._note('triangle', mf(root + 19), t, d * 14, 0.18, 900);
    }
  }
  _noteHat(t, d) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = c.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.5);
    s.connect(f); f.connect(g); g.connect(this.musicBus); s.start(t, Math.random()); s.stop(t + d);
  }
}
