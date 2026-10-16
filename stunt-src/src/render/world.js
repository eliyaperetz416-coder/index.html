// World environment: sky dome, fog, lights, ground and scenery around a track.

import {
  Group, Mesh, SphereGeometry, ShaderMaterial, BackSide, Color, Fog, HemisphereLight, DirectionalLight,
  PlaneGeometry, MeshBasicMaterial, Points, BufferGeometry, Float32BufferAttribute, PointsMaterial,
} from 'three';
import { gridTexture } from './textures.js';
import { buildScenery } from './scenery.js';
import { rng } from '../core/math.js';

const SKY_VS = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FS = `
uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
varying vec3 vDir;
void main() {
  float y = vDir.y;
  vec3 c = y > 0.0 ? mix(horizon, top, pow(y, 0.6)) : mix(horizon, bottom, pow(-y, 0.4));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * @returns {Group} with userData.dispose(), userData.follow(pos) to keep the sky centred on the camera
 */
export function buildWorld(scene, world, path, quality) {
  const group = new Group();
  group.name = 'world';
  const disposables = [];

  scene.fog = new Fog(world.fog.color, world.fog.near * quality.fogScale, world.fog.far * quality.fogScale);
  scene.background = new Color(world.fog.color);

  const skyGeo = new SphereGeometry(2400, 32, 16);
  const skyMat = new ShaderMaterial({
    vertexShader: SKY_VS,
    fragmentShader: SKY_FS,
    uniforms: {
      top: { value: new Color(world.sky.top) },
      horizon: { value: new Color(world.sky.horizon) },
      bottom: { value: new Color(world.sky.bottom) },
    },
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);
  disposables.push(skyGeo, skyMat);

  if (world.sky.stars) {
    const r = rng(11);
    const pts = [];
    for (let i = 0; i < 700; i++) {
      const a = r() * Math.PI * 2;
      const y = 0.08 + r() * 0.92;
      const k = Math.sqrt(1 - y * y);
      pts.push(Math.cos(a) * k * 2200, y * 2200, Math.sin(a) * k * 2200);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    const m = new PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 });
    const stars = new Points(g, m);
    stars.frustumCulled = false;
    sky.add(stars);
    disposables.push(g, m);
  }

  const hemi = new HemisphereLight(world.light.hemiSky, world.light.hemiGround, world.light.hemi);
  const sun = new DirectionalLight(world.light.sun, world.light.sunIntensity);
  sun.position.set(...world.light.sunDir).multiplyScalar(100);
  group.add(hemi, sun);

  const groundY = path.minY - 45;
  const groundGeo = new PlaneGeometry(8000, 8000);
  const tex = gridTexture(world.ground).clone();
  tex.repeat.set(8000 / world.ground.gridSize, 8000 / world.ground.gridSize);
  tex.needsUpdate = true;
  const groundMat = new MeshBasicMaterial({ map: tex });
  const ground = new Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  // Centre the ground under the track.
  const mid = path.sampleAt(path.length / 2).pos;
  ground.position.set(mid.x, groundY, mid.z);
  group.add(ground);
  disposables.push(groundGeo, groundMat, tex);

  const scenery = buildScenery(world, path, groundY, quality);
  group.add(scenery.group);
  disposables.push(...scenery.disposables);

  group.userData.follow = (pos) => sky.position.copy(pos);
  group.userData.dispose = () => {
    for (const d of disposables) d.dispose();
    group.clear();
  };
  return group;
}
