"""Checks the exported GLBs against the budgets and conventions the game relies on.

Run: python tools/blender/check_assets.py   (exit code 1 on any failure)
No Blender needed: it only reads the GLB JSON chunk.
"""
import glob
import json
import os
import struct
import sys

ASSETS = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "assets"))

BONES = [
    "Hips", "Spine", "Chest", "Neck", "Head",
    "Shoulder.L", "Shoulder.R", "UpperArm.L", "UpperArm.R", "LowerArm.L", "LowerArm.R",
    "Hand.L", "Hand.R", "UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R", "Foot.L", "Foot.R",
]
CHARACTER_FILES = [
    "char_light.glb", "char_teacher.glb",
    "char_student_m1.glb", "char_student_m2.glb", "char_student_f1.glb", "char_student_f2.glb",
]
MAX_CHAR_TRIS = 4000


def read_glb(path):
    """Returns the glTF JSON of a .glb file."""
    with open(path, "rb") as f:
        magic, _version, _length = struct.unpack("<4sII", f.read(12))
        if magic != b"glTF":
            raise ValueError(f"{path}: not a GLB")
        chunk_len, chunk_type = struct.unpack("<I4s", f.read(8))
        if chunk_type != b"JSON":
            raise ValueError(f"{path}: first chunk is not JSON")
        return json.loads(f.read(chunk_len))


def triangles(gltf):
    total = 0
    for mesh in gltf.get("meshes", []):
        for prim in mesh["primitives"]:
            if prim.get("mode", 4) != 4:
                continue
            acc = gltf["accessors"][prim["indices"]] if "indices" in prim else gltf["accessors"][prim["attributes"]["POSITION"]]
            total += acc["count"] // 3
    return total


def check_character(path, expected_files_only=False):
    errors = []
    name = os.path.basename(path)
    if not os.path.exists(path):
        return [f"{name}: missing"]
    g = read_glb(path)
    skins = g.get("skins", [])
    if not skins:
        errors.append(f"{name}: no skin")
    else:
        joints = {g["nodes"][j].get("name") for j in skins[0]["joints"]}
        missing = [b for b in BONES if b not in joints]
        if missing:
            errors.append(f"{name}: missing bones {missing}")
    tris = triangles(g)
    if tris > MAX_CHAR_TRIS:
        errors.append(f"{name}: {tris} triangles > {MAX_CHAR_TRIS}")
    if len(g.get("images", [])) != 1:
        errors.append(f"{name}: {len(g.get('images', []))} images, expected 1 face texture")
    if len(g.get("materials", [])) != 1:
        errors.append(f"{name}: {len(g.get('materials', []))} materials, expected 1")
    for mesh in g.get("meshes", []):
        for prim in mesh["primitives"]:
            for attr in ("COLOR_0", "JOINTS_0", "WEIGHTS_0", "TEXCOORD_0"):
                if attr not in prim["attributes"]:
                    errors.append(f"{name}: primitive without {attr}")
    palettes = [n["extras"]["palette"] for n in g["nodes"] if "palette" in n.get("extras", {})]
    if not palettes or not {"hair", "skin"} <= set(palettes[0]):
        errors.append(f"{name}: no extras.palette with hair + skin")
    if not errors:
        print(f"ok  {name}: {tris} tris")
    return errors


def check_characters():
    errors = []
    for f in CHARACTER_FILES:
        errors += check_character(os.path.join(ASSETS, f))
    return errors


def main(argv):
    only = argv[1:] or None
    errors = []
    if only:
        for f in only:
            errors += check_character(os.path.join(ASSETS, f))
    else:
        errors += check_characters()
    for e in errors:
        print("FAIL", e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
