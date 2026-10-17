"""Deterministic modular furniture exports from the supplied transparent atlas."""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
source = Image.open(ROOT / 'docs/art/pet-shop/atlas.png').convert('RGBA')
output = ROOT / 'apps/game/src/assets/pet-shop'
output.mkdir(parents=True, exist_ok=True)
for entry in json.loads((Path(__file__).parent / 'assets.json').read_text()):
    module_source = source if 'source' not in entry else Image.open(ROOT / 'docs/art/pet-shop' / entry['source']).convert('RGBA')
    image = module_source.crop(entry['box'])
    if entry.get('maskRects'):
        # Keep each populated display as its own reusable prop. Remove only the
        # room pixels outside the cage silhouette and its raised door handles.
        mask = Image.new('L', image.size)
        draw = ImageDraw.Draw(mask)
        ox, oy = entry['box'][:2]
        for x0,y0,x1,y1 in entry['maskRects']:
            draw.rectangle((x0-ox,y0-oy,x1-ox-1,y1-oy-1), fill=255)
        image.putalpha(mask)
    if entry.get('counter'):
        # The tabletop accessories are separate modules. Restore the unobstructed
        # tabletop from its own clean wood pixels; do not bake them into furniture.
        wood = source.crop((859, 222, 930, 265))
        for x in range(0, image.width, wood.width):
            image.paste(wood.crop((0, 0, min(wood.width, image.width-x), wood.height)), (x, 0))
    if not entry.get('tile'):
        bounds = image.getchannel('A').getbbox()
        if not bounds: raise ValueError(entry['key'])
        image = image.crop(bounds)
        padded = Image.new('RGBA', (image.width+8, image.height+8))
        padded.alpha_composite(image, (4,4))
        image = padded
    image.save(output / (entry['key'] + '.webp'), lossless=True, exact=True)
print('Exported pet shop furniture modules')
