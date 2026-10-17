"""Deterministic atlas slicing. Run from the repository root with Pillow installed."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw
import json
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'apps/game/src/assets/entertainment'
OUT.mkdir(parents=True, exist_ok=True)
COMMON = {'lamp', 'cloud', 'tree', 'tree-alt', 'curb', 'shrubs', 'skyline', 'flower-patch', 'evergreen'}
COMMON_OUT = ROOT / 'apps/game/src/assets/common/scenery'
COMMON_OUT.mkdir(parents=True, exist_ok=True)
# Source rectangles deliberately retain the supplied art and alpha.
SLICES = {
 'atm': (3, (8, 303, 205, 492)),
 'arcade': (3, (205, 285, 401, 493)),
 'hall': (3, (402, 262, 619, 496)),
 'auction': (3, (700, 330, 918, 505)),
 'prizes': (3, (940, 349, 1168, 508)),
 'wheel-base': (1, (866, 242, 1047, 275)),
 'racing': (3, (1180, 306, 1535, 509)),
 'wheel-disc': (1, (869, 115, 991, 238)),
 'wheel-pointer': (1, (1008, 140, 1042, 190)),
 'tree': (3, (924, 135, 1070, 268)),
 'tree-alt': (3, (1068, 144, 1168, 265)),
 'evergreen': (3, (414, 691, 500, 817)),
 'flower-patch': (3, (758, 947, 842, 1008)),
 'shrubs': (3, (1304, 260, 1355, 306)),
 'cable-profile': (3, (239, 955, 242, 964)),
 'cable-clamp': (3, (315, 951, 331, 973)),
 'utility-pole': (3, (446, 820, 484, 933)),
 'hydrant': (3, (683, 824, 744, 917)),
 'drain': (3, (581, 657, 653, 693)),
 'curb': (3, (663, 515, 746, 561)),
 'road': (3, (906, 518, 992, 554)),
 'lamp': (3, (16, 818, 68, 934)),
 'bin': (3, (600, 820, 665, 923)),
 'billboard': (3, (801, 794, 1170, 946)),
 'zone-sign': (3, (1306, 811, 1370, 925)),
 'cloud': (3, (1360, 100, 1535, 172)),
 'skyline': (3, (1270, 155, 1535, 256)),
 'paving-a': (3, (23, 516, 116, 598)),
 'paving-b': (3, (135, 516, 235, 598)),
 'paving-c': (3, (253, 516, 348, 598)),
}

for stale in OUT.glob('*.webp'):
 if stale.stem not in SLICES or stale.stem in COMMON:
  stale.unlink()
manifest=[]
common_manifest=[]
for key, (version, box) in SLICES.items():
 im=Image.open(ROOT / f'docs/art/entertainment/entertainment-atlas-v{version}.png').crop(box)
 if key == 'hall':
  # Atlas foliage touches the roof's alpha halo. Keep the sloped roof envelope,
  # rather than trimming the entire image above the neighbouring foliage.
  alpha=im.getchannel('A'); pixels=alpha.load()
  for y in range(68):
   for x in range(im.width):
    if y < max(6, 5 + abs(x - 107) * 0.53 - 2):
     pixels[x,y]=0
  im.putalpha(alpha)
 if key == 'skyline':
  # Clouds above the isolated skyline touch its low-alpha halo in the AI atlas.
  # Author a skyline envelope so only buildings and foliage survive.
  points=[(0,75),(16,63),(22,42),(32,30),(43,45),(48,57),(57,37),(64,26),(69,24),(70,20),(72,24),(80,29),(91,31),(100,25),(109,16),(112,17),(121,27),(129,31),(130,49),(146,62),(155,50),(165,37),(169,36),(172,40),(179,43),(182,27),(190,14),(194,18),(203,27),(208,52),(218,50),(221,37),(232,32),(234,34),(244,43),(247,67),(253,86),(253,103),(0,103)]
  mask=Image.new('L',im.size)
  ImageDraw.Draw(mask).polygon([(x,y-7) for x,y in points], fill=255)
  alpha=im.getchannel('A'); ap=alpha.load(); mp=mask.load()
  for y in range(im.height):
   for x in range(im.width):
    if not mp[x,y]: ap[x,y]=0
  im.putalpha(alpha)
 if key == 'wheel-disc':
  alpha=im.getchannel('A'); pixels=alpha.load(); w,h=im.size
  for y in range(h):
   for x in range(w):
    if ((x-(w-1)/2)/((w-2)/2))**2 + ((y-(h-1)/2)/((h-2)/2))**2 > 1:
     pixels[x,y]=0
  im.putalpha(alpha)
 # Discard disconnected fragments from neighbouring atlas objects; retain antialiasing on the main silhouette.
 if key in {'tree', 'tree-alt', 'evergreen', 'shrubs', 'cloud', 'skyline', 'hall', 'racing', 'billboard'}:
  alpha=im.getchannel('A'); pixels=alpha.load(); w,h=im.size
  visited=set(); largest=[]
  for y in range(h):
   for x in range(w):
    if (x,y) in visited or pixels[x,y] <= 24: continue
    stack=[(x,y)]; visited.add((x,y)); component=[]
    while stack:
     px,py=stack.pop(); component.append((px,py))
     for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
      if 0<=nx<w and 0<=ny<h and (nx,ny) not in visited and pixels[nx,ny]>24:
       visited.add((nx,ny)); stack.append((nx,ny))
    if len(component)>len(largest): largest=component
  mask=Image.new('L',im.size); mp=mask.load()
  for xy in largest: mp[xy]=255
  mask=mask.filter(ImageFilter.MaxFilter(3)); ap=alpha.load(); mp=mask.load()
  for y in range(h):
   for x in range(w):
    if not mp[x,y]: ap[x,y]=0
  im.putalpha(alpha)
 if key == 'zone-sign':
  # Preserve the rim and post; remove lettering baked into the supplied sign.
  ImageDraw.Draw(im).rectangle((10, 12, 47, 55), fill=(253, 253, 253, 254))
 im.save((COMMON_OUT if key in COMMON else OUT) / f'{key}.webp', lossless=True, exact=True)
 (common_manifest if key in COMMON else manifest).append({'key':key, 'file':f'{key}.webp', 'source':version, 'box':box})
( ROOT / 'tools/entertainment/assets.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(f'Exported {len(manifest)} assets')

(ROOT / 'tools/scenery/assets.json').write_text(json.dumps(common_manifest, indent=2)+'\n')
