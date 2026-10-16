// Builds and animates a world from a world config (src/data/worlds.js).
// The player stays at z=0; the world scrolls towards +Z at the player's speed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from './config.js';
import { models, glowTexture } from './models.js';

const RING = 420; // length of the recycling scenery loop (metres)
const TILE = 24;  // length of one road texture tile (metres)

export const laneX = (world, i) => (i - (world.lanes.length - 1) / 2) * CFG.laneWidth;

function rngFactory(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

export class World {
  constructor(scene, def, quality = 'high') {
    this.scene = scene; this.def = def; this.quality = quality;
    this.root = new THREE.Group(); scene.add(this.root);
    this.dyn = []; // things that recycle: { update(dt, speed) }
    this.roadOffset = 0;
    this.disposables = [];
    const n = def.lanes.length;
    this.roadWidth = n * CFG.laneWidth;
    this.tunnelTex = [];
    this._buildAtmosphere();
    this._buildRoad();
    this._buildBarriers();
    if (def.structure === 'tunnel') this._buildTunnel();
    else { this._buildBuildings(); this._buildStreetlights(); this._buildGantries(); }
    if (def.rain) this._buildRain();
    this.lightningT = 4 + Math.random() * 5; this.flash = 0;
  }

  // ---------- atmosphere ----------
  _buildAtmosphere() {
    const d = this.def;
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#' + new THREE.Color(d.sky.top).getHexString());
    grd.addColorStop(0.62, '#' + new THREE.Color(d.sky.bottom).getHexString());
    grd.addColorStop(0.78, '#' + new THREE.Color(d.sky.glow).getHexString());
    grd.addColorStop(1, '#' + new THREE.Color(d.fog.color).getHexString());
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = bg; this.disposables.push(bg);
    this.scene.fog = new THREE.Fog(d.fog.color, d.fog.near, d.fog.far);

    const hemi = new THREE.HemisphereLight(d.ambient.sky, d.ambient.ground, d.ambient.intensity);
    const dir = new THREE.DirectionalLight(0x9a8cff, 0.5); dir.position.set(-20, 40, 30);
    this.hemi = hemi; this.baseHemi = d.ambient.intensity; this.baseFog = new THREE.Color(d.fog.color);
    this.root.add(hemi, dir);

    if (d.structure !== 'city') return;
    // distant skyline silhouette (not fogged, so it reads as a far-away city glow)
    const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 128;
    const s = sc.getContext('2d'); const rnd = rngFactory(99);
    s.fillStyle = '#0b0618';
    for (let x = 0; x < 1024;) {
      const w = 14 + rnd() * 34, h = 20 + rnd() * rnd() * 100;
      s.fillRect(x, 128 - h, w, h);
      s.fillStyle = rnd() < 0.5 ? '#ff2e9a' : '#00e5ff'; s.globalAlpha = 0.5;
      for (let k = 0; k < 4; k++) s.fillRect(x + 3 + rnd() * (w - 6), 128 - h + rnd() * h, 2, 2);
      s.globalAlpha = 1; s.fillStyle = '#0b0618'; x += w + 2;
    }
    const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(900, 112), new THREE.MeshBasicMaterial({ map: st, transparent: true, fog: false, depthWrite: false }));
    sky.position.set(0, 52, -400); sky.renderOrder = -1;
    this.root.add(sky); this.disposables.push(st);
  }

  // ---------- road ----------
  _roadTexture() {
    const d = this.def, n = d.lanes.length;
    const totalW = this.roadWidth + CFG.roadShoulder * 2;
    const W = 1024, H = 512, pxm = W / totalW;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = d.road.color; g.fillRect(0, 0, W, H);
    const rnd = rngFactory(7);
    for (let i = 0; i < 5000; i++) { const v = 20 + rnd() * 26; g.fillStyle = `rgba(${v},${v},${v + 6},0.35)`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
    if (d.wet) {
      for (let i = 0; i < 26; i++) {
        const x = rnd() * W, y = rnd() * H, rw = 40 + rnd() * 120, rh = 20 + rnd() * 70;
        const grd = g.createRadialGradient(x, y, 0, x, y, rw);
        grd.addColorStop(0, 'rgba(120,160,210,0.28)'); grd.addColorStop(1, 'rgba(120,160,210,0)');
        g.save(); g.translate(x, y); g.scale(1, rh / rw); g.translate(-x, -y); g.fillStyle = grd; g.beginPath(); g.arc(x, y, rw, 0, 7); g.fill(); g.restore();
      }
    }
    const xAt = (i) => (CFG.roadShoulder + i * CFG.laneWidth) * pxm;
    const dashLen = 3 * (H / TILE);
    // lane dividers
    const centerIdx = d.lanes.findIndex((l, i) => i > 0 && l.dir !== d.lanes[i - 1].dir);
    for (let i = 1; i < n; i++) {
      if (i === centerIdx) {
        g.fillStyle = d.road.center;
        g.fillRect(xAt(i) - 7, 0, 4, H); g.fillRect(xAt(i) + 3, 0, 4, H);
      } else {
        g.fillStyle = d.road.line;
        for (let k = 0; k < 2; k++) g.fillRect(xAt(i) - 3, k * (H / 2), 6, dashLen);
      }
    }
    g.fillStyle = d.road.line; g.fillRect(xAt(0) - 6, 0, 6, H); g.fillRect(xAt(n) + 0, 0, 6, H);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4; t.repeat.set(1, 600 / TILE);
    return t;
  }

  _buildRoad() {
    this.roadTex = this._roadTexture();
    const totalW = this.roadWidth + CFG.roadShoulder * 2;
    const geo = new THREE.PlaneGeometry(totalW, 600); geo.rotateX(-Math.PI / 2);
    const mat = this.def.wet
      ? new THREE.MeshPhongMaterial({ map: this.roadTex, color: 0xffffff, emissive: 0x0c1a2c, emissiveIntensity: 0.7, shininess: 90, specular: 0x6688aa })
      : new THREE.MeshLambertMaterial({ map: this.roadTex, color: 0xffffff, emissive: 0x1a1030, emissiveIntensity: 0.6 });
    const road = new THREE.Mesh(geo, mat); road.position.set(0, 0, -260); this.root.add(road);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 700).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x07050e }));
    ground.position.set(0, -0.05, -280); this.root.add(ground);
    this.disposables.push(this.roadTex, geo, mat);
  }

  _buildBarriers() {
    const half = this.roadWidth / 2 + CFG.roadShoulder;
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x1b1b28 });
    const mk = (x, hex) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 620), wallMat); wall.position.set(x, 0.45, -260);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 620), new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }));
      strip.position.set(x - Math.sign(x) * 0.2, 0.8, -260);
      this.root.add(wall, strip);
    };
    mk(-half - 0.25, this.def.road.edgeGlow); mk(half + 0.25, this.def.road.edgeGlow2);
  }

  // ---------- recycling scenery helpers ----------
  _instanced(geometry, material, slots, { transparent = false } = {}) {
    const mesh = new THREE.InstancedMesh(geometry, material, slots.length);
    mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(mesh);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    const write = () => {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]; q.setFromAxisAngle(up, s.ry || 0); p.set(s.x, s.y || 0, s.z); m.compose(p, q, sc); mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    write();
    this.dyn.push({ slots, write });
    return mesh;
  }

  _ringUpdate(slots, dt, speed, onWrap) {
    const dz = speed * dt;
    for (const s of slots) { s.z += dz; if (s.z > 40) { s.z -= RING; onWrap && onWrap(s); } }
  }

  _buildBuildings() {
    const d = this.def, q = this.quality;
    const kit = models.createBuildingKit(d);
    const rnd = rngFactory(42);
    const spacing = q === 'low' ? 34 : q === 'medium' ? 26 : 20;
    const edge = this.roadWidth / 2 + CFG.roadShoulder + d.buildings.gap;
    const perSide = Math.floor(RING / spacing);
    const groups = kit.map(() => []);
    for (const side of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        const ci = Math.floor(rnd() * kit.length), k = kit[ci];
        const slot = { x: side * (edge + k.w / 2 + rnd() * 5), z: 40 - i * spacing - rnd() * 6, ry: 0, side, w: k.w, ci };
        groups[ci].push(slot);
      }
    }
    this.buildingSlots = [];
    groups.forEach((slots, ci) => {
      if (!slots.length) return;
      this._instanced(kit[ci].geometry, kit[ci].material, slots);
      this.buildingSlots.push(...slots);
    });
    this.dyn.push({ tick: (dt, speed) => this._ringUpdate(this.buildingSlots, dt, speed, (s) => { s.x = s.side * (edge + s.w / 2 + Math.random() * 5); }) });
  }

  _buildStreetlights() {
    const d = this.def.streetlights; if (!d) return;
    const kit = models.createStreetlightKit(d.color);
    const count = Math.floor(RING / d.spacing);
    const edge = this.roadWidth / 2 + CFG.roadShoulder + 0.9;
    const mk = (side) => Array.from({ length: count }, (_, i) => ({ x: side * edge, z: 20 - i * d.spacing - (side > 0 ? 0 : d.spacing / 2), ry: side > 0 ? 0 : Math.PI }));
    const slots = [...mk(1), ...mk(-1)];
    const pole = new THREE.MeshLambertMaterial({ color: 0x2a2a38, vertexColors: true });
    const lamp = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const pool = new THREE.MeshBasicMaterial({ vertexColors: true, map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: this.def.wet ? 0.7 : 0.35, fog: true });
    this._instanced(kit.pole, pole, slots);
    this._instanced(kit.lamp, lamp, slots);
    const poolMesh = this._instanced(kit.pool, pool, slots); poolMesh.renderOrder = 2;
    this.dyn.push({ tick: (dt, speed) => this._ringUpdate(slots, dt, speed) });
  }

  _buildGantries() {
    const d = this.def;
    const kit = models.createGantryKit(this.roadWidth, d.road.edgeGlow);
    const slots = Array.from({ length: 3 }, (_, i) => ({ x: 0, z: -30 - i * 140, ry: 0 }));
    const frame = new THREE.MeshLambertMaterial({ color: 0x22222e, vertexColors: true });
    const neon = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this._instanced(kit.frame, frame, slots); this._instanced(kit.neon, neon, slots);
    this.dyn.push({ tick: (dt, speed) => this._ringUpdate(slots, dt, speed) });
  }

  // ---------- tunnel ----------
  _panelTexture(base, seam) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    const rnd = rngFactory(5);
    for (let i = 0; i < 900; i++) { const v = rnd() * 14; g.fillStyle = `rgba(${v + 18},${v + 14},${v + 24},0.5)`; g.fillRect(rnd() * 256, rnd() * 256, 3, 3); }
    g.fillStyle = seam; g.fillRect(0, 0, 256, 5); g.fillRect(0, 126, 256, 3);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
    this.tunnelTex.push(t); this.disposables.push(t); return t;
  }

  _buildTunnel() {
    const T = this.def.tunnel, half = this.roadWidth / 2 + CFG.roadShoulder + 0.5, H = 7.4, LEN = 620;
    // walls + ceiling (textures scroll with the road so they move past the camera)
    const tex = this._panelTexture('#1a1822', '#2e2a3a'); tex.repeat.set(LEN / 24, 1);
    const wallMat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x110b1c, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const mkWall = (x, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(LEN, H), wallMat); m.rotation.y = ry; m.position.set(x, H / 2, -260); this.root.add(m);
    };
    mkWall(-half, Math.PI / 2); mkWall(half, Math.PI / 2);
    const ctex = tex.clone(); ctex.needsUpdate = true; ctex.repeat.set(3, LEN / 24); this.ceilTex = ctex; this.disposables.push(ctex);
    const ceilMat = new THREE.MeshLambertMaterial({ map: ctex, emissive: 0x110b1c, emissiveIntensity: 0.6 }); this.disposables.push(ceilMat);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, LEN), ceilMat); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -260); this.root.add(ceil);
    this.wallTex = tex;
    // continuous neon strips
    const strip = (x, y, hex) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, LEN), new THREE.MeshBasicMaterial({ color: hex, toneMapped: false })); m.position.set(x, y, -260); this.root.add(m); };
    for (const [y, a, b] of [[1.5, T.strip1, T.strip2], [5.9, T.strip2, T.strip1]]) { strip(-half + 0.1, y, a); strip(half - 0.1, y, b); }
    // ribs (instanced arches) + ceiling lamps + light pools
    const rib = [];
    const bx = (w, hh, d, x, y, z) => { const g = new THREE.BoxGeometry(w, hh, d); g.translate(x, y, z); return g; };
    const ribGeo = mergeGeometries([bx(0.7, H, 0.7, -half + 0.35, H / 2, 0), bx(0.7, H, 0.7, half - 0.35, H / 2, 0), bx(half * 2, 0.7, 0.7, 0, H - 0.35, 0)]);
    const ribSlots = Array.from({ length: Math.floor(RING / T.ribSpacing) }, (_, i) => ({ x: 0, z: 30 - i * T.ribSpacing }));
    this._instanced(ribGeo, new THREE.MeshLambertMaterial({ color: 0x24202e, emissive: 0x08060e }), ribSlots);
    const lampGeo = bx(3.2, 0.12, 1.1, 0, H - 0.5, 0);
    const poolGeo = new THREE.PlaneGeometry(10, 12).rotateX(-Math.PI / 2); poolGeo.translate(0, 0.06, 0);
    const lampSlots = Array.from({ length: Math.floor(RING / T.lightSpacing) }, (_, i) => ({ x: 0, z: 10 - i * T.lightSpacing }));
    this._instanced(lampGeo, new THREE.MeshBasicMaterial({ color: T.light, toneMapped: false }), lampSlots);
    const poolMesh = this._instanced(poolGeo, new THREE.MeshBasicMaterial({ color: T.light, map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 }), lampSlots);
    poolMesh.renderOrder = 2;
    this.dyn.push({ tick: (dt, speed) => { this._ringUpdate(ribSlots, dt, speed); this._ringUpdate(lampSlots, dt, speed); } });
    this.disposables.push(wallMat);
  }

  // ---------- rain ----------
  _buildRain() {
    const R = this.def.rain, k = this.quality === 'low' ? 0.4 : this.quality === 'medium' ? 0.7 : 1;
    const N = Math.floor(R.count * k);
    this.rainN = N; this.rain = { x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N) };
    for (let i = 0; i < N; i++) this._dropReset(i, true);
    const pos = new Float32Array(N * 6);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: R.color, transparent: true, opacity: 0.4, depthWrite: false }));
    this.rainMesh.frustumCulled = false; this.rainMesh.renderOrder = 4; this.root.add(this.rainMesh);
  }
  _dropReset(i, anywhere) {
    this.rain.x[i] = (Math.random() - 0.5) * 40; this.rain.y[i] = anywhere ? Math.random() * 16 : 14 + Math.random() * 3; this.rain.z[i] = -80 + Math.random() * 90;
  }
  _updateRain(dt, speed) {
    const R = this.def.rain, pos = this.rainMesh.geometry.attributes.position, r = this.rain;
    const vy = -R.speed, vz = speed * 0.8 + 6, len = 0.03;
    for (let i = 0; i < this.rainN; i++) {
      r.y[i] += vy * dt; r.z[i] += vz * dt;
      if (r.y[i] < 0 || r.z[i] > 12) this._dropReset(i, false);
      const j = i * 6;
      pos.array[j] = r.x[i]; pos.array[j + 1] = r.y[i]; pos.array[j + 2] = r.z[i];
      pos.array[j + 3] = r.x[i]; pos.array[j + 4] = r.y[i] - vy * len; pos.array[j + 5] = r.z[i] - vz * len;
    }
    pos.needsUpdate = true;
  }

  // ---------- per-frame ----------
  update(dt, speed) {
    this.roadOffset = (this.roadOffset + (speed * dt) / TILE) % 1;
    this.roadTex.offset.y = this.roadOffset;
    if (this.wallTex) { this.wallOffset = ((this.wallOffset || 0) + (speed * dt) / 24) % 1; this.wallTex.offset.x = this.wallOffset; this.ceilTex.offset.y = -this.wallOffset; }
    if (this.rain) this._updateRain(dt, speed);
    if (this.def.lightning) this._lightning(dt);
    for (const d of this.dyn) if (d.tick) d.tick(dt, speed);   // move slot z values
    for (const d of this.dyn) if (d.write) d.write();           // then upload instance matrices
  }

  _lightning(dt) {
    this.lightningT -= dt;
    if (this.lightningT <= 0) { this.flash = 1; this.lightningT = 6 + Math.random() * 9; this.second = Math.random() < 0.6 ? 0.22 : -1; }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      if (this.second > 0) { this.second -= dt; if (this.second <= 0) this.flash = 0.9; }
    }
    this.hemi.intensity = this.baseHemi + this.flash * 2.6;
    this.scene.fog.color.copy(this.baseFog).lerp(this._white || (this._white = new THREE.Color(0x8fb4e8)), this.flash * 0.6);
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
    this.disposables.forEach((x) => x.dispose && x.dispose());
    this.scene.background = null; this.scene.fog = null;
  }
}
