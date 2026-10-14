# Real Characters and a Full School — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the box-made characters with skinned, anime-styled bodies (Light, teacher, 4 student types) and turn the school into a two-floor building with stairs, a shoe-locker lobby and ~15 idle students, keeping chapter 1 fully playable.

**Architecture:** Blender scripts (run as the `bpy` module or `blender -b -P`) generate all GLBs: a parametric character generator (Skin modifier body + armature + vertex-color outfit + PIL face texture + hair clumps) and a rebuilt school. At runtime, `Character` drives skinned bones through the existing pose data (character-space degrees converted to bone-local), NPCs are placed on Blender markers from chapter data and tinted per instance, and walking samples floor height by raycasting invisible walk surfaces.

**Tech Stack:** Blender 5.2 `bpy`, PIL, Three.js 0.186 (SkinnedMesh, SkeletonUtils), Vite 8, Vitest (new, unit tests), Playwright (end-to-end scripts, Chromium at `/opt/pw-browsers` here).

**Spec:** `docs/superpowers/specs/2026-10-14-characters-and-school-design.md`

## Global Constraints

- Style stays anime: cel shading (`toon.js` gradient) + outlines. No photorealism.
- Per character: ≤ 4,000 triangles, exactly 1 material (vertex colors × face texture) + 1 outline.
- Scene budget: ~20 characters on screen, ~110k triangles total, ≤ 120 draw calls (`renderer.info.render.calls`).
- Floor height 3.6 m. Light's classroom on floor 2 (y = 3.6), lobby on floor 1 (y = 0).
- Bone names exactly: `Hips, Spine, Chest, Neck, Head, Shoulder.L/R, UpperArm.L/R, LowerArm.L/R, Hand.L/R, UpperLeg.L/R, LowerLeg.L/R, Foot.L/R`.
- Assets build with the bpy module (`import bpy` before `bmesh`/`mathutils`) and with `blender -b -P`.
- No external services or runtime downloads. All UI text Hebrew. Chapter 1 stage 3 (rules, puzzle, end) unchanged.
- Character files: `char_light.glb`, `char_teacher.glb`, `char_student_m1.glb`, `char_student_m2.glb`, `char_student_f1.glb`, `char_student_f2.glb` in `game/public/assets/`.

## Review Focus

1. Skipping the cutscene (double tap) must still ring the bell and switch NPCs to break mode → test in Task 7.
2. Tinting one NPC must not recolor other NPCs that share the same GLB (shared geometry) → test in Task 3.
3. Light at a stair landing edge or walking backwards up the stairs must never fall through or float: when the floor ray misses, keep the last height → test in Task 6.
4. A wall collider on floor 2 must not block floor 1 (and vice versa) → test in Task 6.
5. Portrait iPhone (390×844) in the stairwell: camera must stay inside the building → screenshot check in Task 6.

---

### Task 1: Character generator core (body, skeleton, outfit colors)

**Files:**
- Create: `game/tools/blender/characters.py`
- Create: `game/tools/blender/check_assets.py`
- Modify: `game/package.json` (scripts `assets`, `check-assets`)

**Interfaces:**
- Produces: `build_character(spec: dict) -> str` (returns GLB path) and `CHARACTERS: list[dict]`. Spec keys: `id`, `height` (m), `build` `{shoulders, hips, limbs}` (multipliers, 1.0 = average), `outfit` (`uniform_m` | `uniform_f` | `suit`), `skin` (hex), `hair` `{style, color}`, `eyes` (`sharp` | `soft` | `tired`), `eye_color` (hex), `glasses` (bool).
- Produces: GLB root node extras `palette: {hair, skin}` (hex, as written into vertex colors), used by Task 3 tinting.
- Produces: `check_assets.py` with `read_glb(path) -> dict` (parses the JSON chunk) and CLI `python tools/blender/check_assets.py` exiting non-zero on failure.

- [ ] **Step 1: Write the asset check first** — `check_characters()` asserts for every `char_*.glb`: all bone names from Global Constraints exist as skin joints; total triangles ≤ 4000; exactly 1 material; primitives have `COLOR_0`, `JOINTS_0`, `WEIGHTS_0`; root extras contain `palette.hair` and `palette.skin`.
- [ ] **Step 2: Run it** — `python tools/blender/check_assets.py` → FAIL (`char_light.glb` missing).
- [ ] **Step 3: Implement the body** — skeleton vertex graph (pelvis → spine → chest → neck → head; shoulders → elbows → wrists; hips → knees → ankles → toes) with per-vertex Skin radii scaled by `build`; Skin modifier + Subdivision 1, applied; armature built from the same graph with the bone names above; `parent_set(type='ARMATURE_AUTO')`.
- [ ] **Step 4: Outfit vertex colors** — color by region (jacket: chest/upper arms/forearms above wrist; shirt collar ring at neck base; tie strip front of chest for `uniform_m`, bow for `uniform_f`; pants or skirt cone on `Hips` for `uniform_f`; shoes below ankle; skin elsewhere). Colors: uniform jacket `#6b5440`, pants `#3a2f26`, shirt `#e9e6df`, tie `#6e1f24`, suit `#4a4d55`, skirt `#3b3f52`, shoes `#1b1714`.
- [ ] **Step 5: Export** `char_light.glb` (height 1.78, slim build, hair `light` `#7a4a2a`, eyes `sharp` `#6a2a1c`) with export_skins, export_extras, no UVs except the head; run check → PASS for Light.
- [ ] **Step 6: Render check** — Blender headless render (Eevee, 512px) front/side of Light into the scratchpad; look at it: continuous body, no holes, weights move limbs.
- [ ] **Step 7: Commit** — `feat(chars): skinned character generator core + asset checks`.

### Task 2: Faces, hair styles, full cast

**Files:**
- Create: `game/tools/blender/faces.py`
- Modify: `game/tools/blender/characters.py`

**Interfaces:**
- Produces: `draw_face(eyes: str, eye_color: str, glasses: bool, out_png: str) -> str` (512×512 PNG, face in the left half, the rest white so vertex colors show through).
- Produces: hair styles `light`, `short`, `spiky`, `bob`, `long` in `build_hair(style, color, head_bone)`.
- Produces: all six GLBs listed in Global Constraints.

- [ ] **Step 1: Extend the check** — every `char_*.glb` has exactly one image (face texture); all six files exist.
- [ ] **Step 2: Run it** → FAIL (five files missing).
- [ ] **Step 3: Faces** — PIL drawing: anime eyes (outline, iris, pupil, highlight, lashes), brows by style (`sharp` angled down-in, `soft` arched, `tired` flat + under-eye line), small nose line, mouth; `glasses` draws thin frames. Head UV = front projection; texture × vertex color (white face region).
- [ ] **Step 4: Hair** — dome + curved cone clumps weighted 100% to `Head`; `light`: sharp fringe over brows + side locks to cheek, no fringe below eye line.
- [ ] **Step 5: Cast in `CHARACTERS`** — teacher (1.72, broad, `suit`, `short` `#4a4a4a`, `tired`, glasses), m1 (1.70, `short` `#1c1c1e`, `soft`), m2 (1.75, `spiky` `#2b2018`, `sharp`), f1 (1.60, `uniform_f`, `bob` `#1a1a1d`, `soft`), f2 (1.63, `uniform_f`, `long` `#5a3a22`, `soft`).
- [ ] **Step 6: Run check** → PASS; render a 6-character lineup and look at it (faces readable, Light recognizable).
- [ ] **Step 7: Commit** — `feat(chars): anime faces, hair styles, full cast`.

### Task 3: Skinned characters in the game (toon, outline, pose conversion, tint)

**Files:**
- Modify: `game/src/engine/character.js`, `game/src/engine/toon.js`, `game/src/engine/stage.js`, `game/data/poses.json`, `game/data/chapters/ch1.json` (light asset → `char_light.glb`)
- Create: `game/src/engine/tint.js`, `game/src/engine/character.test.js`, `game/src/engine/tint.test.js`
- Create: `game/tests/e2e/helpers.mjs`, `game/tests/e2e/smoke.mjs`
- Modify: `game/package.json` (devDependencies `vitest`, `playwright`; scripts `test`, `e2e`)

**Interfaces:**
- Consumes: Task 1/2 GLBs and `palette` extras.
- Produces: `poseToLocal(rest: Quaternion, restWorld: Quaternion, rot: Quaternion): Quaternion` — `rest · restWorld⁻¹ · rot · restWorld`.
- Produces: `tintModel(model: Object3D, { hair?: string, skin?: string }): void` — clones the geometry's `color` attribute, replaces vertices matching `palette.hair` / `palette.skin` (ε = 0.02 linear) with the new color.
- Produces: `toonify` handling `SkinnedMesh` (`vertexColors: true`, `map` kept) and skinned outline hulls (`SkinnedMesh` sharing the skeleton, `bind(mesh.skeleton, mesh.bindMatrix)`).
- Produces: `Character` keeps its API (`setPose`, `walk`, `update`) with bone-name joints.
- Produces: e2e helper `launch({ size }) -> { page, ctx, browser }` (Chromium from `PW_CHROMIUM`, else `/opt/pw-browsers`; dev server at `http://localhost:5173`) and `driveTo(page, [x, z])` (keyboard driving relative to the camera, fails if stuck > 4 s). `smoke.mjs`: play the cutscene, walk to the notebook, assert no console errors, save contact-sheet screenshots.

- [ ] **Step 1: Failing tests** — `poseToLocal` with identity rest = `rot`; with a bone whose rest world rotation is 90° about Z, a character-space X rotation becomes a local rotation about the bone's own axis (assert the bone's world forward matches the expected vector to 1e-5). `tintModel` on two clones of one model: after tinting clone A's hair red, clone B's color attribute is unchanged and A's skin vertices are unchanged.
- [ ] **Step 2: `npm test`** → FAIL.
- [ ] **Step 3: Implement** `poseToLocal`, `tintModel`, skinned toon/outline, and `Character` storing `restWorld` per bone (computed once from the bind pose relative to the model root).
- [ ] **Step 4: `npm test`** → PASS.
- [ ] **Step 5: Rename pose joints and recalibrate** `stand`, `sit_bored`, `sit_alert`, `walk_a`, `walk_b`, `crouch` to the new bone names; render each pose with the pose script (side + front) and adjust until: chin rests on the hand in `sit_bored`, feet on the floor when standing, knees not through the desk.
- [ ] **Step 6: Run** `node tests/e2e/smoke.mjs` → no console errors; screenshots look right.
- [ ] **Step 7: Commit** — `feat(chars): skinned Light in game, pose conversion, per-NPC tint`.

### Task 4: New poses and idle motion

**Files:**
- Modify: `game/src/engine/character.js`, `game/data/poses.json`, `game/src/engine/character.test.js`

**Interfaces:**
- Produces: `Character.setIdle(kind: 'breath' | 'write' | 'talk' | 'look' | null)` and `Character.idle(dt)` (called from `update`), random phase per instance; `breath` always layered.
- Produces: poses `sit_write`, `sit_listen`, `stand_talk`, `stand_lean`, `teacher_board`, `teacher_books`.

- [ ] **Step 1: Failing test** — idle offsets stay within ±8° per joint over 30 s of `idle(1/30)` steps, and `setIdle(null)` returns to the pose within 0.5 s.
- [ ] **Step 2: Implement** idle as small sine rotations added after pose/tween (chest/shoulders for `breath`; forearm + hand for `write`; head + arms for `talk`; head yaw every 4–9 s for `look`).
- [ ] **Step 3: `npm test`** → PASS; render each new pose once and look at it.
- [ ] **Step 4: Commit** — `feat(chars): idle motion and lesson/break poses`.

### Task 5: Two-floor school in Blender

**Files:**
- Modify: `game/tools/blender/build_assets.py` (classroom → floor 2, corridor floor 2, new `stairs`, `lobby`; courtyard facade two floors; remove old floor-1 corridor exit)
- Modify: `game/tools/blender/check_assets.py`

**Interfaces:**
- Produces GLBs: `classroom.glb`, `corridor.glb` (floor 2), `stairs.glb`, `lobby.glb`, `courtyard.glb`.
- Produces markers: `Seat_<row>_<col>` for every chair (rows 0–2, cols 0–3), `Teacher_Spot`, `Spawn_Walk` (floor 2), `Seat_Light`, `Spot_Corridor_1..3`, `Spot_Lobby_1..3`, `Landing_Notebook` (unchanged x/z).
- Produces: collider empties with z-extent (`scale.z` = half height, location z = center), and invisible walk meshes named `Walk_*` with extras `walk: 1` (floors + one smooth ramp per stair flight).

- [ ] **Step 1: Extend the check** — markers above exist; ≥ 1 `Walk_*` mesh per file that has floor; every collider has `scale.z > 0`; school total triangles ≤ 30,000.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Build** — floor-2 classroom/corridor raised by 3.6; switchback stairs at the corridor's west end (two flights + landing at 1.8 m); lobby under the corridor with getabako rows, notice board, glass doors at its east end where today's corridor exit is; closed classroom volume under Light's room; a closed second classroom door at the corridor's east end; facade with two window rows.
- [ ] **Step 4: Run check** → PASS; render an overview and a stairwell view; look at them.
- [ ] **Step 5: Commit** — `feat(school): two floors, stairs, shoe-locker lobby`.

### Task 6: Height-aware walking

**Files:**
- Create: `game/src/engine/collision.js`, `game/src/engine/floor.js`, `game/src/engine/collision.test.js`, `game/src/engine/floor.test.js`
- Create: `game/tests/e2e/walk.mjs`
- Modify: `game/src/engine/walk.js`, `game/src/engine/stage.js`, `game/data/chapters/ch1.json` (areas with `y: [min, max]`, new `stairs` and `lobby` areas, scene assets)

**Interfaces:**
- Produces: `footprint(empty) -> { minX, maxX, minY, maxY, minZ, maxZ }`; `resolveCollisions(p: Vector3, colliders, radius = 0.2): void` ignores colliders not overlapping `[p.y + 0.1, p.y + 1.6]`; circle colliders `{ x, z, r, minY, maxY }` for NPCs.
- Produces: `new FloorSampler(meshes: Mesh[])`, `heightAt(x, z, fromY): number | null` (ray from `fromY + 0.6` straight down, max distance 1.5).
- Produces: `stage.walkSurfaces: Mesh[]`, `stage.colliders` (boxes + circles); `WalkController` sets `body.position.y` from the sampler and keeps the last height on a miss; areas match on `rect` and `y`.
- Consumes: e2e helpers from Task 3.

- [ ] **Step 1: Failing tests** — a collider spanning y 3.6–6.8 does not push a player at y 0; one spanning 0–3.2 does. `heightAt` over a ramp from (0,0,0) to (0,1.8,4) returns 0.9 ± 0.01 at z 2; over a gap returns `null`.
- [ ] **Step 2: `npm test`** → FAIL; implement; → PASS.
- [ ] **Step 3: Wire into `WalkController`/`Stage`**; on a sampler miss keep the previous y (Review Focus 3).
- [ ] **Step 4: E2E** `node tests/e2e/walk.mjs` drives Spawn_Walk → corridor → stairs (both flights) → lobby → doors → notebook; asserts: never stuck > 4 s, y is monotonic non-increasing on the stairs (± 0.05), y = 0 ± 0.05 in the lobby; also walks back up one flight backwards (keys `s`) and asserts y increases without dropping. Screenshot the stairwell at 844×390 and 390×844 and check the camera is inside the building (Review Focus 5).
- [ ] **Step 5: Commit** — `feat(walk): floors, stairs and floor-aware colliders`.

### Task 7: Students, teacher, bell, cutscene on floor 2

**Files:**
- Create: `game/src/engine/npcs.js`
- Modify: `game/src/engine/stage.js`, `game/src/engine/audio.js` (`bell`), `game/src/main.js` (nothing new beyond step wiring if needed), `game/data/chapters/ch1.json`
- Create: `game/tests/e2e/chapter.mjs` (full chapter incl. skip)

**Interfaces:**
- Consumes: `tintModel`, `Character.setIdle`, markers from Task 5.
- Produces: chapter data `npcs: [{ id, model, at, lesson: { pose, idle }, break: { pose, idle } | null, hidden?: 'lesson', tint?: { hair, skin } }]`; `break: null` keeps the lesson state; `hidden: 'lesson'` means only shown in break.
- Produces: stage action `npcMode({ mode: 'lesson' | 'break', duration = 0.8 })`; NPCs loaded with `SkeletonUtils.clone`, one GLB load per model.
- Produces: one-shot sound `bell` (Westminster four-note chime, ~4 s).

- [ ] **Step 1: E2E first** — `chapter.mjs` asserts: during the first cutscene shot ≥ 13 NPCs visible in the classroom; after the cutscene (and, in a second run, after a double-tap skip) `npcMode` is `break`, corridor/lobby groups are visible, the bell was played (spy on `playSound`); chapter reaches the end screen with no console errors.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `npcs.js` (`loadNpcs(stage, list)`, `setMode(mode)`), circle colliders per standing/sitting NPC, the `bell` sound, flow step `{ "type": "do", "action": "npcMode", "mode": "break", "sound": "bell" }` right after the cutscene, 13 students + teacher in class, 3 groups in corridor/lobby. Retune every cutscene camera `from/to/look` by +3.6 in y and check each shot (same framing as today: wide, profile, over-shoulder, window POV, ground, landing, eyes, outro).
- [ ] **Step 4: Run e2e** → PASS; view the shot contact sheet.
- [ ] **Step 5: Commit** — `feat(ch1): students, teacher, bell, floor-2 cutscene`.

### Task 8: Performance budget and publish

**Files:**
- Modify: `game/tests/e2e/chapter.mjs`, possibly `game/src/engine/npcs.js` / `toon.js` (fallbacks only if over budget)
- Rebuild: `deathnote/`

- [ ] **Step 1: Assert the budget** in `chapter.mjs`: in the classroom wide shot and the lobby, `renderer.info.render.calls ≤ 120` and `renderer.info.render.triangles ≤ 110000`.
- [ ] **Step 2: If over** — drop outlines on NPCs farther than 8 m from the camera, then update idle every second frame; re-run.
- [ ] **Step 3: `npm test` + all e2e** → PASS; `npm run publish`; serve the repo root and smoke-test `/deathnote/` (versioned GLBs, no errors).
- [ ] **Step 4: Commit** — `chore: publish characters and school update`.
