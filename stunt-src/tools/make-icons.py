"""Draws the app icons (original art: a neon loop with a car shooting through it).
Run: python3 tools/make-icons.py  (needs Pillow). Writes public/icons/*.png."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
S = 1024  # draw big, scale down


def gradient(size, top, bottom):
    img = Image.new("RGB", (size, size), top)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)
    return img


def glow_layer(draw_fn, blur):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    return layer.filter(ImageFilter.GaussianBlur(blur)), layer


def art(scale=1.0):
    img = gradient(S, (40, 6, 82), (8, 2, 24)).convert("RGBA")
    c = S / 2
    r = 300 * scale
    w = int(54 * scale)

    def ring(d):
        d.ellipse([c - r, c - r - 40 * scale, c + r, c + r - 40 * scale], outline=(255, 43, 214, 255), width=w)

    def road(d):
        # Perspective road through the loop.
        d.polygon([(c - 380 * scale, S), (c + 380 * scale, S), (c + 70 * scale, c + 230 * scale), (c - 70 * scale, c + 230 * scale)], fill=(26, 20, 52, 255))
        d.line([(c - 380 * scale, S), (c - 70 * scale, c + 230 * scale)], fill=(0, 240, 255, 255), width=int(16 * scale))
        d.line([(c + 380 * scale, S), (c + 70 * scale, c + 230 * scale)], fill=(0, 240, 255, 255), width=int(16 * scale))

    def car(d):
        # Wedge car from behind, flying up through the loop.
        cx, cy = c, c + 60 * scale
        k = scale
        d.polygon([(cx - 170 * k, cy + 70 * k), (cx + 170 * k, cy + 70 * k), (cx + 130 * k, cy - 10 * k), (cx - 130 * k, cy - 10 * k)], fill=(255, 212, 0, 255))
        d.polygon([(cx - 95 * k, cy - 10 * k), (cx + 95 * k, cy - 10 * k), (cx + 60 * k, cy - 70 * k), (cx - 60 * k, cy - 70 * k)], fill=(20, 12, 40, 255))
        d.rectangle([cx - 150 * k, cy + 20 * k, cx - 80 * k, cy + 42 * k], fill=(255, 40, 70, 255))
        d.rectangle([cx + 80 * k, cy + 20 * k, cx + 150 * k, cy + 42 * k], fill=(255, 40, 70, 255))
        d.rectangle([cx - 180 * k, cy + 70 * k, cx - 120 * k, cy + 120 * k], fill=(15, 15, 20, 255))
        d.rectangle([cx + 120 * k, cy + 70 * k, cx + 180 * k, cy + 120 * k], fill=(15, 15, 20, 255))

    for fn, blur in ((road, 0), (ring, 30), (car, 18)):
        g, sharp = glow_layer(fn, blur)
        if blur:
            img = Image.alpha_composite(img, g)
            img = Image.alpha_composite(img, g)
        img = Image.alpha_composite(img, sharp)
    return img


full = art(1.0)
safe = art(0.78)  # maskable icons are cropped to a circle: keep the art inside the safe zone
for name, img, size in (
    ("icon-192.png", full, 192),
    ("icon-512.png", full, 512),
    ("icon-maskable-512.png", safe, 512),
    ("apple-touch-icon.png", full, 180),
):
    img.convert("RGB").resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print("wrote", OUT / name)
