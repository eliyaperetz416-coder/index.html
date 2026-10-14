// Procedural sound (Web Audio): no audio files to download.
// Sounds are referenced by name from chapter data.

let ctx = null;
let master = null;
let noiseBuffer = null;
const loops = new Map();

/** Must be called from a user gesture (iOS requires it). */
export function unlockAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    noiseBuffer = makeNoise(2);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function makeNoise(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    // Brown-ish noise: softer than white noise, good for rooms and wind.
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

function noiseSource(loop = false) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = loop;
  return src;
}

function envelope(gainNode, t, attack, peak, release) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

const LOOPS = {
  roomTone() {
    const src = noiseSource(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.18;
    src.connect(lp).connect(g).connect(master);
    src.start();
    return () => src.stop();
  },
  clock() {
    const id = setInterval(() => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.frequency.value = 2400;
      const g = ctx.createGain();
      envelope(g, t, 0.002, 0.04, 0.03);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.05);
    }, 1000);
    return () => clearInterval(id);
  },
};

const ONE_SHOTS = {
  // Air rushing past a falling object: band-passed noise sweeping down.
  whoosh({ duration = 3 }) {
    const t = ctx.currentTime;
    const src = noiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(260, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + duration * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + duration + 0.1);
  },
  // Book hitting the ground: low thump + short dust noise.
  impact() {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = ctx.createGain();
    envelope(g, t, 0.005, 0.9, 0.45);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.6);
    const n = noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const ng = ctx.createGain();
    envelope(ng, t, 0.003, 0.5, 0.2);
    n.connect(lp).connect(ng).connect(master);
    n.start(t);
    n.stop(t + 0.3);
  },
  // Dramatic low swell.
  drone({ duration = 3 }) {
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.linearRampToValueAtTime(700, t + duration * 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    lp.connect(g).connect(master);
    for (const [freq, type] of [[55, 'sawtooth'], [55.7, 'sawtooth'], [82.4, 'triangle']]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + duration + 0.1);
    }
  },
};

export function playSound(name, params = {}) {
  if (!ctx) return;
  const fn = ONE_SHOTS[name];
  if (!fn) return console.warn(`Unknown sound: ${name}`);
  fn(params);
}

export function setAmbience(names = []) {
  if (!ctx) return;
  for (const [name, stop] of loops) {
    if (!names.includes(name)) { stop(); loops.delete(name); }
  }
  for (const name of names) {
    if (!loops.has(name) && LOOPS[name]) loops.set(name, LOOPS[name]());
  }
}
