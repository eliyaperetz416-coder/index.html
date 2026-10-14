"""Draws anime-style face textures with PIL (no Blender needed).

Layout: 512x512 PNG. The face is drawn in the left half (u 0..0.5), centered on the head;
everything else is white, so the vertex colors (skin, clothes) show through unchanged.
Face features are placed in head-relative meters and mapped with FACE_SCALE, the same
mapping characters.py uses for the head's front-projected UVs.
"""
import os
import sys

SIZE = 512
SS = 4                      # supersampling for smooth lines
FACE_W = 0.26               # meters of head width mapped onto u 0..0.5
FACE_H = 0.28               # meters of head height mapped onto v 0..1


def uv_of(dx, dz):
    """Head-relative offset (meters, from the head center) -> texture UV (Blender convention, v up)."""
    return 0.25 + dx / FACE_W * 0.5, 0.5 + dz / FACE_H


def px(dx, dz):
    u, v = uv_of(dx, dz)
    return u * SIZE * SS, (1 - v) * SIZE * SS


def m(meters):
    """Meters -> supersampled pixels (horizontal scale)."""
    return meters / FACE_W * 0.5 * SIZE * SS


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


INK = (34, 22, 20)


def eye(d, cx, cz, side, style, iris):
    """One eye. side = +1 for the character's left (viewer's right)."""
    w, h = 0.036, 0.03 if style != "tired" else 0.02
    x0, y0 = px(cx - w / 2, cz + h / 2)
    x1, y1 = px(cx + w / 2, cz - h / 2)
    # white of the eye + iris + pupil + highlight
    d.ellipse([x0, y0, x1, y1], fill=(250, 248, 244))
    iw = m(0.021 if style == "soft" else 0.018)
    icx, icy = (x0 + x1) / 2, (y0 + y1) / 2 + m(0.002)
    d.ellipse([icx - iw / 2, y0 - m(0.002), icx + iw / 2, y1 + m(0.002)], fill=iris)
    pw = iw * 0.45
    d.ellipse([icx - pw / 2, icy - pw * 0.7, icx + pw / 2, icy + pw * 0.7], fill=(18, 10, 10))
    hl = iw * 0.28
    d.ellipse([icx - iw * 0.32, icy - iw * 0.42, icx - iw * 0.32 + hl, icy - iw * 0.42 + hl], fill=(255, 255, 255))
    # upper lid: thick line; 'sharp' slants down towards the nose
    outer = x1 if side > 0 else x0
    inner = x0 if side > 0 else x1
    slant = m(0.007) if style == "sharp" else 0
    lid = m(0.0045 if style != "tired" else 0.0055)
    d.line([(inner, y0 + slant + lid), ((x0 + x1) / 2, y0 - m(0.002)), (outer, y0 + m(0.004))],
           fill=INK, width=int(lid), joint="curve")
    if style == "tired":                     # heavy lid over the top of the iris
        d.rectangle([x0, y0 - m(0.004), x1, y0 + m(0.006)], fill=(240, 240, 240))
        d.line([(x0, y0 + m(0.006)), (x1, y0 + m(0.006))], fill=INK, width=int(lid))
    # lash flick at the outer corner
    d.line([(outer, y0 + m(0.004)), (outer + side * m(0.008), y0 - m(0.003))], fill=INK, width=int(lid * 0.8))
    # lower lid hint
    d.line([((x0 + x1) / 2 - side * m(0.004), y1), (outer, y1 - m(0.006))], fill=INK, width=int(m(0.0018)))
    if style == "tired":
        d.arc([x0, y1 - m(0.002), x1, y1 + m(0.012)], 20, 160, fill=(150, 120, 110), width=int(m(0.0015)))


def brow(d, cx, cz, side, style, color):
    inner_x, outer_x = cx - side * 0.018, cx + side * 0.02
    if style == "sharp":
        pts = [px(inner_x, cz - 0.004), px(outer_x, cz + 0.006)]
    elif style == "tired":
        pts = [px(inner_x, cz), px(outer_x, cz - 0.002)]
    else:
        pts = [px(inner_x, cz - 0.001), px(cx, cz + 0.004), px(outer_x, cz + 0.001)]
    d.line(pts, fill=color, width=int(m(0.0045)), joint="curve")


def draw_face(eyes, eye_color, glasses, out_png, brow_color="#3a2418"):
    """Draws a face texture and returns its path. eyes: 'sharp' | 'soft' | 'tired'."""
    from PIL import Image, ImageDraw  # imported here so the constants above load without PIL
    img = Image.new("RGB", (SIZE * SS, SIZE * SS), (255, 255, 255))
    d = ImageDraw.Draw(img)
    iris = hex_rgb(eye_color)
    eye_z = -0.004
    for side in (1, -1):
        cx = 0.04 * side
        eye(d, cx, eye_z, side, eyes, iris)
        brow(d, cx, eye_z + 0.032, side, eyes, hex_rgb(brow_color))
    # nose: a small shadow line; mouth: short line
    d.line([px(0.002, -0.032), px(-0.003, -0.042)], fill=(200, 150, 130), width=int(m(0.003)))
    mouth = [px(-0.012, -0.066), px(0.0, -0.068), px(0.012, -0.066)]
    d.line(mouth, fill=(150, 80, 70), width=int(m(0.003)), joint="curve")
    if glasses:
        for side in (1, -1):
            cx = 0.04 * side
            x0, y0 = px(cx - 0.027, eye_z + 0.024)
            x1, y1 = px(cx + 0.027, eye_z - 0.022)
            d.rounded_rectangle([x0, y0, x1, y1], radius=m(0.008), outline=(40, 40, 46), width=int(m(0.003)))
        d.line([px(-0.013, eye_z + 0.008), px(0.013, eye_z + 0.008)], fill=(40, 40, 46), width=int(m(0.003)))
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    img.save(out_png)
    return out_png


if __name__ == "__main__":
    # Draws every character's face into face_textures/ (needs Pillow: pip install pillow).
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import ast
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "characters.py")).read()
    tree = ast.parse(src)
    cast = next(ast.literal_eval(n.value) for n in tree.body
                if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "CHARACTERS")
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_textures")
    os.makedirs(out_dir, exist_ok=True)
    for c in cast:
        print(draw_face(c["eyes"], c["eye_color"], c["glasses"], os.path.join(out_dir, f"face_{c['id']}.png"),
                        brow_color=c["hair"]["color"]))
