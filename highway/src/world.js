// Builds and animates a world from a world config (src/data/worlds.js).
// The player stays at z=0; the world scrolls towards +Z at the player's speed.
import * as THREE from 'three';
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
    this._buildAtmosphere();
    this._buildRoad();
    this._buildBarriers();
    this._buildBuildings();
    this._buildStreetlights();
    this._buildGantries();
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
    this.root.add(hemi, dir);

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
    const mat = new THREE.MeshLambertMaterial({ map: this.roadTex, color: 0xffffff, emissive: 0x1a1030, emissiveIntensity: 0.6 });
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
    const pool = new THREE.MeshBasicMaterial({ vertexColors: true, map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35, fog: true });
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

  // ---------- per-frame ----------
  update(dt, speed) {
    this.roadOffset = (this.roadOffset + (speed * dt) / TILE) % 1;
    this.roadTex.offset.y = this.roadOffset;
    for (const d of this.dyn) if (d.tick) d.tick(dt, speed);   // move slot z values
    for (const d of this.dyn) if (d.write) d.write();           // then upload instance matrices
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
    this.disposables.forEach((x) => x.dispose && x.dispose());
    this.scene.background = null; this.scene.fog = null;
  }
}
