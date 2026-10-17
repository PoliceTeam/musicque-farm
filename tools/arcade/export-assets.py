"""Deterministic extraction from the user's lobby atlas and diamond screenshot."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw, ImageChops
import json
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'apps/game/src/assets/arcade'; OUT.mkdir(parents=True,exist_ok=True)
SLICES={
 'card-table':('game-ui-atlas-user.png',(758,384,1272,641)),
 'felt':('diamond-reference.png',(400,160,656,416)),
 'banner':('lobby-atlas.png',(40,8,1270,293)),
 'tien-len':('lobby-atlas.png',(17,314,338,650)),
 'phom':('lobby-atlas.png',(343,314,653,650)),
 'diamonds':('lobby-atlas.png',(654,314,971,650)),
 'bau-cua':('lobby-atlas.png',(976,314,1306,650)),
 'slots':('lobby-atlas.png',(157,660,484,1012)),
 'chess':('lobby-atlas.png',(488,660,822,1012)),
 'chinese-chess':('lobby-atlas.png',(830,660,1160,1012)),
 'gem-attack':('diamond-reference.png',(2414,54,2539,184)),
 'gem-heal':('diamond-reference.png',(2541,68,2652,176)),
 'gem-mana':('diamond-reference.png',(2537,302,2655,416)),
 'gem-score':('diamond-reference.png',(2541,182,2652,297)),
 'gem-shield':('diamond-reference.png',(2056,228,2174,338)),
 'gem-luck':('diamond-reference.png',(1696,68,1809,181)),
}
# Use one equal-height row per side so crowns, bases and horses keep their relative scale.
for side, top, bottom in [('w', 0, 187), ('b', 190, 360)]:
 for piece, left, right in [('k',30,150),('q',155,265),('b',274,378),('n',386,503),('r',515,635),('p',650,765)]:
  SLICES[f'chess-piece-{side}{piece}']=('chess-atlas-user.png',(left,top,right,bottom))
for side, top, bottom in [('r',20,151),('b',150,280)]:
 for piece, center in zip(['k','a','e','r','h','c','p'],[97,221,342,464,585,706,826]):
  SLICES[f'xiangqi-piece-{side}{piece}']=('xiangqi-atlas-user.png',(center-62,top,center+62,bottom))

for key,(source,box) in SLICES.items():
 im=Image.open(ROOT/'docs/art/arcade'/source).crop(box)
 if key.startswith('chess-piece-'):
  # The checkerboard is baked into this RGB reference. Flood only exterior neutral pixels;
  # enclosed highlights on the gold and black pieces stay intact.
  im=im.convert('RGBA'); pixels=im.load(); w,h=im.size; seen=set()
  stack=[(x,y) for x in range(w) for y in (0,h-1)]+[(x,y) for y in range(h) for x in (0,w-1)]
  while stack:
   x,y=stack.pop()
   if not (0<=x<w and 0<=y<h) or (x,y) in seen: continue
   seen.add((x,y)); r,g,b,a=pixels[x,y]
   if min(r,g,b)<150 or max(r,g,b)-min(r,g,b)>22: continue
   pixels[x,y]=(r,g,b,0)
   stack.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
  canvas=Image.new('RGBA',(128,192)); canvas.alpha_composite(im,((128-im.width)//2,192-im.height)); im=canvas
 if key.startswith('xiangqi-piece-'):
  # Constrain only the outer coin edge to omit the atlas' bright-red fringe.
  im=im.convert('RGBA'); mask=Image.new('L',im.size)
  ImageDraw.Draw(mask).ellipse((5,6,120,127),fill=255)
  im.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
 if key == 'card-table':
  im=im.convert('RGBA')
  # Remove the bright-red atlas matte around the wooden edge, not the dark burgundy felt.
  for y in range(im.height):
   for x in range(im.width):
    r,g,b,a=im.getpixel((x,y))
    if a<24 or (r>220 and g<90 and b<100 and r>2*g): im.putpixel((x,y),(r,g,b,0))
  alpha=im.getchannel('A'); mask=Image.new('L',im.size); seen=set(); stack=[(im.width//2,im.height//2)]
  while stack:
   x,y=stack.pop()
   if not (0<=x<im.width and 0<=y<im.height) or (x,y) in seen or not alpha.getpixel((x,y)): continue
   seen.add((x,y)); mask.putpixel((x,y),alpha.getpixel((x,y)))
   stack.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
  im.putalpha(mask)
 if key.startswith('gem-'):
  w,h=im.size; rgb=im.convert('RGB'); mask=Image.new('L',im.size); mp=mask.load()
  for y in range(h):
   for x in range(w):
    values=rgb.getpixel((x,y))
    if max(values)-min(values)>25 or max(values)>100: mp[x,y]=255
  mask=mask.filter(ImageFilter.MaxFilter(3)); mp=mask.load()
  # Retain only the gem's largest connected silhouette, removing stray particles.
  seen=set(); components=[]
  for y in range(h):
   for x in range(w):
    if not mp[x,y] or (x,y) in seen: continue
    component=set(); stack=[(x,y)]
    while stack:
     px,py=stack.pop()
     if not (0<=px<w and 0<=py<h) or (px,py) in seen or not mp[px,py]: continue
     seen.add((px,py)); component.add((px,py))
     stack.extend([(px-1,py),(px+1,py),(px,py-1),(px,py+1)])
    components.append(component)
  largest=max(components,key=len)
  for y in range(h):
   for x in range(w): mp[x,y]=255 if (x,y) in largest else 0

  # Fill enclosed dark glyphs; retain transparency outside the gem silhouette.
  exterior=set(); stack=[(x,y) for x in range(w) for y in [0,h-1]]+[(x,y) for x in [0,w-1] for y in range(h)]
  while stack:
   x,y=stack.pop()
   if not (0<=x<w and 0<=y<h) or (x,y) in exterior or mp[x,y]: continue
   exterior.add((x,y)); stack.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
  for y in range(h):
   for x in range(w): mp[x,y]=0 if (x,y) in exterior else 255
  im.putalpha(mask)
 temporary=OUT/f'.{key}.tmp'
 im.save(temporary,format='WEBP',lossless=True,exact=True)
 temporary.replace(OUT/f'{key}.webp')
(ROOT/'tools/arcade/assets.json').write_text(json.dumps([{'key':k,'file':k+'.webp','source':v[0],'box':v[1]} for k,v in SLICES.items()],indent=2)+'\n')
print(f'Exported {len(SLICES)} arcade assets')
