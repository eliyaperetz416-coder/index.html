// Visual effects: speed lines, nitro flames, sparks, camera shake, bloom + radial speed blur.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { glowTexture } from './models.js';

const SpeedShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0 }, aberr: { value: 0 }, vignette: { value: 0.35 }, center: { value: new THREE.Vector2(0.5, 0.42) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float strength; uniform float aberr; uniform float vignette; uniform vec2 center; varying vec2 vUv;
    void main(){
      vec2 d = vUv - center;
      float r = length(d);
      vec3 col = vec3(0.0);
      const int N = 7;
      for (int i = 0; i < N; i++) {
        float k = float(i) / float(N);
        vec2 uv = vUv - d * strength * k;
        col.r += texture2D(tDiffuse, uv - d * aberr).r;
        col.g += texture2D(tDiffuse, uv).g;
        col.b += texture2D(tDiffuse, uv + d * aberr).b;
      }
      col /= float(N);
      col *= 1.0 - vignette * smoothstep(0.35, 0.95, r);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Effects {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.quality = quality;
    this.shakeAmt = 0; this.time = 0;
    this._buildSpeedLines();
    this._buildSparks();
    this._buildFlames();
    this.composer = null;
    this.setQuality(quality);
  }

  // ---------- quality / composer ----------
  setQuality(q) {
    this.quality = q;
    const r = this.renderer;
    const w = r.domElement.width, h = r.domElement.height;
    if (this.composer) { this.composer.dispose?.(); this.composer = null; }
    this.bloom = null; this.speedPass = null;
    if (q !== 'low') {
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: q === 'high' ? 4 : 0 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      if (q === 'high') {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(2, w >> 1), Math.max(2, h >> 1)), 0.75, 0.55, 0.62);
        this.composer.addPass(this.bloom);
      }
      this.speedPass = new ShaderPass(SpeedShader);
      this.composer.addPass(this.speedPass);
      this.composer.addPass(new OutputPass());
    }
    this.lineMesh.count = q === 'low' ? 0 : q === 'medium' ? 40 : 70;
    this.lineMesh.visible = q !== 'low';
    this.resize();
  }

  resize() {
    const r = this.renderer; const size = r.getSize(new THREE.Vector2()); const pr = r.getPixelRatio();
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(size.x, size.y); }
    if (this.bloom) this.bloom.resolution.set(Math.max(2, (size.x * pr) >> 1), Math.max(2, (size.y * pr) >> 1));
  }

  render() {
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  // ---------- speed lines ----------
  _buildSpeedLines() {
    const geo = new THREE.BoxGeometry(0.035, 0.035, 1);
    this.lineMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.lineMesh = new THREE.InstancedMesh(geo, this.lineMat, 70);
    this.lineMesh.frustumCulled = false; this.lineMesh.renderOrder = 6;
    this.lines = Array.from({ length: 70 }, () => this._respawnLine({}, true));
    this.scene.add(this.lineMesh);
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }
  _respawnLine(l, anywhere) {
    const side = Math.random() < 0.5 ? -1 : 1;
    l.x = side * (1.6 + Math.random() * 9); l.y = 0.2 + Math.random() * 5.5; l.z = anywhere ? -Math.random() * 140 : -110 - Math.random() * 40;
    l.len = 0.6 + Math.random() * 0.8;
    return l;
  }

  // ---------- sparks ----------
  _buildSparks() {
    const N = 48;
    this.sparkN = N;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 0.5, map: glowTexture, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sparkPoints = new THREE.Points(g, m); this.sparkPoints.frustumCulled = false; this.sparkPoints.renderOrder = 7;
    this.sparks = Array.from({ length: N }, () => ({ life: 0, vx: 0, vy: 0, vz: 0, x: 0, y: -50, z: 0 }));
    this.scene.add(this.sparkPoints);
  }
  burst(x, y, z, count = 20, color = 0xffb02e, spread = 6) {
    const c = new THREE.Color(color); let n = 0;
    for (let i = 0; i < this.sparkN && n < count; i++) {
      const s = this.sparks[i]; if (s.life > 0) continue;
      s.life = 0.5 + Math.random() * 0.6; s.x = x; s.y = y; s.z = z;
      s.vx = (Math.random() - 0.5) * spread * 1.6; s.vy = 1 + Math.random() * spread * 0.7; s.vz = (Math.random() - 0.3) * spread * 2;
      s.r = c.r; s.g = c.g; s.b = c.b; n++;
    }
  }

  // ---------- nitro flames ----------
  _buildFlames() {
    this.flames = new THREE.Group(); this.flames.visible = false;
    const mat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
    const mat2 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
    for (const sx of [-0.45, 0.45]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 2.2, 8, 1, true), mat); c.rotation.x = Math.PI / 2; c.position.set(sx, 0.55, 1.2);
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.2, 8, 1, true), mat2); c2.rotation.x = Math.PI / 2; c2.position.set(sx, 0.55, 0.8);
      this.flames.add(c, c2);
    }
    this.flames.children.forEach((c) => (c.renderOrder = 6));
  }

  /** attach lights pools + flames to the player's root. */
  attachPlayer(player) {
    this.player = player;
    if (this._pools) { player.root.remove(this._pools); this._pools.children.forEach((m) => { m.geometry.dispose(); m.material.dispose(); }); }
    const g = new THREE.Group();
    const mk = (color, w, d, z, op) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color, map: glowTexture, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(0, 0.05, z); m.renderOrder = 3; g.add(m);
    };
    mk(0xfff0c8, 5.5, 20, -12, 0.55);   // headlight pool
    mk(0xff2040, 3.4, 4, 3.4, 0.4);     // taillight glow on the road
    this._pools = g; player.root.add(g);
    this.flames.position.set(0, 0, player.len / 2 - 0.2);
    player.root.add(this.flames);
  }

  // ---------- per frame ----------
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  update(dt, speedFrac, boost, camera, speed) {
    this.time += dt;
    // speed lines
    const sf = Math.min(1, Math.max(0, speedFrac));
    this.lineMat.opacity = Math.max(0, (sf - 0.25) * 0.9) + boost * 0.4;
    const n = this.lineMesh.count;
    if (n) {
      const lenS = 4 + sf * 22 + boost * 14;
      for (let i = 0; i < n; i++) {
        const l = this.lines[i];
        l.z += speed * 1.15 * dt;
        if (l.z > 8) this._respawnLine(l, false);
        this._p.set(l.x, l.y, l.z); this._s.set(1, 1, lenS * l.len);
        this._m.compose(this._p, this._q, this._s); this.lineMesh.setMatrixAt(i, this._m);
      }
      this.lineMesh.instanceMatrix.needsUpdate = true;
    }
    // sparks
    const pa = this.sparkPoints.geometry.attributes.position, ca = this.sparkPoints.geometry.attributes.color;
    for (let i = 0; i < this.sparkN; i++) {
      const s = this.sparks[i];
      if (s.life > 0) { s.life -= dt; s.vy -= 14 * dt; s.x += s.vx * dt; s.y = Math.max(0.05, s.y + s.vy * dt); s.z += (s.vz + speed * 0.6) * dt; }
      const a = Math.max(0, s.life);
      pa.setXYZ(i, s.x, s.life > 0 ? s.y : -50, s.z); ca.setXYZ(i, s.r * a * 2, s.g * a * 2, s.b * a * 2);
    }
    pa.needsUpdate = true; ca.needsUpdate = true;
    // flames
    this.flames.visible = boost > 0.02;
    if (this.flames.visible) {
      const f = 0.8 + Math.sin(this.time * 70) * 0.2 + Math.random() * 0.2;
      this.flames.scale.set(1, 1, f * Math.min(1, boost * 6));
    }
    // post
    if (this.speedPass) {
      const u = this.speedPass.uniforms;
      u.strength.value = THREE.MathUtils.lerp(u.strength.value, sf * 0.03 + boost * 0.055, Math.min(1, dt * 6));
      u.aberr.value = u.strength.value * 0.12;
    }
    // shake -> returns offset applied by caller
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
  }

  shakeOffset(out) {
    const a = this.shakeAmt * this.shakeAmt;
    out.set((Math.random() - 0.5) * a * 1.2, (Math.random() - 0.5) * a * 0.9, 0);
    return out;
  }
}
