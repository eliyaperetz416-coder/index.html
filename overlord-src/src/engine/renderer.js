// Renderer and "camera film": shadows, tone mapping, bloom, vignette and grain.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// The last step of every frame: a little contrast, cool shadows / warm highlights,
// darker corners, film grain, and a red-black tunnel when the suit runs out of air.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, danger: { value: 0 }, fade: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, danger, fade;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
      c += mix(vec3(-0.010, 0.0, 0.016), vec3(0.016, 0.006, -0.012), smoothstep(0.0, 1.0, l));
      vec2 d = vUv - 0.5;
      float r = dot(d, d);
      c *= mix(1.0, smoothstep(0.75, 0.05, r), 0.55);
      float tunnel = smoothstep(0.02, 0.4 - danger * 0.3, r) * danger;
      c = mix(c, vec3(0.05, 0.0, 0.0) + l * vec3(0.3, 0.05, 0.05), tunnel);
      c += (hash(vUv * vec2(1387.0, 911.0)) - 0.5) * 0.03;
      gl_FragColor = vec4(c * (1.0 - fade), 1.0);
    }`,
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.15, 14000);

  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.75, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // If the device cannot keep up, render fewer pixels rather than stutter.
  let slowTime = 0;
  function adapt(dt) {
    slowTime = dt > 1 / 28 ? slowTime + dt : Math.max(0, slowTime - dt * 2);
    if (slowTime > 3 && pixelRatio > 0.75) {
      pixelRatio = Math.max(0.75, pixelRatio - 0.25);
      slowTime = 0;
      resize();
    }
  }

  function render(dt, time) {
    grade.uniforms.time.value = time % 100;
    composer.render(dt);
    adapt(dt);
  }

  return {
    renderer, scene, camera, render,
    /** 0 = fine, 1 = suit out of oxygen */
    setDanger: (v) => (grade.uniforms.danger.value = v),
    /** 0 = picture, 1 = black */
    setFade: (v) => (grade.uniforms.fade.value = v),
  };
}
