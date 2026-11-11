// Everything above the horizon: stars, the sun, the ringed giant, haze, drifting dust.

import * as THREE from 'three';
import { TEX } from './textures.js';
import { createNoise } from '../engine/noise.js';

export const SUN_DIR = new THREE.Vector3(-0.72, 0.27, 0.38).normalize();
export const HAZE = new THREE.Color('#1a2030');

const NOISE_GLSL = /* glsl */ `
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }`;

function dome() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(9000, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: SUN_DIR }, haze: { value: HAZE } },
      vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 sunDir, haze; varying vec3 vDir;
        ${NOISE_GLSL}
        void main() {
          vec3 d = normalize(vDir);
          float up = max(d.y, 0.0);
          vec3 col = mix(haze * 1.25, vec3(0.002, 0.003, 0.007), pow(up, 0.32));
          float s = max(dot(d, sunDir), 0.0);
          col += vec3(0.95, 0.42, 0.16) * pow(s, 6.0) * 0.16 * (1.0 - up);   // dusk glow around the sun
          col += vec3(1.0, 0.62, 0.34) * pow(s, 60.0) * 0.5;
          // A faint river of far-off stars and gas across the sky
          float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.5, 0.79))) * 3.2, 2.0));
          float cloud = fbm3(d * 3.5 + 4.0);
          col += (vec3(0.10, 0.11, 0.17) * cloud + vec3(0.11, 0.05, 0.09) * fbm3(d * 6.0)) * band * 0.38 * smoothstep(0.02, 0.35, up);
          col = mix(col, haze * 0.5, smoothstep(0.0, -0.06, d.y));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
}

function stars() {
  const r = createNoise(11).random;
  const count = 5200;
  const positions = new Float32Array(count * 3), sizes = new Float32Array(count), tints = new Float32Array(count * 3);
  const v = new THREE.Vector3(), bandNormal = new THREE.Vector3(0.35, 0.5, 0.79).normalize();
  const palette = [[1, 1, 1], [0.75, 0.84, 1], [1, 0.9, 0.76], [1, 0.78, 0.66]];
  for (let i = 0; i < count; i++) {
    do {
      v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    } while (v.lengthSq() > 1 || v.lengthSq() < 0.01 || (i % 3 === 0 && Math.abs(v.clone().normalize().dot(bandNormal)) > 0.25));
    v.normalize().multiplyScalar(8500).toArray(positions, i * 3);
    sizes[i] = 1 + r() ** 9 * 3.2;
    palette[Math.floor(r() * palette.length)].forEach((c, k) => (tints[i * 3 + k] = c));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('tint', new THREE.BufferAttribute(tints, 3));
  return new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { scale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute vec3 tint; uniform float scale; varying vec3 vTint; varying float vFade;
      void main() {
        vTint = tint * (0.22 + size * 0.22);
        vFade = smoothstep(0.02, 0.22, normalize(position).y);     // haze swallows stars near the horizon
        gl_PointSize = size * scale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vTint; varying float vFade;
      void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vTint * vFade * smoothstep(0.5, 0.0, d), 1.0); }`,
  }));
}

/** The gas giant the moon orbits, with its rings. */
function giant() {
  const group = new THREE.Group();
  const R = 1300;
  group.position.set(0.30, 0.36, -0.88).normalize().multiplyScalar(6200);
  group.rotation.set(0.42, 0.3, -0.38);
  const sunLocal = { value: new THREE.Vector3() };
  group.onBeforeRender = () => {};
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 64),
    new THREE.ShaderMaterial({
      fog: false, uniforms: { sunLocal },
      vertexShader: /* glsl */ `
        varying vec3 vP; varying vec3 vView;
        void main() { vP = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = normalize(-mv.xyz) * normalMatrix; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 sunLocal; varying vec3 vP; varying vec3 vView;
        ${NOISE_GLSL}
        void main() {
          vec3 p = normalize(vP);
          float swirl = fbm3(vec3(p.x * 2.0, p.y * 9.0, p.z * 2.0));
          float lat = p.y * 9.0 + swirl * 1.6 + fbm3(p * 9.0) * 0.5;
          float band = sin(lat * 2.2) * 0.5 + 0.5;
          vec3 col = mix(vec3(0.025, 0.09, 0.14), vec3(0.15, 0.30, 0.33), band);
          col = mix(col, vec3(0.40, 0.37, 0.29), smoothstep(0.5, 0.95, sin(lat * 0.9 + 1.0) * 0.5 + 0.5) * 0.75);
          col *= 0.75 + fbm3(p * vec3(14.0, 40.0, 14.0)) * 0.5;
          col = mix(col, vec3(0.03, 0.07, 0.13), smoothstep(0.6, 1.0, abs(p.y)));
          float light = dot(p, sunLocal);
          float day = smoothstep(-0.12, 0.55, light);
          float rim = pow(1.0 - max(dot(normalize(vView), p), 0.0), 3.0);
          vec3 lit = col * (day * 0.85 + 0.008) + vec3(0.16, 0.36, 0.46) * rim * (day * 0.5 + 0.02);
          gl_FragColor = vec4(lit, 1.0);
        }`,
    }),
  );
  const rings = new THREE.Mesh(
    new THREE.RingGeometry(R * 1.35, R * 2.3, 160, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      fog: false, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { sunLocal, R: { value: R } },
      vertexShader: /* glsl */ `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 sunLocal; uniform float R; varying vec3 vP;
        float h1(float x) { return fract(sin(x * 91.7) * 43758.5); }
        float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
        void main() {
          float r = (length(vP) / R - 1.35) / 0.95;
          float a = (n1(r * 34.0) * 0.6 + n1(r * 130.0) * 0.4) * smoothstep(0.0, 0.05, r) * smoothstep(1.0, 0.9, r);
          a *= 1.0 - smoothstep(0.50, 0.53, r) * smoothstep(0.60, 0.57, r) * 0.9;   // a dark gap
          float b = dot(vP, sunLocal), c = dot(vP, vP) - R * R;
          float shadow = (b < 0.0 && b * b - c > 0.0) ? 0.06 : 1.0;                 // the planet's shadow falls across the rings
          gl_FragColor = vec4(vec3(0.42, 0.39, 0.34) * (0.5 + n1(r * 60.0) * 0.5) * shadow * 0.8, a * 0.75);
        }`,
    }),
  );
  group.add(body, rings);
  group.userData.setSun = () => {
    group.updateMatrixWorld();
    sunLocal.value.copy(SUN_DIR).applyQuaternion(group.quaternion.clone().invert());
  };
  group.userData.setSun();
  return group;
}

function sun() {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX.dot, color: new THREE.Color(60, 34, 16), blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sprite.position.copy(SUN_DIR).multiplyScalar(8000);
  sprite.scale.setScalar(520);
  return sprite;
}

/** Fine dust hanging in the thin air around the camera. It makes light and distance visible. */
function dust() {
  const r = createNoise(3).random;
  const count = 1400, box = 46;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) positions[i] = (r() - 0.5) * box;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: TEX.dot }, offset: { value: new THREE.Vector3() }, box: { value: box }, scale: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform vec3 offset; uniform float box, scale; varying float vAlpha;
      void main() {
        vec3 p = mod(position - offset + box * 0.5, box) - box * 0.5;       // wrap around the camera forever
        vec4 mv = viewMatrix * vec4(p + cameraPosition, 1.0);
        float dist = -mv.z;
        vAlpha = smoothstep(box * 0.5, box * 0.25, length(p)) * smoothstep(0.6, 3.0, dist);
        gl_PointSize = scale * 34.0 / max(dist, 0.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; varying float vAlpha;
      void main() { gl_FragColor = vec4(vec3(1.0, 0.82, 0.66) * texture2D(map, gl_PointCoord).a * vAlpha * 0.11, 1.0); }`,
  }));
  points.frustumCulled = false;
  return points;
}

export function createSky(scene, renderer) {
  const far = new THREE.Group(); // follows the camera, so it always looks infinitely far away
  const starField = stars();
  const planet = giant();
  far.add(dome(), starField, planet, sun());
  far.traverse((o) => (o.renderOrder = -10));

  // Light the world with the same sky: metal and glass reflect it.
  const env = new THREE.Scene();
  env.add(far);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0, 1, 12000).texture;
  scene.environmentIntensity = 0.9;
  pmrem.dispose();
  scene.add(far);

  scene.fog = new THREE.FogExp2(HAZE, 0.0034);
  scene.background = HAZE;

  const sunLight = new THREE.DirectionalLight('#ffdcbc', 3.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const cam = sunLight.shadow.camera;
  cam.left = cam.bottom = -70;
  cam.right = cam.top = 70;
  cam.near = 1;
  cam.far = 420;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.06;
  scene.add(sunLight, sunLight.target);

  // Cool light bouncing off the giant fills the shadows a little.
  const planetLight = new THREE.DirectionalLight('#6fa2b8', 0.42);
  planetLight.position.copy(planet.position).normalize();
  scene.add(planetLight, new THREE.HemisphereLight('#46527a', '#2e241c', 0.85));

  const motes = dust();
  scene.add(motes);
  const drift = new THREE.Vector3();

  function update(camera, focus, dt, time) {
    far.position.copy(camera.position);
    const px = renderer.getPixelRatio() * renderer.domElement.clientHeight / 800;
    starField.material.uniforms.scale.value = px * 1.5;
    motes.material.uniforms.scale.value = px;
    drift.x += dt * 0.5; drift.y += dt * 0.07 + Math.sin(time * 0.3) * dt * 0.05; drift.z += dt * 0.22;
    motes.material.uniforms.offset.value.copy(camera.position).sub(drift);
    // Keep the shadow area centred on the player, snapped to whole texels so shadows do not shimmer.
    const snap = 140 / 2048;
    sunLight.target.position.set(Math.round(focus.x / snap) * snap, 0, Math.round(focus.z / snap) * snap);
    sunLight.position.copy(sunLight.target.position).addScaledVector(SUN_DIR, 200);
  }

  return { update, sunLight };
}
