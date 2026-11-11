// Seeded gradient noise. The same seed always gives the same world.

export function createNoise(seed = 1) {
  let s = seed >>> 0;
  /** Random number 0–1 from the seed (not Math.random, so the world is repeatable). */
  const random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => {
    switch (h & 7) {
      case 0: return x + y;
      case 1: return x - y;
      case 2: return -x + y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  };

  /** Smooth noise, roughly -1…1. `period` (optional) makes it repeat, for tiling textures. */
  function noise(x, y, period = 256) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const xf = x - x0;
    const yf = y - y0;
    const wrap = (n) => ((n % period) + period) % period & 255;
    const xa = wrap(x0), xb = wrap(x0 + 1), ya = wrap(y0), yb = wrap(y0 + 1);
    const u = fade(xf), v = fade(yf);
    return lerp(
      lerp(grad(p[p[xa] + ya], xf, yf), grad(p[p[xb] + ya], xf - 1, yf), u),
      lerp(grad(p[p[xa] + yb], xf, yf - 1), grad(p[p[xb] + yb], xf - 1, yf - 1), u),
      v,
    );
  }

  /** Several layers of noise added together: big shapes plus finer and finer detail. */
  function fbm(x, y, octaves = 5, period = 0) {
    let sum = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise(x * freq, y * freq, period ? period * freq : 256);
      amp *= 0.5;
      freq *= 2;
    }
    return sum;
  }

  /** Sharp ridges, for mountains. 0…1. */
  function ridged(x, y, octaves = 5) {
    let sum = 0, amp = 0.5, freq = 1, weight = 1;
    for (let i = 0; i < octaves; i++) {
      let n = 1 - Math.abs(noise(x * freq, y * freq));
      n *= n * weight;
      weight = Math.min(1, n * 2);
      sum += n * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum;
  }

  return { noise, fbm, ridged, random };
}

export const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
