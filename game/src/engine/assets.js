import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

/** Loads a GLB from public/assets (cached) and returns a fresh clone of its scene. */
export async function loadModel(file) {
  if (!cache.has(file)) {
    cache.set(file, loader.loadAsync(`${import.meta.env.BASE_URL}assets/${file}`));
  }
  const gltf = await cache.get(file);
  return gltf.scene.clone(true);
}
