// Player-controlled camera angle: the follow camera's offset is turned around the character.
import * as THREE from 'three';

export const MIN_TILT = -0.45;  // lower the camera at most 45% of its offset height
export const MAX_TILT = 1.0;    // raise it at most 100%
const YAW_PER_PX = 0.006;       // radians per dragged pixel
const TILT_PER_PX = 0.004;

/** Offset [x, y, z] turned by `yaw` around the vertical axis, with its height scaled by (1 + tilt). */
export function orbitOffset(offset, yaw, tilt) {
  const v = new THREE.Vector3(offset[0], 0, offset[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  v.y = offset[1] * (1 + tilt);
  return v;
}

/** Applies a drag (pixels) to a look state { yaw, tilt }. Dragging right turns the view right. */
export function addLook({ yaw, tilt }, dx, dy) {
  return {
    yaw: yaw - dx * YAW_PER_PX,
    tilt: THREE.MathUtils.clamp(tilt + dy * TILT_PER_PX, MIN_TILT, MAX_TILT),
  };
}
