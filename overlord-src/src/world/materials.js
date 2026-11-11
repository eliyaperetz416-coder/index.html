// The shared set of physically-based materials. Using few materials keeps the game fast
// and makes everything look like it belongs to the same world.

import * as THREE from 'three';
import { TEX } from './textures.js';

const std = (opts) => new THREE.MeshStandardMaterial(opts);
const plated = (color, metalness, roughness) =>
  std({ color, metalness, roughness, map: TEX.plating.map, normalMap: TEX.plating.normalMap, roughnessMap: TEX.plating.roughnessMap });
const lamp = (color, intensity) => std({ color: '#111', emissive: color, emissiveIntensity: intensity, roughness: 0.6 });

export const MAT = {
  hull: plated('#b4b6b8', 0.3, 1),          // painted outer shell
  hullDark: plated('#474b52', 0.65, 0.85),  // gunmetal structure
  wall: plated('#bdb9ae', 0.05, 1),         // interior panels
  frame: std({ color: '#1f2226', metalness: 0.85, roughness: 0.42 }),
  steel: std({ color: '#8d9299', metalness: 0.95, roughness: 0.32 }),
  paint: std({ color: '#a8571f', metalness: 0.2, roughness: 0.6 }), // the base's one accent colour
  rubber: std({ color: '#17181a', roughness: 0.9 }),
  concrete: std({ color: '#4d4a47', roughness: 0.97, map: TEX.ground.map, normalMap: TEX.ground.normalMap }),
  deck: std({ color: '#7d8087', metalness: 0.55, roughness: 0.6, map: TEX.deck.map, normalMap: TEX.deck.normalMap }),
  glass: std({ color: '#a9c9d2', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.2, envMapIntensity: 2.2, depthWrite: false }),
  solar: std({ color: '#ffffff', metalness: 0.85, roughness: 0.22, map: TEX.solar.map, envMapIntensity: 1.6 }),
  fabric: std({ color: '#44546a', roughness: 0.95 }),
  crate: std({ color: '#6a6b4f', roughness: 0.8, metalness: 0.1, map: TEX.plating.map, normalMap: TEX.plating.normalMap }),
  crateSand: std({ color: '#8f7d5c', roughness: 0.8, metalness: 0.1, map: TEX.plating.map, normalMap: TEX.plating.normalMap }),
  soil: std({ color: '#2b2118', roughness: 1 }),
  leaf: std({ color: '#5c9a4e', roughness: 0.7 }),
  tableTop: std({ color: '#0d1a1f', metalness: 0.6, roughness: 0.15, envMapIntensity: 1.5 }),
  // Lights. These are the only things in the world that glow.
  lampWarm: lamp('#ffcf96', 1.9),
  lampCool: lamp('#bfe3ff', 3.0),
  lampAmber: lamp('#ff9a2e', 4.0),
  lampRed: lamp('#ff3b2a', 4.0),
  lampGrow: lamp('#e9a0ff', 1.8),
  holo: lamp('#62d7e0', 0.9),
  engine: lamp('#8fd0ff', 6.0),
};

/** Translucent "blueprint" look for a module that is being placed. */
export const ghostMaterial = (ok) =>
  new THREE.MeshBasicMaterial({ color: ok ? '#6fd0d8' : '#e0625a', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
