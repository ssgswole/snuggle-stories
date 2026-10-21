"""Generate Snuggle Stories app icons (open book + stars on a warm sun background)."""
from PIL import Image, ImageDraw
import math, os
HERE = os.path.dirname(os.path.abspath(__file__))
SUN, SUN_DEEP, CREAM, PAPER, INK, CORAL, GRAPE = "#ffb84d", "#f59e0b", "#fff8ec", "#fffdf8", "#3b2f4a", "#ff7a6b", "#8b6cf0"

def star(d, cx, cy, r, fill, rot=-90):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.45
        a = math.radians(rot + i * 36)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)

def draw(size, maskable=False, rounded=True, k=None):
    S = 4 * size  # supersample
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable or not rounded:
        d.rectangle([0, 0, S, S], fill=SUN)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=SUN)
    # soft glow circle
    d.ellipse([S*0.12, S*0.10, S*0.88, S*0.86], fill="#ffc96e")
    if k is None: k = 0.78 if maskable else 1.0  # keep inside maskable safe zone
    def P(x, y): return (S/2 + (x - 0.5) * S * k, S/2 + (y - 0.5) * S * k)
    w = int(S * 0.025 * k)
    # book pages (two curved-ish quads)
    left = [P(0.50, 0.40), P(0.32, 0.33), P(0.17, 0.36), P(0.17, 0.72), P(0.32, 0.69), P(0.50, 0.76)]
    right = [P(0.50, 0.40), P(0.68, 0.33), P(0.83, 0.36), P(0.83, 0.72), P(0.68, 0.69), P(0.50, 0.76)]
    cover = [P(0.50, 0.44), P(0.14, 0.40), P(0.14, 0.78), P(0.50, 0.82), P(0.86, 0.78), P(0.86, 0.40)]
    d.polygon(cover, fill=CORAL)
    d.polygon(left, fill=PAPER, outline=INK, width=w)
    d.polygon(right, fill=CREAM, outline=INK, width=w)
    d.line([P(0.50, 0.40), P(0.50, 0.76)], fill=INK, width=w)
    # text lines
    for i in range(3):
        y = 0.47 + i * 0.07
        d.line([P(0.24, y - 0.01), P(0.44, y + 0.01)], fill="#e6d8c3", width=int(w * 1.1))
        d.line([P(0.56, y + 0.01), P(0.76, y - 0.01)], fill="#e6d8c3", width=int(w * 1.1))
    # stars
    star(d, *P(0.50, 0.20), S * 0.085 * k, PAPER)
    star(d, *P(0.27, 0.19), S * 0.045 * k, GRAPE)
    star(d, *P(0.74, 0.17), S * 0.05 * k, GRAPE)
    return img.resize((size, size), Image.LANCZOS)

for s in (48, 72, 96, 144, 192, 512):
    draw(s).save(os.path.join(HERE, f"icon-{s}.png"))
for s in (192, 512):
    draw(s, maskable=True).save(os.path.join(HERE, f"maskable-{s}.png"))
draw(180, rounded=False).convert("RGB").save(os.path.join(HERE, "apple-touch-icon.png"))
draw(32).save(os.path.join(HERE, "favicon-32.png"))
# Android launcher icons (written into the Capacitor project if it exists)
RES = os.path.join(HERE, "..", "native", "android", "app", "src", "main", "res")
if os.path.isdir(RES):
    for dens, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        d = os.path.join(RES, "mipmap-" + dens)
        os.makedirs(d, exist_ok=True)
        draw(px).save(os.path.join(d, "ic_launcher.png"))
        rnd = draw(px, maskable=True, k=0.85)
        m = Image.new("L", (px * 4, px * 4), 0); ImageDraw.Draw(m).ellipse([0, 0, px * 4 - 1, px * 4 - 1], fill=255)
        rnd.putalpha(m.resize((px, px), Image.LANCZOS)); rnd.save(os.path.join(d, "ic_launcher_round.png"))
        draw(int(px * 108 / 48), maskable=True, k=0.6).save(os.path.join(d, "ic_launcher_foreground.png"))
draw(1024, maskable=True).convert("RGB").save(os.path.join(HERE, "icon-1024-store.png"))
print("ok")
