"""Nhân vật nữ cơ bản dựng từ ảnh mẫu của người dùng (docs/art/female-reference-v1.png).

Tóc: atlas raster v6 tách/tái dựng theo bảng mẫu nữ mới; màu về 5 bậc I h H G L.
Mắt: lấy mẫu từng ô từ nhân vật lớn trong ảnh (reference.py).
Váy liền, tất và giày: vẽ thẳng trên thân/giày gốc theo chi tiết của mẫu (dress.py), giữ neo pose.

Chạy từ gốc repo (Python + numpy + Pillow): python3 tools/characters/female/build.py
"""
from pathlib import Path
import importlib, json, re, sys
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path[:0] = [str(HERE), str(ROOT / 'tools')]
sources = importlib.import_module('sprite-source')
import reference, hair as hairmod, face, dress, styles, finish
raster_hair = importlib.import_module('raster-hair')

item_path = ROOT / 'packages/character-core/src/data/items.json'
item_text = item_path.read_text()
items = {i['id']: i for i in json.loads(item_text)['items']}
palette, grids = sources.parse(sources.read_sheet())
pieces, definitions = {}, []


def define(identifier, label, slot, layer, poses, hidden=False):
    item = dict(id=identifier, gender='female', label=label, slot=slot, layer=layer, poses=poses)
    if hidden: item['hidden'] = True
    definitions.append(item)


def world(identifier, pose='0'):
    name, dx, dy = items[identifier]['poses'].get(pose, items[identifier]['poses']['0'])
    return {(dx + x, dy + y): c for y, row in enumerate(grids[name]) for x, c in enumerate(row) if c != '.'}


def to_rows(cells):
    xs = [p[0] for p in cells]; ys = [p[1] for p in cells]
    x0, y0 = min(xs), min(ys)
    return [''.join(cells.get((x, y), '.') for x in range(x0, max(xs) + 1)) for y in range(y0, max(ys) + 1)], x0, y0


def head_poses(identifier, dx, dy):
    return {str(p): [identifier, dx, dy + (1 if p else 0)] for p in range(4)}


G = reference.grid()

# ---- mắt nữ -------------------------------------------------------------------------------------
eye_rows, ex, ey = face.eyes(G)
pieces['eyes.female'] = eye_rows
define('eyes.female', 'Mắt nữ', 'eyes', 45, head_poses('eyes.female', ex, ey))
EYES = {(ex + x, ey + y) for y, r in enumerate(eye_rows) for x, c in enumerate(r) if c != '.'}
for e in items.values():
    if e['slot'] == 'eyes' and e['id'] != 'eyes.female': EYES |= set(world(e['id']))

# ---- raster female hair, using the approved male atlas rendering language -----------------------
head = world('head')
FACES = {0: 'head', 2: 'face.baby', 4: 'face.chubby', 6: 'face.wide'}
all_styles = raster_hair.variants()
for style_id, label, front, back in all_styles:
    # Cover the shared scalp with nearest strand shading after the small resize.
    for p in head:
        if p[1] < -46 and p not in front:
            nearest = min(front, key=lambda q: abs(p[0] - q[0]) + abs(p[1] - q[1]))
            front[p] = front[nearest]
    # Carry existing strand shade into hidden attachment gaps. Fixed dark
    # rectangles beside a narrow cheek would flatten the painted lock volumes.
    shades = {p: c for p, c in back.items() if c in 'hHGL'}
    def root_shade(p):
        q = min(shades, key=lambda q: abs(p[0] - q[0]) + abs(p[1] - q[1]))
        return 'h' if shades[q] in 'GL' else shades[q]
    for y in range(-46, -27):
        xs = [x for x, yy in {**back, **front} if yy == y]
        hs = [x for x, yy in head if yy == y]
        if not hs: continue
        for x in range(min(xs + hs), max(xs + hs) + 1):
            if (x, y) not in back: back[(x, y)] = root_shade((x, y))
    for extra, face_id in FACES.items():
        # mặt rộng: nhân đôi vài cột giữa sọ (x −12..6) rồi lùi về trái extra/2
        cols = {round(-12 + i * 18 / max(1, extra - 1)) for i in range(extra)}
        def widen(cells):
            out = {}
            for (x, y), c in cells.items():
                shift = sum(1 for k in cols if k < x)
                out[(x + shift - extra // 2, y)] = c
                if x in cols: out[(x + shift + 1 - extra // 2, y)] = c
            return out
        fg, bg = widen(front), widen(back)
        # Seal the temple against the actual face contour, including wide variants.
        skull = world(face_id)
        for y in range(-46, -27):
            skin = [x for x, yy in skull if yy == y]
            locks = [x for x, yy in bg if yy == y]
            if not skin or not locks: continue
            for x in range(min(skin + locks), max(skin + locks) + 1):
                if (x, y) not in bg:
                    bg[(x, y)] = root_shade((x + extra // 2, y))
                    # The rear curtain also covers narrow cheeks. Only the portion
                    # outside the attachment template needs a foreground bridge.
                    if (x, y) not in skull and y <= -33: fg[(x, y)] = bg[(x, y)]
        # The side lock passes in front of the near cheek's outer edge. Keeping
        # all of it behind the skull exposes a black ear-to-cheek crease inside
        # the hair mass. Cover only that outer edge, leaving the ear/face intact.
        for (x, y), c in skull.items():
            if c == 'K' and x <= -12 and -38 <= y <= -30 and (x - 1, y) in bg and (x, y) in bg:
                fg[(x, y)] = bg[(x, y)]
        silhouette = {**bg, **fg, **skull}
        fg = finish.outline(hairmod.contour(fg, silhouette))
        bg = finish.outline(hairmod.contour(bg, silhouette))
        for p in EYES: fg.pop(p, None)                  # mắt/mi luôn lộ (mọi kiểu mắt)
        suffix = f'.w{extra}' if extra else ''
        for ending, cells, slot, layer in [('', fg, 'hair', 50), ('.back', bg, 'hairBack', 5)]:
            identifier = style_id + ending + suffix
            rows, x0, y0 = to_rows(cells)
            pieces[identifier] = rows
            define(identifier, label + (' (sau)' if ending else ''), slot, layer,
                   head_poses(identifier, x0, y0), bool(extra or ending))
# The loop and pink fastening emerge from the rear opening of a covering hat.
# Keep this small source-derived part separate from the scalp's hat mask.
tie = raster_hair.hat_tie()
for extra in (0, 2, 4, 6):
    identifier = 'hair.female-ponytail.tie' + (f'.w{extra}' if extra else '')
    cells = {(x - extra // 2, y): c for (x, y), c in tie.items()}
    rows, x0, y0 = to_rows(cells)
    pieces[identifier] = rows
    define(identifier, 'Búi và dây buộc tóc', 'hairTie', 54, head_poses(identifier, x0, y0), True)
# ---- váy liền, tất + giày ------------------------------------------------------------------------
body = world('body')
for identifier, label, slot, layer, cells in [
        ('shirt.female', 'Váy liền (áo)', 'shirt', 30, dress.shirt(body)),
        ('pants.female', 'Váy liền (chân váy)', 'pants', 20, dress.skirt(body))]:
    rows, x0, y0 = to_rows(cells)
    pieces[identifier] = rows
    define(identifier, label, slot, layer, {'0': [identifier, x0, y0]})
poses = {}
for pose, (name, x, y) in items['shoes']['poses'].items():
    identifier = name.replace('shoes', 'shoes.female', 1)
    pieces[identifier] = dress.shoes(grids[name])
    poses[pose] = [identifier, x, y]
define('shoes.female', 'Giày + tất trắng', 'shoes', 15, poses)

sources.write_sheet(sources.render({dress.GOLD: '#e8bc61', dress.ZIP: '#c9c3cc', **styles.PALETTE}, pieces), 'female-basic')
for item in definitions:
    item_text = re.sub(r'^  \{"id": "' + re.escape(item['id']) + r'",[^\n]+\n', '', item_text, flags=re.M)
item_text = re.sub(r',(\s*\n \]\s*\n\})', r'\1', item_text)
new = ',\n'.join('  ' + json.dumps(item, ensure_ascii=False) for item in definitions)
item_text = re.sub(r'(\n \]\s*\n\})', lambda m: ',\n' + new + m[1], item_text)
json.loads(item_text)
if item_path.read_text() != item_text: item_path.write_text(item_text)
print(f'Exported female starter from the reference: {len(pieces)} pieces.')
