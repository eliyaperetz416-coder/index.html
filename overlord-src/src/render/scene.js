// The 3D world around the base: renderer, free camera, glow, stars, planet, ground.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03040b');
  scene.fog = new THREE.Fog('#03040b', 90, 260);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.set(15, 8, 19);

  // Free camera: drag to orbit, right-drag / two fingers to pan, wheel / pinch to zoom.
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 8;
  controls.maxDistance = 90;
  controls.target.set(0, 2, 0);

  scene.add(new THREE.HemisphereLight('#5a6cff', '#12061f', 0.7));
  const sun = new THREE.DirectionalLight('#ffe2c4', 2.2);
  sun.position.set(-30, 40, 20);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#ff4fd8', 0.8);
  rim.position.set(30, 10, -30);
  scene.add(rim);

  scene.add(makeStars(), makeNebula(), makeGround());
  const planet = makePlanet();
  scene.add(planet);

  // Bloom makes every bright (emissive) colour glow against the dark.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function render(dt) {
    planet.rotation.y += dt * 0.01;
    controls.update();
    composer.render();
  }

  return { scene, camera, controls, render };
}

function makeStars() {
  const count = 2500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = ['#ffffff', '#9fd0ff', '#ffd9a8', '#ff9df0', '#8affe0'].map((c) => new THREE.Color(c));
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(900);
    if (v.y < -100) v.y = -v.y; // nothing to see below the ground
    v.toArray(positions, i * 3);
    palette[i % palette.length].toArray(colors, i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false });
  return new THREE.Points(geo, mat);
}

function glowTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeNebula() {
  const group = new THREE.Group();
  const clouds = [
    ['rgba(255,60,200,0.35)', [-500, 260, -600], 900],
    ['rgba(60,220,255,0.3)', [520, 180, -500], 800],
    ['rgba(140,90,255,0.3)', [100, 420, 650], 1000],
    ['rgba(60,255,170,0.18)', [-650, 150, 350], 700],
  ];
  for (const [color, pos, size] of clouds) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(color), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    sprite.position.set(...pos);
    sprite.scale.setScalar(size);
    group.add(sprite);
  }
  return group;
}

function makePlanet() {
  const group = new THREE.Group();
  group.position.set(-330, 105, -520);
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(110, 48, 32),
    new THREE.MeshStandardMaterial({ color: '#2a5cff', emissive: '#16083d', roughness: 0.8, fog: false }),
  );
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture('rgba(80,160,255,0.55)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  halo.scale.setScalar(380);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(150, 200, 96),
    new THREE.MeshBasicMaterial({ color: '#ff9df0', transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false }),
  );
  ring.rotation.x = Math.PI * 0.42;
  group.add(halo, body, ring);
  return group;
}

function makeGround() {
  const group = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.CircleGeometry(300, 64),
    new THREE.MeshStandardMaterial({ color: '#0d1024', roughness: 1 }),
  );
  rock.rotation.x = -Math.PI / 2;
  rock.position.y = -0.02;
  group.add(rock);

  // A few scattered boulders so the surface does not look empty.
  const boulderMat = new THREE.MeshStandardMaterial({ color: '#191d3a', roughness: 1, flatShading: true });
  for (let i = 0; i < 60; i++) {
    const angle = i * 2.399; // golden angle: evenly spread without randomness
    const dist = 34 + ((i * 37) % 120);
    const size = 0.6 + ((i * 13) % 10) * 0.25;
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(size), boulderMat);
    boulder.position.set(Math.cos(angle) * dist, size * 0.3, Math.sin(angle) * dist);
    boulder.rotation.set(i, i * 2, i * 3);
    group.add(boulder);
  }
  return group;
}
