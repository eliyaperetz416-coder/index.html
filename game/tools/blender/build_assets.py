"""Builds the chapter 1 low-poly models and exports them as GLB.

Run with Blender:   blender -b -P tools/blender/build_assets.py
or with bpy module: python tools/blender/build_assets.py

Coordinates here are Blender's (Z up, characters face -Y).
The glTF exporter converts to three.js (Y up, characters face +Z).
Objects with the custom property "outline" (thickness in meters) get an anime outline in the game.
Empties with the custom property "collider" are invisible walking blockers (boxes with height).
Meshes with the custom property "walk" are invisible surfaces the player stands on.
"""
import math
import os

import bpy  # must come before bmesh/mathutils when running as the bpy module
import bmesh
from mathutils import Euler, Matrix, Vector

OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "assets"))

PALETTE = {
    "skin": "#f1d2b6", "hair": "#7a4a2a", "jacket": "#6b5440", "pants": "#3a2f26",
    "shirt": "#e9e6df", "tie": "#6e1f24", "shoe": "#1b1714", "eye": "#2a1510",
    "floor": "#5b4636", "ceiling": "#cfcac0", "plaster": "#b9b2a3", "board": "#1f3a2e",
    "wood": "#a07850", "darkwood": "#6e5139", "metal": "#4a4f55", "frame": "#8d9197",
    "curtain": "#cbbf9a", "lamp": "#e8e6dc", "clockface": "#f2efe6",
    "grass": "#2c4a2a", "dirt": "#24211c", "concrete": "#8b8a85", "trunk": "#3b2a1e",
    "leaves": "#1f3a1f", "facade": "#b9b2a3", "glass": "#1c2430",
    "linoleum": "#4b4a44", "locker": "#56606a",
    "cover": "#0c0c0e", "pages": "#e8e3d3", "title": "#f4f4f4",
}


def hex_rgba(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def material(name):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgba(PALETTE[name])
    bsdf.inputs["Roughness"].default_value = 1.0
    return mat


class Part:
    """Accumulates primitives (given in world coords) into one mesh object.

    The object origin is placed at `origin`, so parts can rotate around joints.
    """

    def __init__(self, name, origin=(0, 0, 0)):
        self.name = name
        self.origin = Vector(origin)
        self.bm = bmesh.new()
        self.mats = []

    def _mat_index(self, mat_name):
        if mat_name not in self.mats:
            self.mats.append(mat_name)
        return self.mats.index(mat_name)

    def _tag(self, verts, mat_name, smooth=False):
        idx = self._mat_index(mat_name)
        faces = {f for v in verts for f in v.link_faces}
        for f in faces:
            f.material_index = idx
            f.smooth = smooth
        return verts

    def _matrix(self, center, rot, scale):
        loc = Vector(center) - self.origin
        return Matrix.LocRotScale(loc, Euler(rot), Vector(scale))

    def box(self, size, center, mat, rot=(0, 0, 0)):
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=self._matrix(center, rot, size))
        return self._tag(res["verts"], mat)

    def span(self, x0, x1, y0, y1, z0, z1, mat):
        """Axis-aligned box from min/max corners."""
        return self.box((x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat)

    def cyl(self, r, depth, center, mat, rot=(0, 0, 0), segs=8, r2=None, smooth=False):
        res = bmesh.ops.create_cone(
            self.bm, cap_ends=True, cap_tris=False, segments=segs,
            radius1=r, radius2=r if r2 is None else r2, depth=depth,
            matrix=self._matrix(center, rot, (1, 1, 1)))
        return self._tag(res["verts"], mat, smooth)

    def sphere(self, r, center, mat, scale=(1, 1, 1), segs=12, rings=8, rot=(0, 0, 0)):
        res = bmesh.ops.create_uvsphere(
            self.bm, u_segments=segs, v_segments=rings, radius=r,
            matrix=self._matrix(center, rot, scale))
        return self._tag(res["verts"], mat, smooth=True)

    def ico(self, r, center, mat, scale=(1, 1, 1)):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=1, radius=r, matrix=self._matrix(center, (0, 0, 0), scale))
        return self._tag(res["verts"], mat)

    def text(self, body, size, center, mat):
        curve = bpy.data.curves.new("tmp_text", type="FONT")
        curve.body = body
        curve.size = size
        curve.align_x = "CENTER"
        curve.align_y = "CENTER"
        tmp = bpy.data.objects.new("tmp_text", curve)
        bpy.context.scene.collection.objects.link(tmp)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
        me.transform(Matrix.Translation(Vector(center) - self.origin))
        before = set(self.bm.verts)
        self.bm.from_mesh(me)
        new_verts = [v for v in self.bm.verts if v not in before]
        bpy.data.objects.remove(tmp)
        bpy.data.meshes.remove(me)
        return self._tag(new_verts, mat)

    def build(self, parent=None, outline=0.0):
        """outline: anime outline thickness in meters (0 = none)."""
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(material(m))
        obj = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = self.origin
        if parent:
            attach(obj, parent)
        if outline:
            obj["outline"] = outline
        return obj


def world_location(obj):
    loc = obj.location.copy()
    while obj.parent:
        obj = obj.parent
        loc += obj.location
    return loc


def attach(child, parent):
    """Parents `child` keeping its world position (nothing here is rotated at build time)."""
    world = world_location(child)
    child.parent = parent
    child.matrix_parent_inverse = Matrix.Identity(4)
    child.location = world - world_location(parent)


def empty(name, loc, parent=None, face=None):
    """Marker. face: direction the marker faces ('-y' default, '+y', '+x', '-x')."""
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler.z = {None: 0, "-y": 0, "+y": math.pi, "+x": math.pi / 2, "-x": -math.pi / 2}[face]
    if parent:
        attach(obj, parent)
    return obj


_colliders = []


def collider(x0, x1, y0, y1, z0=0.0, z1=3.2):
    """Invisible box the player cannot walk through (only blocks between z0 and z1)."""
    obj = empty(f"Col_{len(_colliders)}", ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    obj.scale = ((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
    obj["collider"] = 1
    _colliders.append(obj)
    return obj


def walk_surface(name, quads):
    """Invisible mesh the player stands on (floors, stair ramps). quads: lists of 4 (x, y, z) corners."""
    me = bpy.data.meshes.new(name)
    verts, faces = [], []
    for q in quads:
        faces.append(tuple(range(len(verts), len(verts) + 4)))
        verts += q
    me.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj["walk"] = 1
    return obj


def flat(x0, x1, y0, y1, z):
    return [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]


def raise_level(dz):
    """Moves everything built so far up by dz (used to put a room on floor 2)."""
    for obj in bpy.context.scene.objects:
        if obj.parent is None:
            obj.location.z += dz


def reset():
    _colliders.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export(filename):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_extras=True, export_yup=True,
        export_texcoords=False, export_normals=True, export_materials="EXPORT",
        export_cameras=False, export_lights=False)
    print(f"exported {path} ({os.path.getsize(path) // 1024} KB)")


# ---------------------------------------------------------------- School layout
# Floor 1 at z = 0, floor 2 at z = FLOOR2. Light's classroom and the corridor are on floor 2;
# the stairwell is west of the corridor; the lobby (shoe lockers) is under the corridor and
# opens east onto the courtyard.

FLOOR2 = 3.6
STAIR_STEPS = 9            # per flight, plus the landing
STAIR_RISE = 0.2           # 9 × 0.2 = 1.8 = half a floor
STAIR_RUN = 0.27
STAIR_X = -4.2             # where both flights meet the corridor / lobby
LANDING_X = STAIR_X - STAIR_STEPS * STAIR_RUN   # -6.63
WELL_X = -8.0              # stairwell inner west wall
LANE_SPLIT = 4.5           # y: flight B (south, to floor 1) below, flight A (north, from floor 2) above


# ---------------------------------------------------------------- Classroom (floor 2)

DESK_COLS = (-2.7, -0.9, 0.9, 2.7)
DESK_ROWS = (-1.0, 0.4, 1.8)


def build_classroom():
    reset()
    shell = Part("Shell")
    # Nothing but the window wall reaches x 4.2: the facade is there, and coplanar faces would flicker.
    shell.span(-4.2, 4.0, -3.2, 3.2, -0.1, 0, "floor")
    shell.span(-4.2, 4.0, -3.2, 3.2, 3.2, 3.3, "ceiling")
    shell.span(-4.2, 4.0, -3.2, -3.0, 0, 3.2, "plaster")          # front wall (blackboard)
    shell.span(-4.2, -4.0, -3.0, 3.0, 0, 3.2, "plaster")          # west wall
    shell.span(-4.2, -3.4, 3.0, 3.2, 0, 3.2, "plaster")           # back wall, left of door
    shell.span(-2.4, 4.0, 3.0, 3.2, 0, 3.2, "plaster")            # back wall, right of door
    shell.span(-3.4, -2.4, 3.0, 3.2, 2.1, 3.2, "plaster")         # above door
    shell.span(4.0, 4.2, -3.2, 3.2, 0, 0.9, "plaster")            # window wall, below sill
    shell.span(4.0, 4.2, -3.2, 3.2, 2.4, 3.2, "plaster")          # window wall, above
    shell.span(4.0, 4.2, -3.2, -2.6, 0.9, 2.4, "plaster")
    shell.span(4.0, 4.2, 2.6, 3.2, 0.9, 2.4, "plaster")
    shell.build()

    board = Part("Blackboard")
    board.box((4.0, 0.04, 1.2), (0, -2.98, 1.6), "board")
    board.box((4.1, 0.06, 0.05), (0, -2.97, 0.98), "darkwood")
    board.box((1.2, 0.6, 0.05), (0, -2.2, 0.95), "darkwood")      # teacher desk
    board.box((1.1, 0.5, 0.92), (0, -2.2, 0.46), "darkwood")
    board.cyl(0.16, 0.04, (0, -2.98, 2.62), "clockface", rot=(math.radians(90), 0, 0), segs=16)
    board.box((0.012, 0.01, 0.1), (0, -2.955, 2.66), "metal")
    board.box((0.08, 0.01, 0.012), (0.03, -2.955, 2.62), "metal")
    board.build(outline=0.01)

    frames = Part("WindowFrames")
    for y in (-2.6, -1.3, 0.0, 1.3, 2.6):
        frames.box((0.08, 0.05, 1.5), (4.1, y, 1.65), "frame")
    for z in (0.9, 2.4):
        frames.box((0.12, 5.25, 0.05), (4.1, 0, z), "frame")
    frames.box((0.22, 5.3, 0.04), (3.95, 0, 0.9), "frame")       # sill
    frames.box((0.08, 0.6, 1.62), (3.9, -2.35, 1.6), "curtain")
    frames.box((0.08, 0.6, 1.62), (3.9, 2.35, 1.6), "curtain")
    for x in (-2, 0, 2):
        frames.box((1.2, 0.18, 0.06), (x, 0, 3.17), "lamp")
    frames.build(outline=0.008)

    door = Part("Door", (-2.9, 3.05, 0))
    door.box((1.0, 0.06, 2.08), (-2.9, 3.05, 1.04), "darkwood")
    door.box((0.6, 0.065, 0.6), (-2.9, 3.05, 1.5), "glass")
    door.build(outline=0.01)

    desks = Part("Desks")
    for x in DESK_COLS:
        for y in DESK_ROWS:
            desks.box((0.65, 0.45, 0.03), (x, y, 0.72), "wood")
            desks.box((0.6, 0.38, 0.1), (x, y + 0.02, 0.65), "metal")
            for dx in (-0.29, 0.29):
                for dy in (-0.18, 0.18):
                    desks.box((0.03, 0.03, 0.6), (x + dx, y + dy, 0.3), "metal")
            cy = y + 0.42
            desks.box((0.4, 0.38, 0.03), (x, cy, 0.44), "wood")
            desks.box((0.4, 0.03, 0.26), (x, cy + 0.19, 0.68), "wood")
            for dx in (-0.18, 0.18):
                for dy in (-0.17, 0.17):
                    desks.box((0.025, 0.025, 0.43), (x + dx, cy + dy, 0.215), "metal")
                desks.box((0.025, 0.025, 0.3), (x + dx, cy + 0.19, 0.58), "metal")
    desks.build(outline=0.006)

    for r, y in enumerate(DESK_ROWS):
        for c, x in enumerate(DESK_COLS):
            empty(f"Seat_{r}_{c}", (x, y + 0.42, 0))
    empty("Seat_Light", (2.7, 2.22, 0))
    empty("Spawn_Walk", (1.8, 2.2, 0))         # aisle next to Light's desk
    empty("Teacher_Spot", (-1.3, -2.45, 0), face="+y")

    collider(-4.2, 4.2, -3.2, -3.0)            # front wall
    collider(-4.2, -4.0, -3.2, 3.2)            # west wall
    collider(4.0, 4.2, -3.2, 3.2)              # window wall
    collider(-4.2, -3.4, 3.0, 3.2)             # back wall, left of door
    collider(-2.4, 4.2, 3.0, 3.2)              # back wall, right of door
    collider(-0.6, 0.6, -2.5, -1.9)            # teacher desk
    for x in DESK_COLS:                        # each column of desks + chairs
        collider(x - 0.33, x + 0.33, DESK_ROWS[0] - 0.25, DESK_ROWS[-1] + 0.63)
    walk_surface("Walk_Classroom", [flat(-4.0, 4.0, -3.0, 3.2, 0)])
    raise_level(FLOOR2)
    export("classroom.glb")


# ---------------------------------------------------------------- Corridor (floor 2)

def build_corridor():
    reset()
    shell = Part("CorridorShell")
    shell.span(-4.2, 4.0, 3.2, 5.8, -0.1, 0, "linoleum")
    shell.span(-4.2, 4.0, 3.2, 5.8, 3.2, 3.3, "ceiling")
    shell.span(-4.2, 4.0, 5.6, 5.8, 0, 1.0, "plaster")       # north wall, below windows
    shell.span(-4.2, 4.0, 5.6, 5.8, 2.2, 3.2, "plaster")     # above windows
    for x0 in (-4.2, -1.6, 1.0, 3.6):                         # pillars between windows
        shell.span(x0, x0 + 0.4, 5.6, 5.8, 1.0, 2.2, "plaster")
    shell.span(-4.3, -4.2, 3.2, LANE_SPLIT, 0, 1.05, "plaster")   # parapet over the lower flight
    shell.build()

    detail = Part("CorridorDetail")
    for x0, x1 in ((-3.8, -1.6), (-1.2, 1.0), (1.4, 3.6)):
        detail.span(x0, x1, 5.66, 5.72, 1.0, 2.2, "glass")
    for i in range(8):                                          # lockers
        x = -3.6 + i * 0.4
        detail.span(x - 0.19, x + 0.19, 5.15, 5.6, 0, 1.8, "locker")
        detail.span(x - 0.12, x + 0.12, 5.14, 5.15, 1.45, 1.6, "metal")
    detail.span(2.6, 3.5, 3.0, 3.06, 0, 2.08, "darkwood")      # closed door of the next classroom
    detail.span(2.85, 3.25, 3.06, 3.07, 1.2, 1.7, "glass")
    for x in (-3.0, -1.0, 1.0, 3.0):
        detail.box((1.2, 0.18, 0.06), (x, 4.4, 3.17), "lamp")
    detail.build(outline=0.01)

    empty("Spot_Corridor_1", (-2.0, 4.85, 0), face="+x")       # pair talking by the lockers
    empty("Spot_Corridor_2", (-1.35, 4.85, 0), face="-x")
    empty("Spot_Corridor_3", (1.8, 5.25, 0), face="-y")        # leaning at the window
    empty("Spot_Corridor_4", (2.45, 4.95, 0), face="-x")

    collider(-4.2, 4.0, 5.6, 5.8)               # north wall
    collider(-3.8, -0.6, 5.15, 5.6)             # lockers
    collider(-4.3, -4.2, 3.2, LANE_SPLIT)       # parapet
    collider(4.0, 4.2, 3.2, 5.8)                # east end (facade)
    walk_surface("Walk_Corridor", [flat(-4.2, 4.0, 3.0, 5.8, 0)])
    raise_level(FLOOR2)
    export("corridor.glb")


# ---------------------------------------------------------------- Stairwell (both floors)

def build_stairs():
    reset()
    well = Part("StairWell")
    top = FLOOR2 + 3.8
    well.span(WELL_X - 0.4, STAIR_X, 2.9, 3.2, -0.1, top, "plaster")        # south wall
    well.span(WELL_X - 0.4, STAIR_X, 5.8, 6.1, -0.1, top, "plaster")        # north wall
    well.span(WELL_X - 0.4, WELL_X, 3.2, 5.8, -0.1, top, "plaster")         # west wall
    well.span(WELL_X - 0.4, STAIR_X, 2.9, 6.1, -0.2, -0.1, "concrete")      # ground slab
    well.span(WELL_X - 0.4, STAIR_X, 2.9, 6.1, top, top + 0.15, "concrete") # roof
    well.span(WELL_X, LANDING_X, 3.2, 5.8, 1.6, 1.8, "linoleum")            # landing
    well.span(WELL_X, STAIR_X, 3.2, LANE_SPLIT - 0.05, FLOOR2 - 0.1, FLOOR2, "linoleum")  # slab over flight B
    well.span(LANDING_X, STAIR_X, LANE_SPLIT - 0.05, LANE_SPLIT + 0.05, 0, top, "plaster")  # divider
    well.span(WELL_X - 0.41, WELL_X - 0.39, 4.0, 5.0, FLOOR2 + 0.6, FLOOR2 + 2.2, "glass")  # window
    well.build()

    steps = Part("StairSteps")
    for i in range(STAIR_STEPS):
        # Flight A (north lane): from floor 2 down to the landing, heading west.
        x1 = STAIR_X - i * STAIR_RUN
        z = FLOOR2 - (i + 1) * STAIR_RISE
        steps.span(x1 - STAIR_RUN, x1, LANE_SPLIT + 0.05, 5.8, z - 0.3, z, "linoleum")
        # Flight B (south lane): from the landing down to floor 1, heading east.
        x0 = LANDING_X + i * STAIR_RUN
        z = 1.8 - (i + 1) * STAIR_RISE
        steps.span(x0, x0 + STAIR_RUN, 3.2, LANE_SPLIT - 0.05, 0, max(z, 0.02), "linoleum")
    steps.build(outline=0.006)

    collider(WELL_X - 0.4, STAIR_X, 2.9, 3.2, 0, top)          # south wall
    collider(WELL_X - 0.4, STAIR_X, 5.8, 6.1, 0, top)          # north wall
    collider(WELL_X - 0.4, WELL_X, 3.2, 5.8, 0, top)           # west wall
    collider(LANDING_X, STAIR_X, LANE_SPLIT - 0.05, LANE_SPLIT + 0.05, 0, top)  # divider
    collider(WELL_X, STAIR_X, 3.2, LANE_SPLIT - 0.05, FLOOR2 - 0.1, FLOOR2 + 3.0)  # slab over flight B (floor 2)
    collider(LANDING_X, STAIR_X, LANE_SPLIT + 0.05, 5.8, 0, 1.6)                # under flight A (floor 1)

    walk_surface("Walk_Stairs", [
        [(STAIR_X, LANE_SPLIT, FLOOR2), (STAIR_X, 5.8, FLOOR2), (LANDING_X, 5.8, 1.8), (LANDING_X, LANE_SPLIT, 1.8)],
        flat(WELL_X, LANDING_X, 3.2, 5.8, 1.8),
        [(LANDING_X, 3.2, 1.8), (LANDING_X, LANE_SPLIT, 1.8), (STAIR_X, LANE_SPLIT, 0), (STAIR_X, 3.2, 0)],
    ])
    export("stairs.glb")


# ---------------------------------------------------------------- Lobby (floor 1)

def build_lobby():
    reset()
    h = FLOOR2 - 0.1
    shell = Part("LobbyShell")
    shell.span(-4.2, 4.2, 3.6, 5.4, -0.1, 0, "linoleum")             # threshold under the doors
    shell.span(-4.2, 4.0, 3.2, 8.0, -0.1, 0, "linoleum")
    shell.span(-4.2, 4.0, 3.2, 8.0, h - 0.1, h, "ceiling")
    shell.span(-4.2, 4.0, 3.0, 3.2, 0, h, "plaster")                # south wall (closed room behind)
    shell.span(-4.2, -4.0, LANE_SPLIT, 8.0, 0, h, "plaster")        # west wall, beside the stairs
    shell.span(-4.2, 4.0, 8.0, 8.2, 0, h, "plaster")                # north wall
    # The closed classroom under Light's room: just its outer walls and ceiling.
    shell.span(-4.2, -4.0, -3.2, 3.0, 0, h, "plaster")
    shell.span(-4.2, 4.0, -3.2, -3.0, 0, h, "plaster")
    shell.span(-4.0, 4.0, -3.0, 3.0, h - 0.1, h, "ceiling")
    shell.span(-4.0, 4.0, -3.0, 3.0, -0.1, 0, "floor")
    shell.build()

    detail = Part("LobbyDetail")
    for row_y in (6.3, 7.55):                                       # getabako: shoe locker rows
        detail.span(-3.4, 1.6, row_y, row_y + 0.45, 0, 1.75, "wood")
        for i in range(10):
            x = -3.4 + 0.25 + i * 0.5
            for k in range(4):
                z = 0.2 + k * 0.4
                detail.span(x - 0.2, x + 0.2, row_y - 0.005, row_y, z, z + 0.3, "darkwood")
    detail.span(-2.6, -0.6, 3.2, 3.24, 1.1, 2.1, "board")             # notice board
    for i, (x, z) in enumerate(((-2.3, 1.5), (-1.7, 1.75), (-1.1, 1.45), (-1.5, 1.3))):
        detail.span(x - 0.15, x + 0.15, 3.24, 3.25, z - 0.2, z + 0.2, "pages")
    detail.span(4.05, 4.1, 3.6, 3.66, 0, 2.6, "frame")                # open glass doors (frames)
    detail.span(4.05, 4.1, 5.34, 5.4, 0, 2.6, "frame")
    detail.span(4.05, 4.1, 3.6, 5.4, 2.54, 2.6, "frame")
    for x in (-2.5, 0.0, 2.5):
        detail.box((1.2, 0.18, 0.06), (x, 5.0, h - 0.13), "lamp")
    detail.build(outline=0.008)

    empty("Spot_Lobby_1", (-1.2, 5.55, 0), face="+x")               # pair by the shoe lockers
    empty("Spot_Lobby_2", (-0.55, 5.6, 0), face="-x")
    empty("Spot_Lobby_3", (2.3, 6.5, 0), face="-y")
    empty("Spot_Lobby_4", (2.9, 6.1, 0), face="-x")

    collider(-4.2, 4.2, 3.0, 3.2, 0, h)            # south wall
    collider(-4.2, -4.0, LANE_SPLIT, 8.0, 0, h)    # west wall
    collider(-4.2, 4.2, 8.0, 8.2, 0, h)            # north wall
    collider(-3.4, 1.6, 6.3, 6.75, 0, h)           # shoe lockers
    collider(-3.4, 1.6, 7.55, 8.0, 0, h)
    walk_surface("Walk_Lobby", [flat(-4.2, 4.2, 3.2, 8.0, 0)])
    export("lobby.glb")


# ---------------------------------------------------------------- Courtyard

TREES = ((12, 6), (14, -7), (18, 2), (11, -12), (20, 11), (16, -15))


def build_courtyard():
    reset()
    ground = Part("Ground")
    ground.span(-40, 60, -40, 40, -0.12, -0.1, "dirt")
    ground.span(4.2, 24, -20, 20, -0.1, -0.02, "grass")
    ground.span(4.2, 6.2, -20, 20, -0.1, 0.0, "concrete")
    ground.span(6.2, 24, -1.8, -0.2, -0.1, -0.01, "concrete")    # path to the landing spot
    ground.span(6.2, 9.0, 3.6, 5.4, -0.1, -0.01, "concrete")     # path from the lobby doors
    ground.build()

    facade = Part("SchoolFacade")
    top = FLOOR2 + 3.8
    facade.span(4.0, 4.2, -20, -3.2, 0, top, "facade")
    facade.span(4.0, 4.2, 3.2, 3.6, 0, top, "facade")
    facade.span(4.0, 4.2, 3.6, 5.4, 2.6, top, "facade")           # over the lobby doors
    facade.span(4.0, 4.2, 5.4, 20, 0, top, "facade")
    facade.span(4.0, 4.2, -3.2, 3.2, 0, FLOOR2, "facade")         # floor 1 under Light's classroom
    facade.span(4.0, 4.2, -3.2, 3.2, FLOOR2 + 3.2, top, "facade")
    facade.span(-8.4, 4.2, -20, 20, top - 0.1, top + 0.1, "concrete")  # roof slab
    for y0 in range(-19, 19, 3):                                   # floor 1 windows
        if 2 < y0 < 6:
            continue
        facade.span(4.19, 4.24, y0 + 0.3, y0 + 2.5, 1.0, 2.4, "glass")
    for y0 in range(-19, 19, 3):                                   # floor 2 windows (not on the classroom)
        if -4 < y0 < 3:
            continue
        facade.span(4.19, 4.24, y0 + 0.3, y0 + 2.5, FLOOR2 + 0.9, FLOOR2 + 2.4, "glass")
    facade.build(outline=0.03)

    walls = Part("Walls")
    walls.span(24, 24.3, -20, 20, 0, 1.8, "concrete")
    walls.span(4.2, 24.3, -20.3, -20, 0, 1.8, "concrete")
    walls.span(4.2, 24.3, 20, 20.3, 0, 1.8, "concrete")
    walls.span(30, 38, -16, 16, 0, 12, "facade")                  # far wing in the fog
    for z in (2, 5, 8):
        walls.span(29.95, 30.0, -15, 15, z, z + 1.4, "glass")
    walls.build(outline=0.03)

    trees = Part("Trees")
    for x, y in TREES:
        trees.cyl(0.18, 2.4, (x, y, 1.2), "trunk", segs=6)
        trees.ico(1.5, (x, y, 3.1), "leaves", scale=(1, 1, 0.85))
        trees.ico(1.1, (x + 0.4, y - 0.3, 4.2), "leaves")
    trees.build(outline=0.04)

    empty("Landing_Notebook", (9, -1, 0))

    collider(4.0, 4.2, -20, 3.6, 0, top)        # school facade, south of the doors
    collider(4.0, 4.2, 5.4, 20, 0, top)         # north of the doors
    collider(4.0, 4.2, 3.6, 5.4, 2.6, top)      # over the doors
    collider(24, 24.3, -20, 20, 0, 1.8)         # perimeter walls
    collider(4.2, 24.3, -20.3, -20, 0, 1.8)
    collider(4.2, 24.3, 20, 20.3, 0, 1.8)
    for x, y in TREES:
        collider(x - 0.25, x + 0.25, y - 0.25, y + 0.25, 0, 2.5)
    walk_surface("Walk_Courtyard", [flat(4.0, 24.0, -20.0, 20.0, 0)])
    export("courtyard.glb")


# ---------------------------------------------------------------- Notebook

def build_notebook():
    reset()
    book = Part("Notebook", (0, 0, 0))
    book.box((0.18, 0.25, 0.018), (0, 0, 0.009), "cover")
    book.box((0.012, 0.242, 0.012), (0.085, 0, 0.009), "pages")
    book.box((0.168, 0.012, 0.012), (0.004, 0.12, 0.009), "pages")
    book.box((0.168, 0.012, 0.012), (0.004, -0.12, 0.009), "pages")
    book.text("DEATH NOTE", 0.024, (0, 0.06, 0.0185), "title")
    book.build(outline=0.004)
    export("notebook.glb")


if __name__ == "__main__":
    build_classroom()
    build_corridor()
    build_stairs()
    build_lobby()
    build_courtyard()
    build_notebook()
