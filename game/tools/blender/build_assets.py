"""Builds the chapter 1 low-poly models and exports them as GLB.

Run with Blender:   blender -b -P tools/blender/build_assets.py
or with bpy module: python tools/blender/build_assets.py

Coordinates here are Blender's (Z up, characters face -Y).
The glTF exporter converts to three.js (Y up, characters face +Z).
Objects with the custom property "outline" (thickness in meters) get an anime outline in the game.
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
    "grass": "#3d4a35", "dirt": "#3a352c", "concrete": "#6f6b64", "trunk": "#3b2a1e",
    "leaves": "#24331f", "facade": "#9a9384", "glass": "#1c2430",
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


def empty(name, loc, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    if parent:
        attach(obj, parent)
    return obj


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export(filename):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_extras=True, export_yup=True,
        export_texcoords=False, export_normals=True, export_materials="EXPORT",
        export_cameras=False, export_lights=False)
    print(f"exported {path} ({os.path.getsize(path) // 1024} KB)")


# ---------------------------------------------------------------- Light

def build_light():
    reset()
    root = empty("Light", (0, 0, 0))

    torso = Part("Torso", (0, 0, 0.95))
    torso.box((0.34, 0.2, 0.16), (0, 0, 0.99), "pants")
    torso.box((0.42, 0.23, 0.42), (0, 0, 1.27), "jacket")
    torso.box((0.36, 0.21, 0.08), (0, 0, 1.06), "jacket")
    torso.box((0.15, 0.05, 0.07), (0, -0.105, 1.465), "shirt")
    torso.box((0.05, 0.012, 0.22), (0, -0.118, 1.36), "tie")
    torso.cyl(0.045, 0.1, (0, 0, 1.52), "skin")
    torso = torso.build(root, outline=0.008)

    head = Part("Head", (0, 0, 1.54))
    head.sphere(0.115, (0, 0, 1.665), "skin", scale=(0.92, 1.0, 1.12))
    for x in (-0.04, 0.04):
        head.box((0.034, 0.012, 0.012), (x, -0.112, 1.668), "eye")
        head.box((0.04, 0.01, 0.007), (x, -0.111, 1.689), "hair", rot=(0, math.copysign(0.18, x), 0))
    hair_verts = head.sphere(0.126, (0, 0.012, 1.69), "hair", scale=(1.0, 1.02, 0.96), segs=14, rings=9)
    cut = [v for v in hair_verts if (v.co.z + 1.54 < 1.692 and v.co.y < -0.01) or v.co.z + 1.54 < 1.6]
    bmesh.ops.delete(head.bm, geom=cut, context="VERTS")
    for x in (-0.075, -0.035, 0.005, 0.045, 0.08):
        head.cyl(0.03, 0.06, (x, -0.104, 1.722), "hair", rot=(math.radians(-15), 0, 0), segs=4, r2=0.0)
    for x in (-0.108, 0.108):
        head.box((0.03, 0.09, 0.13), (x, -0.025, 1.64), "hair")
    head.build(torso, outline=0.008)

    for side, sx in (("L", 1), ("R", -1)):
        up = Part(f"ArmUpper{side}", (0.25 * sx, 0, 1.43))
        up.box((0.11, 0.12, 0.31), (0.25 * sx, 0, 1.29), "jacket")
        up = up.build(torso, outline=0.008)
        low = Part(f"ArmLower{side}", (0.25 * sx, 0, 1.14))
        low.box((0.095, 0.105, 0.24), (0.25 * sx, 0, 1.02), "jacket")
        low.box((0.085, 0.095, 0.03), (0.25 * sx, 0, 0.895), "shirt")
        low.sphere(0.045, (0.25 * sx, -0.005, 0.845), "skin", scale=(0.75, 1.0, 1.25), segs=8, rings=6)
        low.build(up, outline=0.008)

        leg = Part(f"LegUpper{side}", (0.1 * sx, 0, 0.92))
        leg.box((0.145, 0.165, 0.45), (0.1 * sx, 0, 0.7), "pants")
        leg = leg.build(root, outline=0.008)
        shin = Part(f"LegLower{side}", (0.1 * sx, 0, 0.48))
        shin.box((0.125, 0.145, 0.42), (0.1 * sx, 0, 0.27), "pants")
        shin.box((0.125, 0.25, 0.08), (0.1 * sx, -0.045, 0.04), "shoe")
        shin.build(leg, outline=0.008)

    export("light.glb")


# ---------------------------------------------------------------- Classroom

DESK_COLS = (-2.7, -0.9, 0.9, 2.7)
DESK_ROWS = (-1.0, 0.4, 1.8)


def build_classroom():
    reset()
    shell = Part("Shell")
    shell.span(-4.2, 4.2, -3.2, 3.2, -0.1, 0, "floor")
    shell.span(-4.2, 4.2, -3.2, 3.2, 3.2, 3.3, "ceiling")
    shell.span(-4.2, 4.2, -3.2, -3.0, 0, 3.2, "plaster")          # front wall (blackboard)
    shell.span(-4.2, -4.0, -3.0, 3.0, 0, 3.2, "plaster")          # corridor-side wall
    shell.span(-4.2, -3.4, 3.0, 3.2, 0, 3.2, "plaster")           # back wall, left of door
    shell.span(-2.4, 4.2, 3.0, 3.2, 0, 3.2, "plaster")            # back wall, right of door
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

    empty("Seat_Light", (2.7, 2.22, 0))
    empty("Exit_Door", (-2.9, 2.7, 0))
    export("classroom.glb")


# ---------------------------------------------------------------- Courtyard

TREES = ((12, 6), (14, -7), (18, 2), (11, -12), (20, 11), (16, -15))


def build_courtyard():
    reset()
    ground = Part("Ground")
    ground.span(-40, 60, -40, 40, -0.12, -0.1, "dirt")
    ground.span(4.2, 24, -20, 20, -0.1, -0.02, "grass")
    ground.span(4.2, 6.2, -20, 20, -0.1, 0.0, "concrete")
    ground.span(6.2, 24, -1.8, -0.2, -0.1, -0.01, "concrete")    # path to the landing spot
    ground.build()

    facade = Part("SchoolFacade")
    facade.span(4.0, 4.2, -20, -3.2, 0, 7.4, "facade")
    facade.span(4.0, 4.2, 3.2, 20, 0, 7.4, "facade")
    facade.span(4.0, 4.2, -3.2, 3.2, 3.2, 7.4, "facade")
    facade.span(-4.2, 4.2, -20, 20, 7.3, 7.5, "concrete")         # roof slab
    for y0 in range(-19, 19, 3):
        if -4 < y0 < 3:
            continue
        facade.span(4.19, 4.24, y0 + 0.3, y0 + 2.5, 1.0, 2.4, "glass")
    for y0 in range(-19, 19, 3):
        facade.span(4.19, 4.24, y0 + 0.3, y0 + 2.5, 4.4, 5.8, "glass")
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
    build_light()
    build_classroom()
    build_courtyard()
    build_notebook()
