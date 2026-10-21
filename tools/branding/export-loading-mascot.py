"""Export existing ginger-cat walk pixels as a lightweight loading animation; no art changes."""
import importlib.util
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('sprite_source', ROOT / 'tools/sprite-source.py')
sprite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sprite)
palette, _ = sprite.parse((sprite.ROOT / 'pets/palette.txt').read_text())
_, pieces = sprite.parse((sprite.ROOT / 'pets/ginger-cat/sprites.txt').read_text())
frames = []
for name in ['pet.ginger-cat.walk1', 'pet.ginger-cat', 'pet.ginger-cat.walk2', 'pet.ginger-cat']:
    rows = pieces[name]
    image = Image.new('RGBA', (len(rows[0]), len(rows)))
    for y, row in enumerate(rows):
        for x, pixel in enumerate(row):
            if pixel != '.': image.putpixel((x, y), tuple(bytes.fromhex(palette[pixel][1:])) + (255,))
    frames.append(image)
out = ROOT / 'apps/game/public/branding'
out.mkdir(parents=True, exist_ok=True)
frames[0].save(out / 'loading-cat.webp', save_all=True, append_images=frames[1:], duration=140, loop=0, lossless=True)
frames[0].save(out / 'loading-cat-still.webp', lossless=True)
