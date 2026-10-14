"""Generates the skinned anime-style characters (Light, teacher, students) as GLBs.

Run with Blender:   blender -b -P tools/blender/characters.py
or with bpy module: python tools/blender/characters.py

Each character is one mesh (body + head + hair) with one material:
outfit colors live in vertex colors, the face is a texture on the head.
Coordinates are Blender's (Z up, facing -Y); the exporter converts to three.js.
"""
import math
import os
import sys

import bpy  # must come before bmesh/mathutils when running as the bpy module
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_assets import OUT_DIR, hex_rgba  # noqa: E402
from faces import FACE_H, FACE_W  # noqa: E402  (pure constants, no PIL needed)

# Face textures are drawn with PIL by `python3 tools/blender/faces.py` and committed here,
# because Blender's bundled Python has no PIL.
TEX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_textures")


def face_texture(spec):
    path = os.path.join(TEX_DIR, f"face_{spec['id']}.png")
    if not os.path.exists(path):
        from faces import draw_face  # needs PIL; run faces.py with a normal Python if this fails
        os.makedirs(TEX_DIR, exist_ok=True)
        draw_face(spec["eyes"], spec["eye_color"], spec["glasses"], path, brow_color=spec["hair"]["color"])
    return path

BASE_HEIGHT = 1.75

OUTFITS = {
    "uniform_m": {"jacket": "#6b5440", "pants": "#3a2f26", "shirt": "#e9e6df", "tie": "#6e1f24", "shoes": "#1b1714"},
    "uniform_f": {"jacket": "#6b5440", "skirt": "#3b3f52", "shirt": "#e9e6df", "tie": "#8e1f2a",
                  "socks": "#1d2030", "shoes": "#1b1714"},
    "suit": {"jacket": "#4a4d55", "pants": "#4a4d55", "shirt": "#e9e6df", "tie": "#2a2f45", "shoes": "#141210"},
}

CHARACTERS = [
    {"id": "light", "height": 1.78, "build": {"shoulders": 0.97, "hips": 0.95, "limbs": 0.92},
     "outfit": "uniform_m", "skin": "#f1d2b6", "hair": {"style": "light", "color": "#7a4a2a"},
     "eyes": "sharp", "eye_color": "#6a2a1c", "glasses": False},
    {"id": "teacher", "height": 1.72, "build": {"shoulders": 1.08, "hips": 1.1, "limbs": 1.05},
     "outfit": "suit", "skin": "#e8c3a4", "hair": {"style": "short", "color": "#4a4a4a"},
     "eyes": "tired", "eye_color": "#3a2a22", "glasses": True},
    {"id": "student_m1", "height": 1.70, "build": {"shoulders": 1.0, "hips": 1.0, "limbs": 1.0},
     "outfit": "uniform_m", "skin": "#efcdb0", "hair": {"style": "short", "color": "#1c1c1e"},
     "eyes": "soft", "eye_color": "#3b2a20", "glasses": False},
    {"id": "student_m2", "height": 1.75, "build": {"shoulders": 1.04, "hips": 1.0, "limbs": 1.02},
     "outfit": "uniform_m", "skin": "#e6c09f", "hair": {"style": "spiky", "color": "#2b2018"},
     "eyes": "sharp", "eye_color": "#2e2420", "glasses": False},
    {"id": "student_f1", "height": 1.60, "build": {"shoulders": 0.9, "hips": 1.0, "limbs": 0.88},
     "outfit": "uniform_f", "skin": "#f4d6bd", "hair": {"style": "bob", "color": "#1a1a1d"},
     "eyes": "soft", "eye_color": "#3a2c4a", "glasses": False},
    {"id": "student_f2", "height": 1.63, "build": {"shoulders": 0.9, "hips": 1.02, "limbs": 0.88},
     "outfit": "uniform_f", "skin": "#f1cfb2", "hair": {"style": "long", "color": "#5a3a22"},
     "eyes": "soft", "eye_color": "#4a3020", "glasses": False},
]


# ---------------------------------------------------------------- skeleton

def joints(spec):
    """Named joint positions for this body (meters, Blender coords)."""
    s = spec["height"] / BASE_HEIGHT
    b = spec["build"]
    sh, hp = b["shoulders"], b["hips"]
    J = {
        "pelvis": (0, 0, 0.95), "spine": (0, 0, 1.12), "chest": (0, 0, 1.32), "chest_top": (0, 0, 1.46),
        "neck": (0, 0, 1.53), "head_base": (0, 0, 1.57), "head_top": (0, 0, 1.82),
    }
    for side, sx in (("L", 1), ("R", -1)):
        J[f"clav_{side}"] = (0.04 * sx, 0, 1.45)
        J[f"shoulder_{side}"] = (0.19 * sh * sx, 0, 1.43)
        J[f"elbow_{side}"] = (0.225 * sh * sx, 0.01, 1.16)
        J[f"wrist_{side}"] = (0.245 * sh * sx, 0, 0.91)
        J[f"hand_{side}"] = (0.255 * sh * sx, -0.01, 0.81)
        J[f"hip_{side}"] = (0.095 * hp * sx, 0, 0.93)
        J[f"knee_{side}"] = (0.10 * hp * sx, -0.01, 0.51)
        J[f"ankle_{side}"] = (0.10 * hp * sx, 0.02, 0.09)
        J[f"toe_{side}"] = (0.10 * hp * sx, -0.11, 0.03)
    return {k: Vector(v) * s for k, v in J.items()}


def bones(J):
    """(name, head, tail, parent) for the armature, in the order parents come first."""
    out = [
        ("Hips", J["pelvis"], J["spine"], None),
        ("Spine", J["spine"], J["chest"], "Hips"),
        ("Chest", J["chest"], J["chest_top"], "Spine"),
        ("Neck", J["chest_top"], J["head_base"], "Chest"),
        ("Head", J["head_base"], J["head_top"], "Neck"),
    ]
    for side in ("L", "R"):
        out += [
            (f"Shoulder.{side}", J[f"clav_{side}"], J[f"shoulder_{side}"], "Chest"),
            (f"UpperArm.{side}", J[f"shoulder_{side}"], J[f"elbow_{side}"], f"Shoulder.{side}"),
            (f"LowerArm.{side}", J[f"elbow_{side}"], J[f"wrist_{side}"], f"UpperArm.{side}"),
            (f"Hand.{side}", J[f"wrist_{side}"], J[f"hand_{side}"], f"LowerArm.{side}"),
            (f"UpperLeg.{side}", J[f"hip_{side}"], J[f"knee_{side}"], "Hips"),
            (f"LowerLeg.{side}", J[f"knee_{side}"], J[f"ankle_{side}"], f"UpperLeg.{side}"),
            (f"Foot.{side}", J[f"ankle_{side}"], J[f"toe_{side}"], f"LowerLeg.{side}"),
        ]
    return out


# ---------------------------------------------------------------- geometry

def skin_body(spec, J):
    """Continuous body from a vertex graph with per-vertex radii (Skin modifier + 1 subdivision)."""
    s = spec["height"] / BASE_HEIGHT
    b = spec["build"]
    sh, hp, lm = b["shoulders"], b["hips"], b["limbs"]
    nodes = [
        ("pelvis", (0.155 * hp, 0.105)), ("spine", (0.14, 0.095)), ("chest", (0.17 * sh, 0.115)),
        ("chest_top", (0.165 * sh, 0.10)), ("neck", (0.048, 0.048)),
    ]
    for side in ("L", "R"):
        nodes += [
            (f"shoulder_{side}", (0.068 * lm, 0.068 * lm)), (f"elbow_{side}", (0.052 * lm, 0.052 * lm)),
            (f"wrist_{side}", (0.039 * lm, 0.034 * lm)), (f"hand_{side}", (0.036, 0.02)),
            (f"hip_{side}", (0.098 * lm, 0.098 * lm)), (f"knee_{side}", (0.066 * lm, 0.066 * lm)),
            (f"ankle_{side}", (0.047 * lm, 0.047 * lm)), (f"toe_{side}", (0.045, 0.032)),
        ]
    index = {name: i for i, (name, _) in enumerate(nodes)}
    edges = [("pelvis", "spine"), ("spine", "chest"), ("chest", "chest_top"), ("chest_top", "neck")]
    for side in ("L", "R"):
        edges += [("chest_top", f"shoulder_{side}"), (f"shoulder_{side}", f"elbow_{side}"),
                  (f"elbow_{side}", f"wrist_{side}"), (f"wrist_{side}", f"hand_{side}"),
                  ("pelvis", f"hip_{side}"), (f"hip_{side}", f"knee_{side}"),
                  (f"knee_{side}", f"ankle_{side}"), (f"ankle_{side}", f"toe_{side}")]
    me = bpy.data.meshes.new("skin_graph")
    me.from_pydata([J[n] for n, _ in nodes], [(index[a], index[c]) for a, c in edges], [])
    obj = bpy.data.objects.new("skin_graph", me)
    bpy.context.scene.collection.objects.link(obj)
    obj.modifiers.new("skin", "SKIN").branch_smoothing = 0.6
    for i, (_, (rx, ry)) in enumerate(nodes):
        me.skin_vertices[0].data[i].radius = (rx * s, ry * s)
    me.skin_vertices[0].data[index["pelvis"]].use_root = True
    obj.modifiers.new("sub", "SUBSURF").levels = 1
    dg = bpy.context.evaluated_depsgraph_get()
    body = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(me)
    return body


def head_center(J):
    return J["head_base"] + Vector((0, -0.005, 0.105)) * (J["head_top"].z / 1.82)


def add_head(bm, J):
    """Slightly egg-shaped head with an anime V chin. Returns its vertices."""
    s = J["head_top"].z / 1.82
    c = head_center(J)
    res = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=0.112 * s,
                                    matrix=Matrix.LocRotScale(c, None, Vector((0.9, 1.0, 1.1))))
    for v in res["verts"]:
        d = v.co - c
        if d.z < -0.03 * s:                      # narrow the jaw towards the chin
            k = min(1.0, (-0.03 * s - d.z) / (0.09 * s))
            v.co.x = c.x + d.x * (1 - 0.35 * k)
            if d.y < 0:
                v.co.y -= 0.01 * s * k
    return res["verts"]


def clump(bm, base, direction, length, radius, bend=(0, 0, 0)):
    """A pointed hair lock: a 5-sided cone from `base` along `direction`, tip bent by `bend`."""
    d = Vector(direction).normalized()
    res = bmesh.ops.create_cone(bm, cap_ends=False, segments=5, radius1=radius, radius2=0.0, depth=length,
                                matrix=Matrix.Translation(Vector(base) + d * (length / 2)) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4())
    bend = Vector(bend)
    for v in res["verts"]:
        t = max(0.0, (v.co - Vector(base)).dot(d) / length)
        v.co += bend * (t * t)
    return res["verts"]


# Locks per style: (angle around the head in degrees, 0 = front; height on the head -1..1;
# length; radius; direction tweak (down, out); bend). Angles grow towards the character's left.
HAIR_STYLES = {
    "light": {"cut": 0.38, "back": -0.45, "locks": (
        [(a, 0.52, 0.05, 0.03, (1.0, 0.3), (0, 0, -0.005)) for a in (-36, -20, -6, 8, 22, 36)] +   # fringe, tips at the brows
        [(a, 0.15, 0.13, 0.034, (1.0, 0.15), (0, 0, -0.01)) for a in (-62, 62)] +                    # side locks
        [(a, 0.25, 0.12, 0.04, (0.9, 0.4), (0, 0, 0)) for a in (-110, -140, 180, 140, 110)] +        # back
        [(a, 0.75, 0.09, 0.04, (0.2, 1.0), (0, 0, -0.02)) for a in (-60, 0, 60, 120, -120, 180)])},  # crown
    "short": {"cut": 0.5, "back": -0.3, "locks": (
        [(a, 0.55, 0.05, 0.03, (0.8, 0.4), (0, 0, -0.01)) for a in (-30, -10, 10, 30)] +
        [(a, 0.3, 0.07, 0.035, (0.9, 0.3), (0, 0, 0)) for a in (-70, 70, -120, 120, 180)])},
    "spiky": {"cut": 0.45, "back": -0.3, "locks": (
        [(a, 0.5, 0.065, 0.032, (0.6, 0.6), (0, 0, -0.005)) for a in (-30, -10, 10, 30)] +
        [(a, h, 0.11, 0.04, (-0.3, 1.0), (0, 0, 0.0)) for a in range(-150, 181, 50) for h in (0.5, 0.85)])},
    "bob": {"cut": 0.33, "back": -0.75, "locks": (
        [(a, 0.5, 0.045, 0.032, (1.0, 0.25), (0, 0, 0)) for a in (-30, -15, 0, 15, 30)] +
        [(a, 0.2, 0.17, 0.045, (1.0, 0.35), (0, 0, 0)) for a in (-60, -85, -120, -150, 180, 150, 120, 85, 60)])},
    "long": {"cut": 0.33, "back": -0.75, "locks": (
        [(a, 0.5, 0.045, 0.032, (1.0, 0.25), (0, 0, 0)) for a in (-28, -10, 10, 28)] +
        [(a, 0.15, 0.2, 0.04, (1.0, 0.25), (0, 0, 0)) for a in (-55, 55)] +
        [(a, 0.1, 0.36, 0.055, (1.0, 0.3), (0, 0.04, 0)) for a in (-100, -135, 180, 135, 100)])},
}


def build_hair(bm, J, style):
    """Hair cap + pointed locks for a style. Returns its vertices."""
    st = HAIR_STYLES[style]
    s = J["head_top"].z / 1.82
    c = head_center(J)
    r = 0.122 * s
    cap = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=9, radius=r,
                                    matrix=Matrix.LocRotScale(c + Vector((0, 0.01, 0.015)) * s, None, Vector((0.94, 1.03, 1.0))))
    # Open the face: drop cap vertices below the hairline in front and below `back` behind.
    cut = []
    for v in cap["verts"]:
        h = (v.co.z - c.z) / r
        front = v.co.y < c.y - 0.02 * s
        if (front and h < st["cut"]) or h < st["back"]:
            cut.append(v)
    bmesh.ops.delete(bm, geom=cut, context="VERTS")
    verts = [v for v in cap["verts"] if v.is_valid]
    for angle, h, length, radius, (down, out), bend in st["locks"]:
        a = math.radians(angle)
        radial = Vector((math.sin(a), -math.cos(a), 0))           # 0 deg = facing -Y (front)
        z = c.z + h * r
        ring = math.sqrt(max(0.0, 1 - h * h)) * r * 1.02
        base = Vector((c.x + radial.x * ring * 0.94, c.y + radial.y * ring, z))
        direction = radial * out + Vector((0, 0, -down))
        verts += clump(bm, base, direction, length * s, radius * s, Vector(bend) * s)
    return verts


def add_front_details(bm, J, spec):
    """Shirt V and tie (or bow) as thin overlay quads just in front of the chest.

    The body's faces are too coarse to paint such narrow shapes with vertex colors.
    Returns {vertex: color name}.
    """
    s = spec["height"] / BASE_HEIGHT
    top = J["chest_top"].z
    y = -0.123 * s
    out = {}

    def quad(pts, color, dy=0.0):
        verts = [bm.verts.new((x, y + dy, z)) for x, z in pts]
        bm.faces.new(verts)
        for v in verts:
            out[v] = color

    v_bottom = top - 0.19 * s
    quad([(-0.075 * s, top + 0.01 * s), (0.075 * s, top + 0.01 * s), (0.0, v_bottom)], "shirt")
    if spec["outfit"] == "uniform_f":
        w, h, z = 0.045 * s, 0.03 * s, top - 0.035 * s
        quad([(0, z), (-w, z + h), (-w, z - h)], "tie", -0.004 * s)
        quad([(0, z), (w, z - h), (w, z + h)], "tie", -0.004 * s)
    else:
        knot = top - 0.02 * s
        quad([(-0.016 * s, knot + 0.012 * s), (0.016 * s, knot + 0.012 * s),
              (0.012 * s, knot - 0.02 * s), (-0.012 * s, knot - 0.02 * s)], "tie", -0.004 * s)
        bottom = J["spine"].z + 0.02 * s
        quad([(-0.012 * s, knot - 0.02 * s), (0.012 * s, knot - 0.02 * s),
              (0.024 * s, bottom + 0.02 * s), (0, bottom), (-0.024 * s, bottom + 0.02 * s)], "tie", -0.004 * s)
    return out


def add_skirt(bm, J, spec):
    s = spec["height"] / BASE_HEIGHT
    top, bottom = J["pelvis"].z + 0.05 * s, J["knee_L"].z + 0.17 * s
    res = bmesh.ops.create_cone(bm, cap_ends=False, segments=14, radius1=0.25 * s, radius2=0.165 * s,
                                depth=top - bottom, matrix=Matrix.Translation((0, 0, (top + bottom) / 2)))
    for v in res["verts"]:
        v.co.y *= 0.8
    return res["verts"]


# ---------------------------------------------------------------- weights + colors

def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def skin_weights(co, bone_list, related):
    """Nearest bone, blended with an adjacent bone near joints."""
    d = sorted(((seg_dist(co, h, t), n) for n, h, t, _ in bone_list))
    (d1, b1), rest = d[0], d[1:]
    w = {b1: 1 / (d1 + 0.01) ** 4}
    for d2, b2 in rest:
        if b2 in related[b1]:
            w[b2] = 1 / (d2 + 0.01) ** 4
            break
    total = sum(w.values())
    return {k: v / total for k, v in w.items()}


def region_color(spec, J, bone, c):
    """Outfit color name for a body face with center `c` mostly weighted to `bone`."""
    o = spec["outfit"]
    s = spec["height"] / BASE_HEIGHT
    front = c.y < -0.045 * s
    top = J["chest_top"].z
    if bone in ("Head",):
        return "skin"
    if bone == "Neck":
        return "shirt" if c.z < top + 0.035 * s else "skin"
    if bone.startswith("Hand"):
        return "skin"
    if bone.startswith("Foot") or c.z < J["ankle_L"].z + 0.03 * s:
        return "shoes"
    if bone in ("Chest", "Spine") or bone.startswith("Shoulder") or bone.startswith("UpperArm"):
        return "jacket"   # shirt V and tie are separate overlay pieces (add_front_details)
    if bone.startswith("LowerArm"):
        return "shirt" if c.z < J["wrist_L"].z + 0.035 * s else "jacket"
    if bone == "Hips":
        if c.z > J["pelvis"].z + 0.03 * s and o != "uniform_f":
            return "jacket"
        return "skirt" if o == "uniform_f" else "pants"
    if o == "uniform_f":
        if bone.startswith("LowerLeg") and c.z < J["knee_L"].z - 0.05 * s:
            return "socks"
        return "skin"
    return "pants"


def palette(spec):
    p = dict(OUTFITS[spec["outfit"]])
    p["skin"] = spec["skin"]
    p["hair"] = spec["hair"]["color"]
    return p


# ---------------------------------------------------------------- build

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(face_png):
    """Base color = vertex colors x face texture (white everywhere except the face features)."""
    mat = bpy.data.materials.new("Toon")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(face_png)
    tex.interpolation = "Linear"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(tex.outputs["Color"], mix.inputs["A"])
    nt.links.new(attr.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    return mat


WHITE_UV = (0.75, 0.5)


def face_uv(J, co):
    """Front projection of a head vertex onto the face texture (same mapping as faces.py)."""
    c = head_center(J)
    s = J["head_top"].z / 1.82
    if co.y > c.y + 0.01 * s:
        return WHITE_UV
    return 0.25 + (co.x - c.x) / s / FACE_W * 0.5, 0.5 + (co.z - c.z) / s / FACE_H


def make_armature(spec, bone_list):
    arm = bpy.data.armatures.new(f"{spec['id']}_rig")
    obj = bpy.data.objects.new(f"char_{spec['id']}", arm)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    made = {}
    for name, head, tail, parent in bone_list:
        b = arm.edit_bones.new(name)
        b.head, b.tail = head, tail
        b.roll = 0
        if parent:
            b.parent = made[parent]
        made[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def build_character(spec):
    reset()
    J = joints(spec)
    bone_list = bones(J)
    related = {n: set() for n, *_ in bone_list}
    for n, _, _, parent in bone_list:
        if parent:
            related[n].add(parent)
            related[parent].add(n)
    colors = palette(spec)

    bm = bmesh.new()
    body = skin_body(spec, J)
    bm.from_mesh(body)
    bpy.data.meshes.remove(body)
    body_verts = set(bm.verts)
    head_verts = set(add_head(bm, J))
    hair_verts = set(build_hair(bm, J, spec["hair"]["style"]))
    skirt_verts = set(add_skirt(bm, J, spec)) if spec["outfit"] == "uniform_f" else set()
    detail_colors = add_front_details(bm, J, spec)

    bm.verts.ensure_lookup_table()
    weights = {}
    for v in bm.verts:
        if v in head_verts or v in hair_verts:
            weights[v.index] = {"Head": 1.0}
        elif v in skirt_verts:
            weights[v.index] = {"Hips": 1.0}
        elif v in detail_colors:
            weights[v.index] = {"Chest": 1.0}
        else:
            weights[v.index] = skin_weights(v.co, bone_list, related)

    col = bm.loops.layers.float_color.new("Col")
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        is_face = all(v in head_verts for v in f.verts)
        for loop in f.loops:
            loop[uv].uv = face_uv(J, loop.vert.co) if is_face else WHITE_UV
        fv = f.verts
        if fv[0] in hair_verts:
            name = "hair"
        elif fv[0] in head_verts:
            name = "skin"
        elif fv[0] in skirt_verts:
            name = "skirt"
        elif fv[0] in detail_colors:
            name = detail_colors[fv[0]]
        else:
            dominant = {}
            for v in fv:
                bname = max(weights[v.index].items(), key=lambda kv: kv[1])[0]
                dominant[bname] = dominant.get(bname, 0) + 1
            name = region_color(spec, J, max(dominant, key=dominant.get), f.calc_center_median())
        rgba = hex_rgba(colors[name])
        for loop in f.loops:
            loop[col] = rgba
        f.smooth = True

    me = bpy.data.meshes.new(f"{spec['id']}_body")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(make_material(face_texture(spec)))
    mesh_obj = bpy.data.objects.new(f"{spec['id']}_mesh", me)
    bpy.context.scene.collection.objects.link(mesh_obj)

    arm_obj = make_armature(spec, bone_list)
    for name, *_ in bone_list:
        mesh_obj.vertex_groups.new(name=name)
    for vi, w in weights.items():
        for bname, wt in w.items():
            mesh_obj.vertex_groups[bname].add([vi], wt, "REPLACE")
    mesh_obj.parent = arm_obj
    mesh_obj.modifiers.new("Armature", "ARMATURE").object = arm_obj
    arm_obj["palette"] = {"hair": colors["hair"], "skin": colors["skin"]}

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"char_{spec['id']}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_extras=True, export_yup=True, export_skins=True,
        export_vertex_color="MATERIAL", export_texcoords=True, export_image_format="JPEG", export_normals=True,
        export_animations=False, export_cameras=False, export_lights=False)
    print(f"exported {path} ({os.path.getsize(path) // 1024} KB)")
    return path


if __name__ == "__main__":
    for character in CHARACTERS:
        build_character(character)
