"""Cut the v9 crop growth atlas into per-stage sprites.

Each frame is the union box of its sprite components; only components lying fully inside
that box are kept, so overlapping neighbours stay out. The atlas has a soft coloured glow
around every sprite: alpha below the cutoff is dropped and the rest is restretched.
"""
import json
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'docs/art/farm-v9-crops-atlas.png').convert('RGBA')
config = json.loads((ROOT / 'tools/farm-v9-crop-slices.json').read_text())
out = ROOT / 'tools/.farm-export/extracted-v9'
out.mkdir(parents=True, exist_ok=True)
for old in out.glob('*.png'):
    old.unlink()
ALPHA_CUTOFF = 128
MARGIN = 6


def cut(rect):
    x0, y0, x1, y1 = rect
    box = (max(0, x0 - MARGIN), max(0, y0 - MARGIN), min(source.width, x1 + MARGIN), min(source.height, y1 + MARGIN))
    tile = source.crop(box)
    w, h = tile.size
    px = tile.load()
    solid = [[px[x, y][3] >= ALPHA_CUTOFF for x in range(w)] for y in range(h)]
    keep = [[False] * w for _ in range(h)]
    seen = [[False] * w for _ in range(h)]
    inner = (x0 - box[0], y0 - box[1], x1 - box[0], y1 - box[1])
    for sy in range(h):
        for sx in range(w):
            if not solid[sy][sx] or seen[sy][sx]:
                continue
            seen[sy][sx] = True
            queue, comp = deque([(sx, sy)]), []
            while queue:
                x, y = queue.popleft()
                comp.append((x, y))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and solid[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            queue.append((nx, ny))
            inside = all(inner[0] <= x < inner[2] and inner[1] <= y < inner[3] for x, y in comp)
            if inside and len(comp) >= 30:
                for x, y in comp:
                    keep[y][x] = True
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if keep[y][x]:
                px[x, y] = (r, g, b, min(255, (a - ALPHA_CUTOFF) * 255 // (255 - ALPHA_CUTOFF) + 64))
            else:
                px[x, y] = (0, 0, 0, 0)
    return tile.crop(tile.getchannel('A').getbbox())


for crop_id, frames in config.items():
    for index, rect in enumerate(frames):
        cut(rect).save(out / f'{crop_id}-{index}.png')
