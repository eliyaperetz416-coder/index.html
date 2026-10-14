import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();

/** Loads a GLB from public/assets (cached) and returns a fresh clone of its scene. */
export async function loadModel(file) {
  if (!cache.has(file)) {
    cache.set(file, loader.loadAsync(`${import.meta.env.BASE_URL}assets/${file}?v=${__BUILD_ID__}`));
  }
  const gltf = await cache.get(file);
  // SkeletonUtils.clone rebinds skinned meshes to the cloned bones (Object3D.clone does not).
  return cloneSkinned(gltf.scene);
}
