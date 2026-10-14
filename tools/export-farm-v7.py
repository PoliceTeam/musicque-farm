"""Deterministic grid slicing and alpha trim. Preserve source pixel artwork."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
im = Image.open(ROOT / 'docs/art/farm-v7-baby-atlas.png').convert('RGBA')
out = ROOT / 'tools/.farm-export/extracted-v7'
out.mkdir(parents=True, exist_ok=True)
for i, name in enumerate(['calf-v7', 'piglet-v7', 'lamb-v7', 'duckling-v7']):
    x, y = (i % 2) * 768, (i // 2) * 512
    crop = im.crop((x,y,x+768,y+512))
    box = crop.getchannel('A').point(lambda alpha: 255 if alpha > 16 else 0).getbbox()
    crop.crop(box).save(out / f'{name}.png')
