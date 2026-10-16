// WebGL renderer, scene and camera, sized to the window.

import { WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, SRGBColorSpace, Mesh, BoxGeometry, MeshBasicMaterial, BackSide, Color } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY } from '../config/game.js';

export function resolveQuality(name) {
  if (name === 'auto' || !QUALITY[name]) {
    const touch = matchMedia('(pointer: coarse)').matches;
    return { name: touch ? 'medium' : 'high', ...QUALITY[touch ? 'medium' : 'high'] };
  }
  return { name, ...QUALITY[name] };
}

export class Renderer {
  constructor(container, quality) {
    this.quality = quality;
    this.renderer = new WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.domElement.id = 'gl';
    container.appendChild(this.renderer.domElement);
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(75, 1, 0.3, 3200);
    this.envMap = null;
    this.setQuality(quality);
    this.onResize = [];
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(quality) {
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    this.scene.environment = quality.standardMaterials ? this.envMap : null;
    // Bloom makes the neon glow for real; only on high quality (it costs fill rate).
    if (quality.bloom && !this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(undefined, 0.75, 0.45, 0.62);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    } else if (!quality.bloom && this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    this.resize();
  }

  /**
   * Reflection map for metallic paint, built from the world's colours: a dark room with a bright
   * ceiling and two coloured walls. Rebuilt only when the colours change.
   */
  setEnvironment(env) {
    const key = JSON.stringify(env);
    if (key === this.envKey) return;
    this.envKey = key;
    this.envTarget?.dispose(); // frees the old reflection map (render target + texture)
    const scene = new Scene();
    scene.background = new Color(env.base);
    const panel = (color, w, h, d, x, y, z) => {
      const m = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial({ color }));
      m.position.set(x, y, z);
      scene.add(m);
    };
    const room = new Mesh(new BoxGeometry(20, 20, 20), new MeshBasicMaterial({ color: env.base, side: BackSide }));
    scene.add(room);
    panel(env.top, 12, 0.2, 12, 0, 9, 0);
    panel(env.left, 0.2, 6, 14, -9, 2, 0);
    panel(env.right, 0.2, 6, 14, 9, 2, 0);
    panel(env.floor, 20, 0.2, 20, 0, -9.5, 0);
    const pm = new PMREMGenerator(this.renderer);
    this.envTarget = pm.fromScene(scene, 0.04);
    this.envMap = this.envTarget.texture;
    pm.dispose();
    scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.scene.environment = this.quality.standardMaterials ? this.envMap : null;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const fn of this.onResize ?? []) fn(w, h);
  }

  /**
   * Adaptive resolution: if frames are slow for a while, lower the pixel ratio a step (down to 1);
   * if they are comfortably fast again, raise it back up to the preset's maximum.
   */
  adapt(dt) {
    this.frames = (this.frames ?? 0) + 1;
    this.frameTime = (this.frameTime ?? 0) + dt;
    if (this.frameTime < 2) return;
    const avg = this.frameTime / this.frames;
    this.frames = 0;
    this.frameTime = 0;
    const max = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
    const cur = this.renderer.getPixelRatio();
    let next = cur;
    if (avg > 1 / 45 && cur > 1) next = Math.max(1, cur - 0.25);
    else if (avg < 1 / 58 && cur < max) next = Math.min(max, cur + 0.25);
    if (next !== cur) {
      this.renderer.setPixelRatio(next);
      this.resize();
    }
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
