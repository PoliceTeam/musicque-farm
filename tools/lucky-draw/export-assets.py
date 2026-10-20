"""Reproduce the supplied wheel UI and generated fairy-wing sprite frames."""
from pathlib import Path
from runpy import run_path
from collections import deque
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / 'source-art'
TARGET = ROOT / 'apps/game/src/assets/lucky-draw'
TARGET.mkdir(parents=True, exist_ok=True)
atlas = Image.open(SOURCE / 'wheel-atlas.png').convert('RGBA')

def silhouette(image):
    width, height = image.size
    alpha = bytearray(image.getchannel('A').point(lambda a: a if a >= 140 else 0).tobytes())
    todo = bytearray(bool(a) for a in alpha)
    largest = []
    for i in range(len(todo)):
        if not todo[i]: continue
        queue, group = deque([i]), []
        todo[i] = 0
        while queue:
            j = queue.popleft()
            group.append(j)
            x, y = j % width, j // width
            for yy in range(max(0, y - 1), min(height, y + 2)):
                for xx in range(max(0, x - 1), min(width, x + 2)):
                    k = yy * width + xx
                    if todo[k]:
                        todo[k] = 0
                        queue.append(k)
        if len(group) > len(largest): largest = group
    cleaned = bytearray(len(alpha))
    for i in largest: cleaned[i] = alpha[i]
    image.putalpha(Image.frombytes('L', image.size, bytes(cleaned)))
    return image.crop(image.getbbox())

for key, box in {'wheel': (513, 56, 977, 525), 'pointer': (1405, 9, 1536, 153)}.items():
    silhouette(atlas.crop(box)).save(TARGET / f'{key}.webp', lossless=True, exact=True)

art = Image.open(SOURCE / 'pixie-wings-v1.png').convert('RGBA')
art.putalpha(art.getchannel('A').point(lambda a: 0 if a < 120 else a))
art = art.crop(art.getbbox())
art.save(TARGET / 'pixie-wings.webp', lossless=True, exact=True)
base = art.resize((88, 54), Image.Resampling.LANCZOS)
colors = base.convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT)
palette = colors.getpalette()
letters = [chr(0xE300 + i) for i in range(64)]
entries = {letters[i]: '#%02x%02x%02x' % tuple(palette[i*3:i*3+3]) for i in range(64)}
pieces = {}
for frame, factor in enumerate([1, .87, .72, .87]):
    image = Image.new('RGBA', (88, 54))
    scaled = base.resize((round(88 * factor), 54), Image.Resampling.NEAREST)
    image.paste(scaled, ((88 - scaled.width)//2, 0))
    indexed = image.convert('RGB').quantize(palette=colors, dither=Image.Dither.NONE)
    rows = [''.join(letters[indexed.getpixel((x,y))] if image.getpixel((x,y))[3] >= 100 else '.' for x in range(88)) for y in range(54)]
    pieces['wings.pixie' + (f'.f{frame}' if frame else '')] = rows
helper = run_path(str(ROOT / 'tools/sprite-source.py'))
helper['write_sheet'](helper['render'](entries, pieces), 'pixie-wings', managed_prefixes=['wings.pixie'])
