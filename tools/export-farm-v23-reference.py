"""Extract user-supplied dessert and starfruit artwork using saved bounds."""
import json
from collections import deque
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT / 'tools/farm-v23-reference-slices.json').read_text())
out = ROOT / 'tools/.farm-export/extracted-v23'
out.mkdir(parents=True, exist_ok=True)
for sheet in config:
    source = Image.open(ROOT / 'docs/art' / sheet['source']).convert('RGBA')
    for name, rect in sheet['frames'].items():
        tile = source.crop(rect)
        px = tile.load()
        seen, parts = set(), []
        for y in range(tile.height):
            for x in range(tile.width):
                if (x,y) in seen or px[x,y][3] < 160:
                    continue
                q, part = deque([(x,y)]), []
                seen.add((x,y))
                while q:
                    a,b = q.popleft()
                    part.append((a,b))
                    for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                        n=(a+dx,b+dy)
                        if 0<=n[0]<tile.width and 0<=n[1]<tile.height and n not in seen and px[n[0],n[1]][3]>=160:
                            seen.add(n)
                            q.append(n)
                parts.append(part)
        keep = set(max(parts, key=len))
        for y in range(tile.height):
            for x in range(tile.width):
                r,g,b,a=px[x,y]
                px[x,y]=(r,g,b,255) if (x,y) in keep else (0,0,0,0)
        bbox=tile.getchannel('A').getbbox()
        if not bbox:
            raise ValueError(f'Empty asset: {name}')
        tile.crop(bbox).save(out / f'{name}.png')
