"""Export separately reusable furniture from the user-supplied handheld shop artwork."""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
output = ROOT / 'apps/game/src/assets/held-shop'
output.mkdir(parents=True,exist_ok=True)
for entry in json.loads((Path(__file__).parent/'assets.json').read_text()):
    source = Image.open(ROOT / 'docs/art/held-shop' / entry.get('source','atlas.png')).convert('RGBA')
    image = source.crop(entry['box'])
    if entry.get('counter'):
        # Extend the clean desktop using wood from this same counter. Accessories
        # remain independently placed assets rather than part of the furniture.
        wood = source.crop((250,210,310,260))
        joined = Image.new('RGBA',(image.width,image.height+38))
        for x in range(0,image.width,wood.width):
            joined.paste(wood.crop((0,0,min(wood.width,image.width-x),38)),(x,0))
        joined.alpha_composite(image,(0,38)); image=joined
    if not entry.get('tile'):
        image.putalpha(image.getchannel('A').point(lambda v: 255 if v >= 180 else 0))
        if entry.get('largestComponent'):
            alpha=image.getchannel('A');seen=set();largest=[]
            for y in range(image.height):
                for x in range(image.width):
                    if (x,y) in seen or not alpha.getpixel((x,y)):continue
                    stack=[(x,y)];seen.add((x,y));points=[]
                    while stack:
                        px,py=stack.pop();points.append((px,py))
                        for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
                            if 0<=nx<image.width and 0<=ny<image.height and (nx,ny) not in seen and alpha.getpixel((nx,ny)):
                                seen.add((nx,ny));stack.append((nx,ny))
                    if len(points)>len(largest):largest=points
            mask=Image.new('L',image.size)
            for point in largest:mask.putpixel(point,255)
            image.putalpha(mask)
        bounds=image.getchannel('A').getbbox()
        if not bounds:raise ValueError(entry['key'])
        image=image.crop(bounds)
        padded=Image.new('RGBA',(image.width+8,image.height+8));padded.alpha_composite(image,(4,4));image=padded
    image.save(output/(entry['key']+'.webp'),lossless=True,exact=True)
print('Exported handheld shop furniture')
