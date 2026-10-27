"""One-off media prep for the showcase. Sources live in sibling repos and in
shots/ (screenshots of the live sites); outputs go to media/ and are committed,
so the nightly build never needs them.

    python3 tools/prepare-media.py ~/workspace/meowtal
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
media = root / "media"
shots = root / "shots"
meowtal = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else root.parent / "meowtal"
media.mkdir(exist_ok=True)

def photo(src, dst, box, width):
    im = Image.open(src).convert("RGB").crop(box)
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(media / dst, "JPEG", quality=78, optimize=True, progressive=True)
    print(dst, im.size)

photo(shots / "ballpoint.png", "ballpoint.jpg", (0, 0, 1280, 620), 900)
photo(shots / "meowtal.jpg", "meowtal.jpg", (0, 60, 800, 560), 760)

# The tabby: a loop of moves cut from the game's atlas, every frame set on its
# feet in one fixed cell so the strip plays in place.
atlas = json.loads((meowtal / "assets/fighters/tabby.json").read_text())
pages = [Image.open(meowtal / f"assets/fighters/tabby_{i}.webp").convert("RGBA") for i in range(atlas["pages"])]
seq = ["idle", "jab", "idle", "sspec"]
cell, scale = (300, 250), 0.5
frames = []
for name in seq:
    for f in atlas["anims"][name]:
        x, y, w, h, ax, ay = f[:6]
        page = f[9]
        sprite = pages[page].crop((round(x), round(y), round(x + w), round(y + h)))
        canvas = Image.new("RGBA", cell, (0, 0, 0, 0))
        canvas.alpha_composite(sprite, (round(cell[0] / 2 - ax), round(cell[1] - 6 - ay)))
        frames.append(canvas)
cw, ch = round(cell[0] * scale), round(cell[1] * scale)
strip = Image.new("RGBA", (cw * len(frames), ch), (0, 0, 0, 0))
for i, fr in enumerate(frames):
    strip.alpha_composite(fr.resize((cw, ch), Image.LANCZOS), (i * cw, 0))
strip.save(media / "tabby.webp", "WEBP", quality=80, method=6)
(media / "tabby.json").write_text(json.dumps({"frames": len(frames), "w": cw, "h": ch}) + "\n")
print("tabby.webp", strip.size, len(frames), "frames")

# Glyph Studio's trick, done here: the tabby's portrait as ASCII.
ramp = " .:-=+*#%@"
f = atlas["anims"]["win"][3]
im = pages[f[9]].crop((round(f[0]), round(f[1]), round(f[0] + f[2]), round(f[1] + f[3])))
im.save(media / "tabby-win.webp", "WEBP", quality=85, method=6)
bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
bg.alpha_composite(im)
gray = ImageOps.autocontrast(bg.convert("L"))
cols = 52
rows = round(cols * gray.height / gray.width * 0.5)
small = gray.resize((cols, rows), Image.LANCZOS)
lines = ["".join(ramp[(255 - small.getpixel((c, r))) * (len(ramp) - 1) // 255] for c in range(cols)).rstrip() for r in range(rows)]
(media / "tabby-ascii.txt").write_text("\n".join(lines) + "\n")
print("tabby-ascii.txt", cols, "x", rows)
