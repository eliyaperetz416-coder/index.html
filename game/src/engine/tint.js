// Per-instance recoloring of a character (hair, skin) so one GLB yields many different students.
// Colors live in vertex colors; the GLB's rig node carries extras.palette with the original hexes.
import * as THREE from 'three';

const EPS = 0.02;

function findPalette(model) {
  let palette = null;
  model.traverse((o) => { palette ??= o.userData?.palette ?? null; });
  return palette;
}

const close = (arr, i, c) => Math.abs(arr[i] - c.r) < EPS && Math.abs(arr[i + 1] - c.g) < EPS && Math.abs(arr[i + 2] - c.b) < EPS;

/** Replaces the palette's hair/skin vertex colors on this model only (geometry is cloned first). */
export function tintModel(model, { hair, skin } = {}) {
  const palette = findPalette(model);
  if (!palette || (!hair && !skin)) return;
  const swaps = [];
  if (hair) swaps.push([new THREE.Color(palette.hair), new THREE.Color(hair)]);
  if (skin) swaps.push([new THREE.Color(palette.skin), new THREE.Color(skin)]);
  model.traverse((o) => {
    if (!o.isMesh || !o.geometry.getAttribute('color')) return;
    o.geometry = o.geometry.clone();
    const attr = o.geometry.getAttribute('color');
    const arr = attr.array;
    for (let i = 0; i < arr.length; i += attr.itemSize) {
      for (const [from, to] of swaps) {
        if (close(arr, i, from)) { arr[i] = to.r; arr[i + 1] = to.g; arr[i + 2] = to.b; break; }
      }
    }
    attr.needsUpdate = true;
  });
}
