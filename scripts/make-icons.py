# Generates simple app icons (a sticker sheet with a peeling corner). Requires Pillow.
# Run from the project root: python3 scripts/make-icons.py
from PIL import Image, ImageDraw
for size in (192, 512):
    im = Image.new("RGB", (size, size), "#f2a65a")
    d = ImageDraw.Draw(im)
    m = size // 6
    d.rounded_rectangle([m, m, size - m, size - m], radius=size // 12, fill="#fffaf3")
    r = size // 9
    for cx, cy in [(size * .38, size * .4), (size * .62, size * .4), (size * .5, size * .64)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill="#f2a65a")
    c = size // 4
    d.polygon([(size - m - c, size - m), (size - m, size - m - c), (size - m, size - m)], fill="#e08a3c")
    im.save(f"public/icon-{size}.png")
