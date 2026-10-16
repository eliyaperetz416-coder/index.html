# Generates PWA icons (neon road + car silhouette) into icons/. Run: python3 tools/make-icons.py
from PIL import Image, ImageDraw, ImageFilter
import os
os.makedirs('icons', exist_ok=True)

def make(size, maskable=False):
    S = size
    img = Image.new('RGB', (S, S), (6, 3, 15))
    d = ImageDraw.Draw(img)
    # sky gradient
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=(int(8 + 60 * t * t), int(3 + 10 * t), int(24 + 70 * t)))
    cx = S / 2; hy = S * 0.42
    # road trapezoid
    d.polygon([(cx - S * 0.03, hy), (cx + S * 0.03, hy), (cx + S * 0.62, S), (cx - S * 0.62, S)], fill=(20, 18, 32))
    glow = Image.new('RGB', (S, S), (0, 0, 0)); g = ImageDraw.Draw(glow)
    g.line([(cx - S * 0.03, hy), (cx - S * 0.62, S)], fill=(0, 229, 255), width=max(3, S // 40))
    g.line([(cx + S * 0.03, hy), (cx + S * 0.62, S)], fill=(255, 46, 154), width=max(3, S // 40))
    # dashes
    for i in range(5):
        t0 = (i + 0.15) / 5; t1 = (i + 0.55) / 5
        f = lambda t: (hy + (S - hy) * (t ** 1.6))
        y0, y1 = f(t0), f(t1)
        w0, w1 = S * 0.004 + S * 0.012 * t0, S * 0.004 + S * 0.012 * t1
        g.polygon([(cx - w0, y0), (cx + w0, y0), (cx + w1, y1), (cx - w1, y1)], fill=(255, 204, 51))
    # car
    cw = S * 0.26; ch = S * 0.13; cy = S * 0.74
    g.rounded_rectangle([cx - cw / 2, cy, cx + cw / 2, cy + ch], radius=S * 0.025, fill=(47, 155, 255))
    g.rounded_rectangle([cx - cw * 0.34, cy - ch * 0.55, cx + cw * 0.34, cy + ch * 0.1], radius=S * 0.02, fill=(20, 60, 110))
    for sx in (-1, 1):
        g.rounded_rectangle([cx + sx * cw * 0.38 - S * 0.03, cy + ch * 0.3, cx + sx * cw * 0.38 + S * 0.03, cy + ch * 0.6], radius=2, fill=(255, 30, 60))
    blur = glow.filter(ImageFilter.GaussianBlur(S * 0.015))
    from PIL import ImageChops
    img = ImageChops.add(img, blur); img = ImageChops.add(img, glow)
    if maskable:
        return img
    # rounded corners for non-maskable
    m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(img, (0, 0), m); return out

for s in (180, 192, 512):
    make(s, s == 180).save(f'icons/icon-{s}.png')   # apple-touch icon must be opaque square (iOS rounds it)
make(512, True).save('icons/icon-maskable-512.png')
print('icons ok')
