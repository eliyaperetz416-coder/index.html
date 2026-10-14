// Floor height under the player, from invisible walk surfaces (floors and stair ramps).
import * as THREE from 'three';

const ABOVE = 0.6;    // start the ray this far above the feet (enough for one stair step)
const REACH = 1.5;    // how far down to look

export class FloorSampler {
  constructor(meshes) {
    // Surfaces must be hit from above whatever their winding.
    const sided = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.meshes = meshes.map((m) => { m.material = sided; return m; });
    this.ray = new THREE.Raycaster();
    this.ray.far = REACH;
    this.origin = new THREE.Vector3();
    this.down = new THREE.Vector3(0, -1, 0);
  }

  /** Height of the highest surface within reach below (x, fromY + 0.6, z), or null over a gap. */
  heightAt(x, z, fromY) {
    this.ray.set(this.origin.set(x, fromY + ABOVE, z), this.down);
    const hit = this.ray.intersectObjects(this.meshes, false)[0];
    return hit ? hit.point.y : null;
  }
}
