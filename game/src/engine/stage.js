// Builds a playable 3D scene from a scene entry in chapter data.
import * as THREE from 'three';
import { loadModel } from './assets.js';
import { toonify } from './toon.js';
import { Character } from './character.js';

function makeSky({ top, horizon }) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float k = smoothstep(-0.05, 0.45, vDir.y);
        gl_FragColor = vec4(mix(horizon, top, k), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 16, 10), mat);
  sky.name = 'sky';
  sky.renderOrder = -1;
  return sky;
}

export class Stage {
  constructor(sceneData) {
    this.data = sceneData;
    this.scene = new THREE.Scene();
    this.objects = {};     // id -> Object3D (assets with an "id")
    this.characters = {};  // id -> Character
    this.markers = {};     // empties from GLBs, e.g. Seat_Light
    this.tweens = [];
  }

  async load() {
    const { lighting } = this.data;
    this.scene.background = new THREE.Color(lighting.sky.horizon);
    this.scene.fog = new THREE.Fog(lighting.fog.color, lighting.fog.near, lighting.fog.far);
    this.scene.add(makeSky(lighting.sky));

    const a = lighting.ambient;
    this.ambient = new THREE.HemisphereLight(a.sky, a.ground, a.intensity);
    this.scene.add(this.ambient);

    const k = lighting.key;
    this.key = new THREE.DirectionalLight(k.color, k.intensity);
    this.key.position.set(...k.position);
    this.key.target.position.set(...k.target);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    Object.assign(this.key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 45 });
    this.key.shadow.bias = -0.0015;
    this.key.shadow.normalBias = 0.04;
    this.scene.add(this.key, this.key.target);

    const models = await Promise.all(this.data.assets.map((asset) => loadModel(asset.file)));
    // Static models first, so their markers exist when placing the rest.
    this.data.assets.forEach((asset, i) => {
      if (!asset.at) this.addStatic(models[i]);
    });
    this.data.assets.forEach((asset, i) => {
      if (asset.at) this.addPlaced(asset, models[i]);
    });
  }

  addStatic(model) {
    toonify(model);
    model.traverse((o) => { if (!o.isMesh && o.name && o.children.length === 0) this.markers[o.name] = o; });
    this.scene.add(model);
  }

  addPlaced(asset, model) {
    const marker = this.markers[asset.at];
    if (!marker) throw new Error(`Marker not found: ${asset.at}`);
    toonify(model);
    const holder = new THREE.Group();
    holder.name = asset.id;
    marker.getWorldPosition(holder.position);
    marker.getWorldQuaternion(holder.quaternion);
    holder.add(model);
    holder.visible = !asset.hidden;
    this.scene.add(holder);
    this.objects[asset.id] = holder;
    if (asset.pose) {
      const character = new Character(model);
      character.setPose(asset.pose);
      this.characters[asset.id] = character;
    }
  }

  // ---- actions callable from cutscene data ----

  /** Drops an object from the sky onto its current spot, tumbling. */
  fall({ target, from, duration }) {
    const obj = this.objects[target];
    const end = obj.position.clone();
    const start = new THREE.Vector3(...from);
    const endRot = obj.rotation.clone();
    const spin = new THREE.Vector3(7.3, 2.1, 5.2);
    obj.visible = true;
    this.addTween(duration, (k) => {
      const e = k * k;  // accelerating, like gravity
      obj.position.lerpVectors(start, end, e);
      const rest = 1 - e;
      obj.rotation.set(endRot.x + spin.x * rest, endRot.y + spin.y * rest, endRot.z + spin.z * rest);
    });
  }

  setPose({ target, pose, duration }) {
    this.characters[target].setPose(pose, duration);
  }

  /** Blends key/ambient light color and intensity. */
  setLights({ lights, duration = 1 }) {
    for (const [name, change] of Object.entries(lights)) {
      const light = this[name];
      const fromI = light.intensity;
      const fromC = light.color.clone();
      const toC = change.color ? new THREE.Color(change.color) : fromC;
      const toI = change.intensity ?? fromI;
      this.addTween(duration, (k) => {
        light.intensity = THREE.MathUtils.lerp(fromI, toI, k);
        light.color.lerpColors(fromC, toC, k);
      });
    }
  }

  addTween(duration, step) {
    this.tweens.push({ t: 0, duration, step });
  }

  update(dt) {
    for (const c of Object.values(this.characters)) c.update(dt);
    this.tweens = this.tweens.filter((tw) => {
      tw.t += dt;
      const k = Math.min(tw.t / tw.duration, 1);
      tw.step(k);
      return k < 1;
    });
  }
}
