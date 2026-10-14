"""Goku-inspired recolour/details on approved native templates. No raster resizing.
Run tools/hair3/build.py separately to regenerate hairstyles, including Goku.
Preserves fitted template anchors; the belt tails extend over the trousers.
"""
from pathlib import Path
import json, re, copy
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
import sys, importlib
sys.path.insert(0, str(ROOT / 'tools'))
sprite_source = importlib.import_module('sprite-source')
CONFIG = json.loads(Path(__file__).with_name('goku.json').read_text())
item_path = ROOT/'packages/character-core/src/data/items.json'
existing = {i['id']: i for i in json.loads(item_path.read_text())['items']}
character = sprite_source.read_sheet()
sections = {m[0]: [r for r in m[1].splitlines() if r and not r.startswith('#')]
            for m in re.findall(r'@piece ([^\n]+)\n([^@]+)', character)}
pieces, definitions = {}, []
for part in CONFIG['parts']:
    template = existing[part['template']]
    item = copy.deepcopy(template)
    item.update(id=part['id'], label=part['label'], gender='male')
    item['poses'] = {}
    for pose, (source, dx, dy) in template['poses'].items():
        pid = source.replace(part['template'], part['id'])
        rows = []
        for y, row in enumerate(sections[source]):
            result = []
            for x, ch in enumerate(row):
                # Retain alpha and black outline; details follow the native cloth pixels.
                detail = part.get('detail')
                if detail == 'gi' and ch not in '.K':
                    if y <= 5 and ch == 'V': ch = '\uea00'
                    elif y in (10, 11): ch = '\uea01' if ch in 'Tt' else '\uea00'
                elif detail == 'waist' and y == 0 and ch not in '.K': ch = '\uea00'
                result.append(ch)
            rows.append(''.join(result))
        if part.get('detail') == 'shoeTrim':
            # Thin upper/sole lines follow each foot's existing cloth silhouette.
            pixels = [list(row) for row in rows]
            for x in range(len(rows[0])):
                cloth = [y for y, row in enumerate(rows) if row[x] in 'OoQ']
                if not cloth: continue
                top, bottom = min(cloth), max(cloth)
                pixels[bottom][x] = '\uea06'
                if bottom - top >= 2: pixels[top][x] = '\uea03'
            rows = [''.join(row) for row in pixels]
        # Native overlays attach to the same shirt anchor, so the knot/tails track it.
        for overlay in CONFIG.get('overlays', {}).get(part['id'], []):
            width = max(len(rows[0]), overlay['x'] + max(map(len, overlay['rows'])))
            height = max(len(rows), overlay['y'] + len(overlay['rows']))
            pixels = [list(row.ljust(width, '.')) for row in rows]
            pixels += [list('.' * width) for _ in range(height - len(pixels))]
            for oy, row in enumerate(overlay['rows']):
                for ox, char in enumerate(row):
                    if char != '.': pixels[overlay['y']+oy][overlay['x']+ox] = overlay['colors'][char]
            rows = [''.join(row) for row in pixels]
        pieces[pid] = rows
        item['poses'][pose] = [pid, dx, dy]
    definitions.append(item)
# A native staff runs through the existing hand-grip point and leans away from the face.
staff = CONFIG['staff']
gx, gy = staff['grip']
centers = [round(gx + (gy-y)*staff['slope']) for y in range(staff['top'], staff['bottom']+1)]
left, right = min(centers)-1, max(centers)+1
rows = []
for row, center in enumerate(centers):
    colors = staff['tip'] if row < 2 or row >= len(centers)-2 else staff['colors']
    pixels = ['.'] * (right-left+1)
    for col, color in enumerate(colors): pixels[center-left-1+col] = color
    rows.append(''.join(pixels))
pieces[staff['id']] = rows
definitions.append({key:staff[key] for key in ['id','label','slot','layer']} | {
    'poses': {'0':[staff['id'],left,staff['top']]}
})
# Export the reference-matched raster tail; preserve source alpha and clusters.
tail = CONFIG['tail']
image=Image.open(ROOT/tail['atlas']).convert('RGBA')
image=image.crop(image.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()).resize(tuple(tail['size']),Image.Resampling.BOX)
chars=list(tail['colors'].values())
rgb=[tuple(bytes.fromhex(CONFIG['palette'][c][1:])) for c in chars]
rows=[]
for y in range(image.height):
    row=[]
    for x in range(image.width):
        *color,alpha=image.getpixel((x,y))
        row.append('.' if alpha<128 else chars[min(range(len(chars)),key=lambda i:sum((a-b)**2 for a,b in zip(color,rgb[i])))])
    rows.append(''.join(row))
pieces[tail['id']] = rows
left,top=tail['offset']
definitions.append({key:tail[key] for key in ['id','label','slot','layer']} | {
    'poses': {'0':[tail['id'],left,top]}
})
used={c for rows in pieces.values() for row in rows for c in row}
base_palette = dict(line.split() for line in character.split('@palette\n', 1)[1].split('@piece', 1)[0].splitlines() if line and not line.startswith('#'))
palette = {c:v for c,v in {**base_palette, **CONFIG['palette']}.items() if c in used}
text='@palette\n'+'\n'.join(f'{c} {v}' for c,v in palette.items())+'\n\n'
text+='\n\n'.join('@piece '+pid+'\n'+'\n'.join(rows) for pid,rows in pieces.items())+'\n'
sprite_source.write_sheet(text, 'goku')
text=item_path.read_text()
for item in definitions:
    text=re.sub(r'^  \{"id": "'+re.escape(item['id'])+r'",[^\n]+\n','',text,flags=re.M)
text=re.sub(r',(\s*\n \]\s*\n\})',r'\1',text)
new=',\n'.join('  '+json.dumps(i,ensure_ascii=False) for i in definitions)
text=re.sub(r'(\n \]\s*\n\})',lambda m:',\n'+new+m[1],text)
json.loads(text);item_path.write_text(text)
print('Exported Goku clothing, staff and tail using native templates/configuration.')
