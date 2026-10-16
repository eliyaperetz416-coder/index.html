// Visual effects: pooled particles (sparks, smoke, nitro flames, coin glitter) and speed lines.
// Fixed-size pools: nothing is allocated while racing.

import {
  Points, BufferGeometry, BufferAttribute, ShaderMaterial, AdditiveBlending, NormalBlending, Color,
  Mesh, MeshBasicMaterial, DoubleSide,
} from 'three';

const VS = `
attribute float size;
attribute float alpha;
attribute vec3 color;
varying float vAlpha;
varying vec3 vColor;
uniform float scale;
void main() {
  vAlpha = alpha;
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

export class Particles {
  constructor(max, { additive = true } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.next = 0;
    const g = new BufferGeometry();
    this.attrs = {
      position: new BufferAttribute(this.pos, 3),
      color: new BufferAttribute(this.col, 3),
      size: new BufferAttribute(this.size, 1),
      alpha: new BufferAttribute(this.alpha, 1),
    };
    for (const [k, a] of Object.entries(this.attrs)) {
      a.setUsage(35048); // DynamicDrawUsage
      g.setAttribute(k, a);
    }
    this.material = new ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: { scale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.points = new Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geometry = g;
  }

  /**
   * @param {Vector3} p position
   * @param {Vector3} v velocity
   * @param {object} o { life, size, grow (size/s), color (Color), alpha, drag, gravity }
   */
  spawn(p, v, o) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const k = i * 3;
    this.pos[k] = p.x; this.pos[k + 1] = p.y; this.pos[k + 2] = p.z;
    this.vel[k] = v.x; this.vel[k + 1] = v.y; this.vel[k + 2] = v.z;
    this.col[k] = o.color.r; this.col[k + 1] = o.color.g; this.col[k + 2] = o.color.b;
    this.size[i] = o.size ?? 1;
    this.a0[i] = o.alpha ?? 1;
    this.alpha[i] = this.a0[i];
    this.life[i] = o.life ?? 0.5;
    this.age[i] = 0;
    this.grow[i] = o.grow ?? 0;
    this.drag[i] = o.drag ?? 1;
    this.grav[i] = o.gravity ?? 0;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.alpha[i] <= 0) continue;
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      const k = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[k] *= d;
      this.vel[k + 1] = this.vel[k + 1] * d - this.grav[i] * dt;
      this.vel[k + 2] *= d;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = this.a0[i] * (1 - t) * (1 - t);
    }
    for (const a of Object.values(this.attrs)) a.needsUpdate = true;
  }

  clear() {
    this.alpha.fill(0);
    this.size.fill(0);
  }

  setScale(px) {
    this.material.uniforms.scale.value = px;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Streaks flying past the camera at speed. Lives in camera space (child of the camera). */
export class SpeedLines {
  constructor(count = 48) {
    this.count = count;
    this.lines = [];
    const pos = new Float32Array(count * 4 * 3);
    const idx = [];
    for (let i = 0; i < count; i++) {
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);
      this.lines.push(this.respawn({}, true));
    }
    const g = new BufferGeometry();
    this.attr = new BufferAttribute(pos, 3);
    this.attr.setUsage(35048);
    g.setAttribute('position', this.attr);
    g.setIndex(idx);
    this.material = new MeshBasicMaterial({ color: '#dff8ff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, depthTest: false, side: DoubleSide });
    this.mesh = new Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.geometry = g;
    this.intensity = 0;
  }

  respawn(l, anywhere = false) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.2 + Math.random() * 4.5;
    l.x = Math.cos(a) * r;
    l.y = Math.sin(a) * r * 1.6;
    l.z = anywhere ? -10 - Math.random() * 50 : -45 - Math.random() * 15;
    l.len = 3 + Math.random() * 6;
    l.w = 0.02 + Math.random() * 0.03;
    return l;
  }

  /** k: 0..1 how strong (speed / boost). */
  update(dt, k, speed) {
    this.intensity += (k - this.intensity) * Math.min(1, dt * 5);
    this.material.opacity = this.intensity * 0.55;
    this.mesh.visible = this.intensity > 0.02;
    if (!this.mesh.visible) return;
    const p = this.attr.array;
    const v = 30 + speed * 1.5;
    this.lines.forEach((l, i) => {
      l.z += v * dt;
      if (l.z > -1.5) this.respawn(l);
      // Thin quad, widened across the radial direction so it reads as a streak.
      const r = Math.hypot(l.x, l.y) || 1;
      const tx = (-l.y / r) * l.w;
      const ty = (l.x / r) * l.w;
      const z1 = l.z - l.len * this.intensity;
      const o = i * 12;
      p[o] = l.x - tx; p[o + 1] = l.y - ty; p[o + 2] = l.z;
      p[o + 3] = l.x + tx; p[o + 4] = l.y + ty; p[o + 5] = l.z;
      p[o + 6] = l.x - tx; p[o + 7] = l.y - ty; p[o + 8] = z1;
      p[o + 9] = l.x + tx; p[o + 10] = l.y + ty; p[o + 11] = z1;
    });
    this.attr.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

export const COLORS = {
  spark: new Color('#ffd27a'),
  sparkHot: new Color('#ffffff'),
  smoke: new Color('#b8b0d0'),
  nitro: new Color('#38c8ff'),
  nitroCore: new Color('#e6f9ff'),
  flame: new Color('#ff7a1a'),
  coin: new Color('#ffe14a'),
  boost: new Color('#ffcc00'),
  hit: new Color('#ff4060'),
};

