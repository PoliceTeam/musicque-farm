"""Derive new handheld sprites from supplied pixels, retaining all approved artwork."""
import importlib.util,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('sprite_source',ROOT/'tools/sprite-source.py')
sprite=importlib.util.module_from_spec(spec);spec.loader.exec_module(sprite)
source=Image.open(ROOT/'docs/art/held-shop/atlas.png').convert('RGBA')
entries=json.loads((Path(__file__).parent/'items.json').read_text())
metadata=[]
for i,entry in enumerate(entries):
    image=source.crop(entry['box'])
    image.putalpha(image.getchannel('A').point(lambda a:255 if a>=180 else 0))
    # Keep the main connected object; remove detached atlas background fragments.
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
    image.putalpha(mask);image=image.crop(mask.getbbox())
    image=image.resize((round(image.width*entry['height']/image.height),entry['height']),Image.Resampling.NEAREST)
    # Tip the object away from the face while keeping its grip on the near hand.
    grip_x=round(image.width*entry['grip'][0]);grip_y=round(image.height*entry['grip'][1])
    canvas=Image.new('RGBA',(200,200));canvas.alpha_composite(image,(100-grip_x,100-grip_y))
    canvas=canvas.rotate(entry.get('angle',0),resample=Image.Resampling.NEAREST,center=(100,100))
    bounds=canvas.getchannel('A').getbbox();image=canvas.crop(bounds)
    grip_x,grip_y=100-bounds[0],100-bounds[1]
    alpha=image.getchannel('A');quantized=image.convert('RGB').quantize(colors=48,dither=Image.Dither.NONE)
    rgb=quantized.convert('RGB');palette={};rows=[]
    for y in range(image.height):
        row=''
        for x in range(image.width):
            if not alpha.getpixel((x,y)):row+='.';continue
            color='#%02x%02x%02x'%rgb.getpixel((x,y))
            if color not in palette:palette[color]=chr(0xf200+i*64+len(palette))
            row+=palette[color]
        rows.append(row)
    name='held.'+entry['id']
    path=sprite.ROOT/'accessories/held'/entry['id']/'sprites.txt';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(sprite.render({letter:color for color,letter in palette.items()},{name:rows}))
    dx=9-grip_x;dy=-15-grip_y
    metadata.append({'id':name,'label':entry['label'],'slot':'held','layer':35,'poses':{'0':[name,dx,dy]}})
# Only append/update this exporter's items. Preserve all existing metadata and its layout.
path=ROOT/'packages/character-core/src/data/items.json'
text=path.read_text();data=json.loads(text)
managed={item['id']:item for item in metadata}
lines=[]
for line in text.splitlines():
    try:item=json.loads(line.strip().rstrip(','))
    except (ValueError,TypeError):item=None
    if isinstance(item,dict) and item.get('id') in managed:
        line='  '+json.dumps(managed.pop(item['id']),ensure_ascii=False)+(',' if line.rstrip().endswith(',') else '')
    lines.append(line)
text='\n'.join(lines)+'\n'
if managed:
    end=text.rfind(']');head=text[:end].rstrip()
    text=head+',\n'+',\n'.join('  '+json.dumps(item,ensure_ascii=False) for item in managed.values())+'\n '+text[end:]
path.write_text(text)
print('Exported 8 handheld items with a fixed hand grip')
