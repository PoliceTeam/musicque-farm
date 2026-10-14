"""Export the cap atlas into native hat sprites. Run in game; requires Pillow."""
from pathlib import Path
from PIL import Image
import json, re
from flaps import animate

ROOT = Path(__file__).resolve().parents[2]
import sys, importlib
sys.path.insert(0, str(ROOT / 'tools'))
sprite_source = importlib.import_module('sprite-source')
atlas = Image.open(ROOT / 'docs/art/cap-atlas-v1.png').convert('RGBA')
palette = {}
pieces = {}
definitions = []
for level, height in [(1, 26), (2, 26), (3, 30)]:
    cell = atlas.crop(((level-1)*atlas.width//3, 0, level*atlas.width//3, atlas.height))
    cell = cell.crop(cell.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox())
    native = cell.resize((50, height), Image.Resampling.BOX)
    # Keep each material's actual source shades instead of replacing with a tiny fixed palette.
    indexed = native.convert('RGB').quantize(colors=32, dither=Image.Dither.NONE)
    colours = indexed.getpalette()
    chars = [chr(0xe200 + (level-1)*32 + i) for i in range(32)]
    for i, ch in enumerate(chars):
        palette[ch] = '#'+bytes(colours[i*3:i*3+3]).hex()
    grid = [''.join(chars[indexed.getpixel((x,y))] if native.getpixel((x,y))[3] >= 128 else '.'
                    for x in range(50)) for y in range(height)]
    # The original bill projects to the right. Compress only its last 12 columns
    # in the lowest seven rows by 3px; preserve the dome, badge and feather artwork.
    for y in range(height-7, height):
        row = grid[y]
        tip = ''.join(row[x] for x in [38, 39, 41, 42, 43, 45, 46, 48, 49])
        grid[y] = row[:38] + tip + '...'
    animation, settings = animate(f'hat.cap.{level}', grid)
    for extra in (0, 2, 4, 6):
        name = f'hat.cap.{level}' + (f'.w{extra}' if extra else '')
        # Widen the dome only; the bill remains the same length.
        columns = {round(15+i*19/max(1,extra-1)) for i in range(extra)}
        pieces[name] = [''.join(ch*(2 if x in columns else 1) for x,ch in enumerate(row)) for row in grid]
        for suffix, rows in animation.items():
            pieces[name + suffix] = [''.join(ch*(2 if x in columns else 1) for x,ch in enumerate(row)) for row in rows]
        dx, dy = -24-extra//2, -44-height
        item = {'id': name, 'label': f'Mũ lưỡi trai Lv.{level}', 'slot': 'hat', 'layer': 55,
                'hairBelow': height-5,
                'poses': {str(p): [name, dx, dy+(1 if p else 0)] for p in range(4)}}
        item.update(settings)
        if level == 3: item['effect'] = 'crystal'
        if extra: item['hidden'] = True
        else: item.update(family='hat.cap', level=level)
        definitions.append(item)

text = '@palette\n'+'\n'.join(f'{ch} {c}' for ch,c in palette.items())+'\n\n'
text += '\n\n'.join('@piece '+name+'\n'+'\n'.join(rows) for name,rows in pieces.items())+'\n'
sprite_source.write_sheet(text, 'hats')
path = ROOT/'packages/character-core/src/data/items.json'
text = path.read_text()
# Preserve formatting of existing items and update only managed cap definitions.
text = re.sub(r'^  \{"id": "hat\.cap\.[^\n]+\n', '', text, flags=re.M)
text = re.sub(r',(\s*\n \]\s*\n\})', r'\1', text)
new = ',\n'.join('  '+json.dumps(item, ensure_ascii=False) for item in definitions)
text = re.sub(r'(\n \]\s*\n\})', lambda m: ',\n'+new+m[1], text)
json.loads(text)
if path.read_text() != text: path.write_text(text)
print('Exported 3 caps, each with 4 face widths.')
