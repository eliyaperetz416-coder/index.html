// Sound made from scratch with the Web Audio API: wind outside, a low hum inside,
// footsteps, the airlock door and small interface clicks. No audio files.

export function createAudio() {
  let ctx = null, master, windGain, windFilter, humGain, noise;
  let muted = false;

  /** Browsers only allow sound after a click or tap, so this is called from the Begin button. */
  function start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);

    noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // wind: filtered noise that swells slowly
    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 320;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();

    // room tone: two low notes slightly out of tune, plus air through the vents
    humGain = ctx.createGain();
    humGain.gain.value = 0;
    humGain.connect(master);
    for (const [freq, level] of [[54, 0.5], [81.5, 0.22], [108.4, 0.12]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(humGain);
      osc.start();
    }
    const vent = ctx.createBufferSource();
    vent.buffer = noise;
    vent.loop = true;
    const ventFilter = ctx.createBiquadFilter();
    ventFilter.type = 'highpass';
    ventFilter.frequency.value = 2400;
    const ventGain = ctx.createGain();
    ventGain.gain.value = 0.05;
    vent.connect(ventFilter).connect(ventGain).connect(humGain);
    vent.start();
  }

  /** A short burst of filtered noise. */
  function burst(freq, q, level, seconds, sweepTo) {
    if (!ctx || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    src.connect(filter).connect(g).connect(master);
    src.start(ctx.currentTime, Math.random() * 2, seconds + 0.05);
  }

  function tone(freq, level, seconds) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(g).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  return {
    start,
    /** Call every frame: fades between the outdoor wind and the indoor hum. */
    update(dt, time, indoors) {
      if (!ctx) return;
      const k = Math.min(1, dt * 2.5);
      const gust = 0.11 + Math.sin(time * 0.23) * 0.04 + Math.sin(time * 0.71) * 0.025;
      windGain.gain.value += ((indoors ? 0.012 : gust) - windGain.gain.value) * k;
      windFilter.frequency.value = 300 + Math.sin(time * 0.31) * 120;
      humGain.gain.value += ((indoors ? 0.07 : 0) - humGain.gain.value) * k;
    },
    step: (indoors) => (indoors ? burst(950, 1.6, 0.16, 0.09) : burst(260, 0.9, 0.3, 0.13)),
    land: () => burst(180, 0.7, 0.5, 0.2),
    door: () => burst(2600, 0.8, 0.22, 0.7, 700),
    click: () => tone(880, 0.06, 0.08),
    confirm: () => { tone(660, 0.07, 0.12); setTimeout(() => tone(990, 0.07, 0.18), 90); },
    deny: () => tone(170, 0.1, 0.22),
    build: () => { burst(500, 1.2, 0.5, 0.5, 120); tone(110, 0.15, 0.5); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.6;
      return muted;
    },
  };
}
