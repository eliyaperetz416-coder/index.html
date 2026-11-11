// Every surface texture in the game is painted here in code (no image files).

import * as THREE from 'three';
import { createNoise } from '../engine/noise.js';

const n = createNoise(77);

function canvas(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texture(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Turn a height field (Float32Array, size×size, tiling) into a normal map. */
function normalMap(height, size, strength) {
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return texture(c, { srgb: false });
}

/** Paint a greyscale image from a function of (x, y) → 0…1. */
function grey(size, fn) {
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(1, fn(x, y))) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Dusty, pebbled ground. */
function ground() {
  const S = 512;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      let e = n.fbm(u * 6, v * 6, 5, 6) * 0.9;
      e += n.fbm(u * 24, v * 24, 3, 24) * 0.35; // grit
      e += Math.pow(Math.max(0, n.noise(u * 46 + 3, v * 46, 46)), 4) * 0.9; // scattered pebbles
      h[y * S + x] = e;
    }
  }
  const map = texture(grey(S, (x, y) => 0.8 + h[y * S + x] * 0.16 + (n.random() - 0.5) * 0.07));
  return { map, normalMap: normalMap(h, S, 2.0) };
}

/** Painted hull plating: panel seams, rivets, streaks of grime. */
function plating() {
  const S = 512;
  const h = new Float32Array(S * S).fill(1);
  const [c, g] = canvas(S);
  g.fillStyle = '#d6d6d6';
  g.fillRect(0, 0, S, S);
  // Broad stains
  const img = g.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = 214 + n.fbm(x / S * 5, y / S * 5, 4, 5) * 46 - Math.max(0, n.fbm(x / S * 24, y / S * 3 + 4, 3, 24)) * 40;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
  }
  g.putImageData(img, 0, 0);
  // Panel seams on a 2×2 grid with offset, plus rivets
  const seam = (x0, y0, x1, y1) => {
    g.strokeStyle = 'rgba(20,20,22,0.85)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0 + 2, y0 + 2); g.lineTo(x1 + 2, y1 + 2); g.stroke();
    for (let t = 0; t <= 1; t += 1 / 256) {
      const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
      for (let k = -2; k <= 2; k++) {
        h[(((y + k) % S + S) % S) * S + ((x + k) % S + S) % S] = 0;
        h[((y % S + S) % S) * S + ((x + k) % S + S) % S] = 0;
        h[(((y + k) % S + S) % S) * S + (x % S + S) % S] = 0;
      }
    }
  };
  seam(0, 2, S, 2); seam(0, S / 2, S, S / 2); seam(2, 0, 2, S / 2); seam(S / 2, S / 2, S / 2, S); seam(S * 0.75, 0, S * 0.75, S / 2);
  g.fillStyle = 'rgba(30,30,32,0.7)';
  for (let x = 20; x < S; x += 40) for (const y of [12, S / 2 - 10, S / 2 + 12, S - 10]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
  // Grime running down from seams
  for (let i = 0; i < 90; i++) {
    const x = n.random() * S, y = n.random() < 0.5 ? 4 : S / 2 + 2, len = 20 + n.random() * 90;
    const grad = g.createLinearGradient(0, y, 0, y + len);
    grad.addColorStop(0, 'rgba(40,34,28,0.22)');
    grad.addColorStop(1, 'rgba(40,34,28,0)');
    g.fillStyle = grad;
    g.fillRect(x, y, 2 + n.random() * 5, len);
  }
  const rough = grey(S, (x, y) => 0.55 + n.fbm(x / S * 8, y / S * 8, 4, 8) * 0.35 + (1 - h[y * S + x]) * 0.3);
  return { map: texture(c), normalMap: normalMap(h, S, 1.6), roughnessMap: texture(rough, { srgb: false }) };
}

/** Interior deck: square anti-slip tiles. */
function deck() {
  const S = 256;
  const h = new Float32Array(S * S);
  const [c, g] = canvas(S);
  g.fillStyle = '#8d9096';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const edge = Math.min(x % 128, 127 - (x % 128), y % 128, 127 - (y % 128));
      const stud = ((x % 16) - 8) ** 2 + ((y % 16) - 8) ** 2 < 9 ? 1 : 0;
      h[y * S + x] = (edge < 3 ? 0 : 1) + stud * 0.5;
      if (edge < 3) { g.fillStyle = '#2c2e33'; g.fillRect(x, y, 1, 1); }
      else if (stud) { g.fillStyle = '#9b9ea5'; g.fillRect(x, y, 1, 1); }
    }
  }
  return { map: texture(c), normalMap: normalMap(h, S, 1.2) };
}

/** Solar cells: dark blue squares with silver busbars. */
function solar() {
  const S = 256;
  const [c, g] = canvas(S);
  g.fillStyle = '#0b1322';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 64) {
    for (let x = 0; x < S; x += 64) {
      const grad = g.createLinearGradient(x, y, x + 64, y + 64);
      grad.addColorStop(0, '#16284a');
      grad.addColorStop(1, '#0c1730');
      g.fillStyle = grad;
      g.fillRect(x + 2, y + 2, 60, 60);
      g.fillStyle = 'rgba(190,200,215,0.55)';
      g.fillRect(x + 21, y + 2, 1, 60);
      g.fillRect(x + 42, y + 2, 1, 60);
    }
  }
  return { map: texture(c) };
}

/** A console screen full of plausible read-outs. `accent` is a CSS colour. */
export function screenTexture(title, accent = '#7fd6dc', seed = 1) {
  const r = createNoise(seed).random;
  const [c, g] = canvas(512, 320);
  g.fillStyle = '#05090c';
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = accent;
  g.font = '600 26px system-ui, sans-serif';
  g.fillText(title, 20, 40);
  g.globalAlpha = 0.5;
  g.fillRect(20, 52, 472, 2);
  g.font = '15px ui-monospace, monospace';
  for (let i = 0; i < 9; i++) {
    g.globalAlpha = 0.35 + r() * 0.5;
    g.fillRect(20, 76 + i * 24, 30 + r() * 150, 9);
    g.fillRect(230, 76 + i * 24, 20 + r() * 80, 9);
  }
  g.globalAlpha = 0.8;
  g.strokeStyle = accent;
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= 150; x += 6) g.lineTo(340 + x, 200 - r() * 90 - x * 0.2);
  g.stroke();
  g.strokeRect(340, 76, 152, 150);
  g.beginPath(); g.arc(416, 268, 30, 0, 7); g.stroke();
  g.globalAlpha = 1;
  return texture(c, { repeat: false });
}

/** A stencilled name plate, like "HAB-02". */
export function labelTexture(text) {
  const [c, g] = canvas(256, 64);
  g.fillStyle = '#1c1e22';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#c9c4b8';
  g.lineWidth = 3;
  g.strokeRect(4, 4, 248, 56);
  g.fillStyle = '#e4dfd2';
  g.font = '700 34px ui-monospace, Menlo, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  return texture(c, { repeat: false });
}

/** Landing-pad paint: a ring, a cross and hazard edging. */
export function padTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  g.fillStyle = '#3a3b3d';
  g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (n.random() - 0.5) * 22 + n.fbm((i / 4 % S) / 60, Math.floor(i / 4 / S) / 60, 3) * 30;
    img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(214,160,60,0.85)';
  g.lineWidth = 14;
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, 7); g.stroke();
  g.lineWidth = 10;
  g.beginPath(); g.moveTo(S / 2, S * 0.3); g.lineTo(S / 2, S * 0.7); g.moveTo(S * 0.3, S / 2); g.lineTo(S * 0.7, S / 2); g.stroke();
  g.strokeStyle = 'rgba(225,225,220,0.7)';
  g.lineWidth = 6;
  g.strokeRect(14, 14, S - 28, S - 28);
  // Scorch marks and wear
  for (let i = 0; i < 14; i++) {
    const x = S / 2 + (n.random() - 0.5) * 260, y = S / 2 + (n.random() - 0.5) * 260, r = 30 + n.random() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(8,8,8,0.35)');
    grad.addColorStop(1, 'rgba(8,8,8,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return texture(c, { repeat: false });
}

/** Soft round dot, for dust, glows and light cones. */
export function softDot() {
  const [c, g] = canvas(64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return texture(c, { repeat: false });
}

export const TEX = { ground: ground(), plating: plating(), deck: deck(), solar: solar(), dot: softDot() };
