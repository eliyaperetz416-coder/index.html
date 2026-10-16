"""Contact sheet of screenshots: python3 tools/sheet.py out.png img1.png img2.png ... [--cols N] [--w W]"""
import sys
from PIL import Image

args = sys.argv[1:]
cols = 4
w = 240
if "--cols" in args:
    i = args.index("--cols"); cols = int(args[i + 1]); del args[i:i + 2]
if "--w" in args:
    i = args.index("--w"); w = int(args[i + 1]); del args[i:i + 2]
out, files = args[0], args[1:]
ims = [Image.open(f) for f in files]
h = int(w * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, h * rows))
for i, im in enumerate(ims):
    sheet.paste(im.resize((w, h)), ((i % cols) * w, (i // cols) * h))
sheet.save(out)
