// Anime look: 3-tone cel shading + inverted-hull outlines.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const OUTLINE_COLOR = 0x0a0a0d;
const CHARACTER_OUTLINE = 0.006; // meters, for skinned characters (no outline extras in their GLBs)

function makeGradient(steps) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, steps.length, 1);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// Shadow / mid / lit bands. A dark shadow band keeps contrast high (no washed-out look).
const gradientMap = makeGradient([45, 150, 255]);
const toonCache = new Map();
const outlineMaterials = new Map();

function toonMaterial(src) {
  if (!toonCache.has(src.uuid)) {
    toonCache.set(src.uuid, new THREE.MeshToonMaterial({
      color: src.color, map: src.map, vertexColors: src.vertexColors, gradientMap, name: src.name,
    }));
  }
  return toonCache.get(src.uuid);
}

function outlineMaterial(thickness) {
  if (!outlineMaterials.has(thickness)) {
    const mat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += normal * ${thickness.toFixed(4)};`
      );
    };
    outlineMaterials.set(thickness, mat);
  }
  return outlineMaterials.get(thickness);
}

// Shell geometry with welded vertices so the hull stays closed at hard edges.
function outlineGeometry(geometry) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', geometry.getAttribute('position'));
  geo.setIndex(geometry.getIndex());
  const welded = mergeVertices(geo, 1e-4);
  welded.computeVertexNormals();
  return welded;
}

function addOutline(mesh, thickness) {
  if (mesh.isSkinnedMesh) {
    // Characters are smooth-shaded, so their own normals give a closed hull; it shares the skeleton.
    const hull = new THREE.SkinnedMesh(mesh.geometry, outlineMaterial(thickness));
    hull.name = `${mesh.name}_outline`;
    hull.bind(mesh.skeleton, mesh.bindMatrix);
    hull.raycast = () => {};
    hull.frustumCulled = false;
    mesh.parent.add(hull);
    return;
  }
  const hull = new THREE.Mesh(outlineGeometry(mesh.geometry), outlineMaterial(thickness));
  hull.name = `${mesh.name}_outline`;
  hull.raycast = () => {};
  mesh.add(hull);
}

/**
 * Converts every mesh under `root` to toon shading. Meshes under a node whose
 * glTF extras has `outline` (thickness in meters, set in Blender) get an outline.
 */
export function toonify(root) {
  const outlined = [];
  (function walk(obj, thickness) {
    thickness = obj.userData?.outline ?? thickness;
    if (obj.isMesh) {
      obj.material = Array.isArray(obj.material) ? obj.material.map(toonMaterial) : toonMaterial(obj.material);
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (thickness || obj.isSkinnedMesh) outlined.push([obj, thickness || CHARACTER_OUTLINE]);
      if (obj.isSkinnedMesh) obj.frustumCulled = false; // bounds don't follow poses
    }
    for (const child of obj.children) walk(child, thickness);
  })(root, 0);
  for (const [mesh, thickness] of outlined) addOutline(mesh, thickness);
}
