import * as THREE from 'three';

const MAX_PIXEL_RATIO = 2;
const DESIGN_ASPECT = 16 / 9;

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
  camera.userData.baseFov = 40;

  // The canvas is stretched by CSS to the full screen; its drawing buffer follows the
  // measured size. iOS home-screen apps report a stale window.innerHeight after
  // launch/rotation, so the size is checked every frame instead of trusting resize events.
  let width = 0;
  let height = 0;
  function fitToScreen() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyFov(camera, camera.userData.baseFov);
  }
  fitToScreen();

  return { renderer, camera, fitToScreen };
}

/**
 * Sets a fov authored for a 16:9 frame. On narrower screens (iPhone portrait)
 * the vertical fov widens partially so the subject stays in frame.
 */
export function applyFov(camera, fov) {
  camera.userData.baseFov = fov;
  let v = fov;
  if (camera.aspect < DESIGN_ASPECT) {
    const half = THREE.MathUtils.degToRad(fov / 2);
    const hTan = Math.tan(half) * DESIGN_ASPECT;
    const full = THREE.MathUtils.radToDeg(2 * Math.atan(hTan / camera.aspect));
    v = Math.min(THREE.MathUtils.lerp(fov, full, 0.6), 95);
  }
  camera.fov = v;
  camera.updateProjectionMatrix();
}
