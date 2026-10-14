"""Build editable, recolourable native hair grids from the checked-in raster atlas.
Run from repository root with Python + Pillow: python3 tools/hair3/build.py.
The image is art source only; the game loads item-grouped sprite sources, without a PNG dependency.
"""
from pathlib import Path
import json, re
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
import sys, importlib
sys.path.insert(0, str(ROOT / 'tools'))
sprite_source = importlib.import_module('sprite-source')
ASSETS = ROOT / 'apps/game/src/assets'
text = sprite_source.read_sheet()
items = {i['id']: i for i in json.loads((ROOT/'packages/character-core/src/data/items.json').read_text())['items']}
sections = {m[0]: m[1].splitlines() for m in re.findall(r'@piece ([^\n]+)\n([^@]+)', text) }
sections = {k: [r for r in v if r and not r.startswith('#')] for k,v in sections.items()}
DEFAULT_ATLAS = 'docs/art/male-hair-atlas-v2.png'
# Native top offsets remain compatible with the existing pose table.
specs = json.loads((Path(__file__).parent/'styles.json').read_text())
# Five source tones, sampled from broad painted clusters. Outline is generated from
# alpha at native size, not from every dark source strand.
tones = [(44,22,25),(82,42,35),(128,68,44),(174,100,57),(226,153,88)]
letters = 'IhHGL'
for spec in specs:
    source_tones = spec.get('tones', tones)
    name = spec['id']
    col,row = spec['cell']
    atlas = Image.open(ROOT/spec.get('atlas', DEFAULT_ATLAS)).convert('RGBA')
    w,h = atlas.size
    cols,rows = spec.get('grid', [2,2])
    if not (0 <= col < cols and 0 <= row < rows):
        raise ValueError(f'{name}: cell is outside atlas grid')
    height = spec['height']
    width = spec.get('width', 48)
    for piece in [name, *(f'{name}.w{w}' for w in (2,4,6))]:
        if piece not in items or piece not in sections:
            raise ValueError(f'{piece}: add its item and sprite section before building')
    crop = atlas.crop((col*w//cols,row*h//rows,(col+1)*w//cols,(row+1)*h//rows))
    crop = crop.crop(crop.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox())
    if spec.get('cluster_sample'):
        # Classify before reducing, so a thin highlight/dark strand is not averaged
        # into the same midtone as the large lock around it.
        labels=[]
        for r,g,b,a in list(crop.getdata()):
            labels.append(-1 if a<128 else min(range(5),key=lambda i:sum((v-t)**2 for v,t in zip((r,g,b),source_tones[i]))))
        coverage=[]
        for tone in range(5):
            mask=Image.new('L',crop.size)
            mask.putdata([255 if label==tone else 0 for label in labels])
            coverage.append(mask.resize((width,height),Image.Resampling.BOX))
        alpha=crop.getchannel('A').resize((width,height),Image.Resampling.BOX)
        reduced=Image.new('RGBA',(width,height))
        for y in range(height):
            for x in range(width):
                weights=[mask.getpixel((x,y)) for mask in coverage]
                tone=max(range(5),key=lambda i:weights[i])
                if tone>=2 and weights[0]>=64: tone=0
                elif tone==3 and weights[4]>=64: tone=4
                reduced.putpixel((x,y),(*source_tones[tone],alpha.getpixel((x,y))))
        crop=reduced
    else:
        crop=crop.resize((width,height),Image.Resampling.BOX)
    source_mask=[[crop.getpixel((x,y))[3]>=128 for x in range(width)] for y in range(height)]
    grid = [['.']*width for _ in range(height)]
    dx,dy = items[name]['poses']['0'][1:]
    for y in range(height):
        for x in range(width):
            r,g,b,a = crop.getpixel((x,y))
            # Leave the near ear exposed; the atlas' decorative lower wisps are
            # outside the skull and must not become a hanging curl.
            if a < 128 or dy+y > -39: continue
            # A broad fan must taper into the near temple instead of leaving a bar over the ear.
            if 'back_lower_y' in spec and dy+y >= spec['back_lower_y'] and dx+x < spec['back_lower_x']: continue
            # A slick undercut ends beside the ear, not over the near eyelash.
            if 'temple_end_y' in spec and dy+y > spec['temple_end_y'] and dx+x > spec['temple_front_x']: continue
            grid[y][x] = letters[min(range(5),key=lambda i:sum((v-t)**2 for v,t in zip((r,g,b),source_tones[i])))]
    if spec.get('long_back'):
        back=[]
        for y in range(height):
            row=[]
            for x in range(width):
                red,green,blue,alpha=crop.getpixel((x,y))
                ch='.' if alpha<128 or dy+y < -46 else letters[min(range(5),key=lambda i:sum((v-t)**2 for v,t in zip((red,green,blue),source_tones[i])))]
                row.append(ch)
            back.append(''.join(row))
        mask=[row[:] for row in back]
        back=[''.join('K' if c!='.' and any(not(0<=xx<width and 0<=yy<height) or not source_mask[yy][xx] for xx,yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1))) else c for x,c in enumerate(row)) for y,row in enumerate(back)]
        for extra in (0,2,4,6):
            columns={round(round(width*.31)+i*round(width*.38)/(extra-1)) for i in range(extra)} if extra else set()
            rows=[''.join(c*(2 if x in columns else 1) for x,c in enumerate(row)) for row in back]
            pid=name+'.back'+(f'.w{extra}' if extra else '')
            text=re.sub(r'(@piece '+re.escape(pid)+r'\n)[^@]+',lambda m:m[1]+'\n'.join(rows)+'\n\n',text)
    # Rebalance crown volume without moving the hairline or temple attachment.
    # Shift fades to zero before the forehead; all locks keep their source colours.
    if spec.get('crown_shift_x'):
        for y,row in enumerate(grid):
            strength = min(1, max(0, (spec['crown_until'] - (dy+y)) / 12))
            shift = round(spec['crown_shift_x'] * strength)
            grid[y] = [row[x-shift] if 0 <= x-shift < width else '.' for x in range(width)]
    # Keep only the connected hair silhouette; alpha can contain tiny loose specks.
    remaining={(x,y) for y in range(height) for x in range(width) if grid[y][x]!='.'}
    components=[]
    while remaining:
        stack=[remaining.pop()]; component=set(stack)
        while stack:
            x,y=stack.pop()
            for p in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if p in remaining: remaining.remove(p);component.add(p);stack.append(p)
        components.append(component)
    keep=max(components,key=len)
    for y in range(height):
        for x in range(width):
            if (x,y) not in keep:grid[y][x]='.'
    # Cover the bald scalp using the closest existing strand shade. No flat dark patch.
    hd,hx,hy = items['head']['poses']['0']
    for j,r in enumerate(sections[hd]):
        for i,ch in enumerate(r):
            x,y=hx+i-dx,hy+j-dy
            if ch=='.' or hy+j >= spec['scalp_until'] or not (0<=x<width and 0<=y<height): continue
            if grid[y][x]=='.':
                nearby=[(abs(xx-x)+abs(yy-y),grid[yy][xx]) for yy in range(height) for xx in range(width) if grid[yy][xx]!='.']
                grid[y][x]=min(nearby)[1]
    # Exact eye footprint must remain unobscured, including upper eyelashes.
    en,ex,ey=items['eyes.big']['poses']['0']
    for j,r in enumerate(sections[en]):
        for i,ch in enumerate(r):
            x,y=ex+i-dx,ey+j-dy
            if ch!='.' and 0<=x<width and 0<=y<height:grid[y][x]='.'
    grids={name:[''.join(r) for r in grid]}
    # Spread added width across the crown, preserving both side contours.
    for extra in (2,4,6):
        columns={round(round(width*.31)+i*round(width*.38)/(extra-1)) for i in range(extra)}
        grids[f'{name}.w{extra}']=[''.join(c*(2 if x in columns else 1) for x,c in enumerate(r)) for r in grids[name]]
    for piece,rows in grids.items():
        # The transparent ear opening in the atlas is larger than the game skull.
        # Seal only the strips OUTSIDE skin between the temple and hair contour;
        # retain the actual forehead opening and the approved outer silhouette.
        extra = int(piece.rsplit('.w',1)[1]) if '.w' in piece else 0
        face = {0:'head',2:'face.baby',4:'face.chubby',6:'face.wide'}[extra]
        fn,fx,fy = items[face]['poses']['0']
        _,px,py = items[piece]['poses']['0']
        native = [list(r) for r in rows]
        columns={round(round(width*.31)+i*round(width*.38)/(extra-1)) for i in range(extra)} if extra else set()
        whole_mask=[[v for x,v in enumerate(row) for _ in range(2 if x in columns else 1)] for row in source_mask]
        for y,r in enumerate(native):
            world_y = py+y
            if not spec['scalp_until'] <= world_y <= -39: continue
            head_row = sections[fn][world_y-fy] if 0 <= world_y-fy < len(sections[fn]) else ''
            skin = [fx+x-px for x,c in enumerate(head_row) if c!='.']
            hair = [x for x,c in enumerate(r) if c!='.']
            if not skin or not hair:continue
            for x in range(max(0,min(skin+hair)),min(len(r)-1,max(skin+hair))+1):
                if x not in skin and r[x]=='.':r[x]='I'
        # Outline after attachment, so the sealed gap has one continuous edge.
        mask=[r[:] for r in native]
        for y,r in enumerate(native):
            for x,c in enumerate(r):
                if c!='.' and any(not(0<=xx<len(r) and 0<=yy<len(native)) or (mask[yy][xx]=='.' and not (spec.get('long_back') and py+yy>=-46 and whole_mask[yy][xx])) for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):r[x]='K'
        rows=[''.join(r) for r in native]
        text=re.sub(r'(@piece '+re.escape(piece)+r'\n)[^@]+',lambda m:m[1]+'\n'.join(rows)+'\n\n',text)
text = text.rstrip() + '\n'
sprite_source.write_sheet(text, 'character', managed_prefixes=['hair.'])
