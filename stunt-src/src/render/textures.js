// Procedural canvas textures (no image files: everything is drawn at start-up).

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, LinearMipmapLinearFilter } from 'three';
import { rng } from '../core/math.js';

const cache = new Map();

function make(key, w, h, draw, { repeat = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Road surface: u across the road (0 left, 1 right), v along it. One tile = 16 m. */
export function roadTexture(road) {
  return make(`road:${road.base}:${road.edge}`, 256, 512, (g, w, h) => {
    g.fillStyle = road.base;
    g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    // Neon edge lines.
    g.fillStyle = road.edge;
    g.fillRect(6, 0, 7, h);
    g.fillRect(w - 13, 0, 7, h);
    // Dashed lane lines.
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (const x of [w / 3, (2 * w) / 3]) for (let y = 0; y < h; y += 128) g.fillRect(x - 3, y + 16, 6, 64);
  });
}

/** Ground grid. */
export function gridTexture(ground) {
  return make(`grid:${ground.color}:${ground.grid}`, 256, 256, (g, w, h) => {
    g.fillStyle = ground.color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = ground.grid;
    g.globalAlpha = 0.55;
    g.lineWidth = 4;
    g.strokeRect(0, 0, w, h);
    g.globalAlpha = 0.18;
    g.lineWidth = 10;
    g.strokeRect(0, 0, w, h);
  });
}

export function checkerTexture() {
  return make('checker', 128, 32, (g, w, h) => {
    const n = 16;
    const s = w / n;
    for (let y = 0; y < 4; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
      g.fillRect(x * s, y * (h / 4), s, h / 4);
    }
  });
}

export function stripeTexture(a = '#ffd400', b = '#111') {
  return make(`stripe:${a}:${b}`, 128, 32, (g, w, h) => {
    g.fillStyle = b;
    g.fillRect(0, 0, w, h);
    g.fillStyle = a;
    for (let x = -h; x < w + h; x += 32) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 16, h);
      g.lineTo(x + 16 + h, 0);
      g.lineTo(x + h, 0);
      g.fill();
    }
  });
}

/** Lit windows for night buildings. */
export function windowsTexture(colors, seed = 3) {
  return make(`windows:${colors.join()}:${seed}`, 64, 256, (g, w, h) => {
    g.fillStyle = '#06030c';
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let y = 4; y < h - 4; y += 8) {
      for (let x = 4; x < w - 4; x += 8) {
        const p = r();
        if (p < 0.35) {
          g.fillStyle = p < 0.06 ? colors[Math.floor(r() * colors.length)] : `rgba(255,${200 + r() * 55},${150 + r() * 80},${0.35 + r() * 0.5})`;
          g.fillRect(x, y, 5, 4);
        }
      }
    }
  });
}

/** Soft radial blob: shadows, glows, underglow. */
export function blobTexture(color = '#000000') {
  return make(`blob:${color}`, 64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });
}

/** Arrow chevrons (boost pads, landing arrows). */
export function chevronTexture(color = '#ffd400', bg = 'rgba(0,0,0,0)') {
  return make(`chev:${color}:${bg}`, 128, 128, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    for (let k = 0; k < 2; k++) {
      const y = 20 + k * 56;
      g.beginPath();
      g.moveTo(10, y + 40);
      g.lineTo(w / 2, y);
      g.lineTo(w - 10, y + 40);
      g.lineTo(w - 32, y + 40);
      g.lineTo(w / 2, y + 22);
      g.lineTo(32, y + 40);
      g.fill();
    }
  });
}

/** Oil: near-black with a rainbow sheen. */
export function oilTexture() {
  return make('oil', 128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(8,6,14,0.95)');
    grad.addColorStop(0.8, 'rgba(10,8,18,0.9)');
    grad.addColorStop(1, 'rgba(10,8,18,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = `hsla(${i * 55}, 100%, 60%, 0.16)`;
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(w / 2 + i * 2, h / 2 - i * 2, 18 + i * 6, 12 + i * 5, 0.5, 0, Math.PI * 2);
      g.stroke();
    }
  }, { repeat: false });
}
