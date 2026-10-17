"""Extract the supplied NPC role bank, retaining the full source sheet for future poses."""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
source=Image.open(ROOT/'docs/art/shop-npcs/atlas.png').convert('RGBA')
output=ROOT/'apps/game/src/assets/common/shop-npcs';output.mkdir(parents=True,exist_ok=True)
for entry in json.loads((Path(__file__).parent/'assets.json').read_text()):
    image=source.crop(entry['box']);alpha=image.getchannel('A').point(lambda v:255 if v>=190 else 0)
    seen=set();largest=[]
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
    for pt in largest:mask.putpixel(pt,255)
    image.putalpha(mask);image=image.crop(mask.getbbox())
    # One common foot anchor and canvas, preserving aspect ratio for all roles.
    image.thumbnail((86,118),Image.Resampling.LANCZOS)
    framed=Image.new('RGBA',(100,130));framed.alpha_composite(image,((100-image.width)//2,126-image.height))
    framed.save(output/(entry['key']+'.webp'),lossless=True,exact=True)
print('Exported 20 NPC roles with aligned feet')
