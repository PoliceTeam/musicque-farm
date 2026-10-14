"""Extract the supplied animal artwork without redrawing it.

Alpha cutoff removes the reference sheet's coloured near-transparent halos.
Coordinates are reviewed per sprite in farm-animal-slices.json.
"""
import json
from pathlib import Path
from collections import deque
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'docs/art/farm-animal-reference-v1.png').convert('RGBA')
config = json.loads((ROOT / 'tools/farm-animal-slices.json').read_text())
out = ROOT / 'tools/.farm-export/extracted-v20'
out.mkdir(parents=True, exist_ok=True)
for species, groups in config.items():
    for action, rects in groups.items():
        for index, rect in enumerate(rects):
            tile = source.crop(rect)
            px = tile.load()
            for y in range(tile.height):
                for x in range(tile.width):
                    r, g, b, a = px[x, y]
                    px[x, y] = (r, g, b, 255) if a >= 160 else (0, 0, 0, 0)
            # Remove detached label/halo specks while keeping the artwork's main body.
            seen, parts = set(), []
            for y in range(tile.height):
                for x in range(tile.width):
                    if (x, y) in seen or not px[x, y][3]:
                        continue
                    queue, part = deque([(x, y)]), []
                    seen.add((x, y))
                    while queue:
                        a, b = queue.popleft()
                        part.append((a, b))
                        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                            n = (a+dx,b+dy)
                            if 0 <= n[0] < tile.width and 0 <= n[1] < tile.height and n not in seen and px[n[0],n[1]][3]:
                                seen.add(n)
                                queue.append(n)
                    parts.append(part)
            largest = max(parts, key=len)
            for part in parts:
                if part is not largest:
                    for x, y in part:
                        px[x, y] = (0,0,0,0)
            # The cow row has neighbouring muzzles overlapping the next animal's tail.
            # Remove only these recorded overlap corners, preserving the current body.
            overlaps = {('cow', 'walk', 4): (9, 47, 'top'),
                        ('cow', 'walk', 5): (10, 47, 'top'),
                        ('cow', 'eat', 1): (14, 36, 'bottom')}
            corner = overlaps.get((species, action, index))
            if corner:
                width, boundary, side = corner
                for y in range(tile.height):
                    if (side == 'top' and y < boundary) or (side == 'bottom' and y >= boundary):
                        for x in range(min(width, tile.width)):
                            px[x, y] = (0,0,0,0)
            bbox = tile.getchannel('A').getbbox()
            if bbox is None:
                raise ValueError(f'Empty sprite: {species}-{action}-{index}')
            tile.crop(bbox).save(out / f'{species}-{action}-{index}.png')
