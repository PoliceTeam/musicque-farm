"""Animate only masked feather regions of the existing native sprite artwork.

Every frame uses the original canvas and anchor. The cap/crown/jewels are
copied unchanged; folding is an inverse nearest-neighbour projection around
each wing root, with no interpolation or new palette colours.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

CONFIG = json.loads(Path(__file__).with_suffix('.json').read_text())

def animate(name, rows):
    wings = CONFIG['hats'].get(name)
    if not wings:
        return {}, {}
    width, height = len(rows[0]), len(rows)
    masks = []
    for wing in wings:
        mask = Image.new('1', (width, height))
        ImageDraw.Draw(mask).polygon([tuple(p) for p in wing['polygon']], fill=1)
        masks.append(mask)
    body = [[ch if not any(m.getpixel((x,y)) for m in masks) else '.'
             for x,ch in enumerate(row)] for y,row in enumerate(rows)]
    frames = {}
    for index, fold in enumerate(CONFIG['folds'], 1):
        frame = [row[:] for row in body]
        for wing, mask in zip(wings, masks):
            px, py = wing['pivot']
            for y in range(height):
                # Project back into the original feather artwork to avoid holes.
                sy = round(py + (y - py) / fold)
                if not 0 <= sy < height:
                    continue
                for x in range(width):
                    if mask.getpixel((x,sy)) and rows[sy][x] != '.' and body[y][x] == '.':
                        frame[y][x] = rows[sy][x]
        frames[f'.flap{index}'] = [''.join(row) for row in frame]
    return frames, {'frames': CONFIG['frames'], 'frameMs': CONFIG['frameMs']}
