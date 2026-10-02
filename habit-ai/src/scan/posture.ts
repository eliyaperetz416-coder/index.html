import { loadImage } from './image'

// General screening only, not a diagnosis. Landmarks: ears 7/8, shoulders 11/12, hips 23/24 (MediaPipe Pose, runs fully on-device; model bundled in /mediapipe).
export type View = 'side' | 'front'
export type Result = { view: View; score: number; cva?: number; trunk?: number; tilt?: number; tips: string[] }

let lm: Promise<any> | null = null
function landmarker() {
  return (lm ??= import('@mediapipe/tasks-vision').then(async ({ PoseLandmarker, FilesetResolver }) => {
    const fs = await FilesetResolver.forVisionTasks('/mediapipe')
    return PoseLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: '/mediapipe/pose.task' }, runningMode: 'IMAGE', numPoses: 1,
    })
  }))
}
const deg = (r: number) => (r * 180) / Math.PI

export async function analyze(file: File, view: View): Promise<Result | null> {
  const img = await loadImage(file)
  const p = (await landmarker()).detect(img).landmarks?.[0]
  if (!p) return null
  const W = img.naturalWidth, H = img.naturalHeight
  const pt = (i: number) => ({ x: p[i].x * W, y: p[i].y * H, v: p[i].visibility ?? 1 }) // pixel space keeps angles true
  const tips: string[] = []
  let score = 100
  const r: Result = { view, score: 0, tips }
  if (view === 'side') {
    const L = [7, 11, 23].reduce((a, i) => a + pt(i).v, 0), R = [8, 12, 24].reduce((a, i) => a + pt(i).v, 0)
    const [e, s, h] = (L >= R ? [7, 11, 23] : [8, 12, 24]).map(pt)
    // Craniovertebral angle: horizontal vs line from C7 to tragus; ~50deg+ typical, lower = more forward head (Yip 2008; Shaw 1992). Shoulder point stands in for C7 here.
    r.cva = Math.round(deg(Math.atan2(s.y - e.y, Math.abs(e.x - s.x))))
    // Trunk lean: shoulder-hip line vs vertical (standard trunk/back angle)
    r.trunk = Math.round(deg(Math.atan2(Math.abs(s.x - h.x), Math.abs(h.y - s.y))))
    score -= Math.min(50, Math.max(0, 50 - r.cva) * 2) + Math.min(30, Math.max(0, r.trunk - 5) * 2)
    if (r.cva < 50) tips.push('tip.head')
    if (r.trunk > 8) tips.push('tip.trunk')
  } else {
    const a = pt(11), b = pt(12)
    r.tilt = Math.round(deg(Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x))) * 10) / 10 // shoulder line vs horizontal
    score -= Math.min(60, Math.max(0, r.tilt - 2) * 8)
    if (r.tilt > 3) tips.push('tip.shoulder')
  }
  if (!tips.length) tips.push('tip.ok')
  for (const g of ['tip.g1', 'tip.g2', 'tip.g3']) if (tips.length < 3) tips.push(g)
  r.score = Math.max(0, Math.round(score))
  return r
}
