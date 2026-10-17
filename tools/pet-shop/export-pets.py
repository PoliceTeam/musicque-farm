"""Add supplied pet families without replacing any approved existing sprite or palette."""
import importlib.util
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('sprite_source', ROOT / 'tools/sprite-source.py')
sprite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sprite)
source = Image.open(ROOT / 'docs/art/pet-shop/pets.png').convert('RGBA')
palette, _ = sprite.parse((sprite.ROOT / 'pets/palette.txt').read_text())
# Reuse the established namespace palette; preserve all existing letters and pixels.
colors = {k: tuple(bytes.fromhex(v[1:])) for k,v in palette.items()}
nearest = {}
def color_key(rgb):
    if rgb not in nearest:
        nearest[rgb] = min(colors, key=lambda k: sum((a-b)**2 for a,b in zip(rgb,colors[k])))
    return nearest[rgb]

def clean(image):
    # Ignore faint atlas edge halos. Keep every opaque body pixel and accessory.
    image.putalpha(image.getchannel('A').point(lambda v: 255 if v >= 170 else 0))
    alpha = image.getchannel('A')
    mask = alpha
    seen, largest = set(), []
    for y in range(image.height):
        for x in range(image.width):
            if (x,y) in seen or not mask.getpixel((x,y)): continue
            stack, points = [(x,y)], []
            seen.add((x,y))
            while stack:
                px,py = stack.pop();points.append((px,py))
                for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
                    if 0<=nx<image.width and 0<=ny<image.height and (nx,ny) not in seen and mask.getpixel((nx,ny)):
                        seen.add((nx,ny));stack.append((nx,ny))
            if len(points)>len(largest): largest=points
    keep=Image.new('L',image.size)
    for point in largest:keep.putpixel(point,255)
    image.putalpha(Image.composite(alpha,Image.new('L',image.size),keep))
    bounds = image.getchannel('A').getbbox()
    if not bounds: raise ValueError('Empty frame')
    return image.crop(bounds)

for entry in json.loads((Path(__file__).parent / 'pets.json').read_text()):
    pieces = {}
    for level, boxes in enumerate(entry['frames'],1):
        top,bottom = entry['row']
        frames = [clean(source.crop((a,top,b,bottom))) for a,b in boxes]
        scale = [30,37,44][level-1] / max(im.height for im in frames)
        width = max(round(im.width*scale) for im in frames)+4
        height = [30,37,44][level-1]+4
        name = 'pet.'+entry['id']+('' if level == 1 else '.'+str(level))
        for i, image in enumerate(frames):
            image = image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.NEAREST)
            frame = Image.new('RGBA',(width,height))
            frame.alpha_composite(image,((width-image.width)//2,height-image.height-2))
            rows = []
            for y in range(height):
                rows.append(''.join('.' if frame.getpixel((x,y))[3] == 0 else color_key(frame.getpixel((x,y))[:3]) for x in range(width)))
            pieces[name+('' if i == 0 else '.walk'+str(i))] = rows
    sprite.write_sheet(sprite.render({},pieces), 'unused', kind='pets', managed_prefixes=['pet.'+entry['id']])
print('Exported 8 new pet families, 3 levels and 3 aligned animation frames each')
