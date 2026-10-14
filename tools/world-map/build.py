"""Export Phase 1 assets from the original panorama, keeping buildings intact.

Default: clean JPEG, opaque RGB masks (R water/G sky/B falls), deliberate lights,
opaque zone map. Requires numpy and Pillow. Existing label/boat sprites are retained.
Optional --experimental-landmarks keeps the old OpenCV extraction for experimentation.
See docs/world-map.md for usage and limitations.
"""
from pathlib import Path
import json, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'docs/art/world-map-v1.png'
OUT = ROOT / 'apps/game/src/assets/map'
experimental = '--experimental-landmarks' in sys.argv
CFG = json.loads((Path(__file__).with_name('layers.json' if experimental else 'layers-v2.json')).read_text(encoding='utf-8'))
SRC = ROOT / CFG.get('source', 'docs/art/world-map-v1.png')

img = Image.open(SRC).convert('RGB')
ZONES = json.loads((ROOT / 'apps/game/src/features/world-map/_utils/world-zones.json').read_text(encoding='utf-8'))['zones']
A = np.array(img).astype(int)
H, W = A.shape[:2]
R, G, B = A[..., 0], A[..., 1], A[..., 2]
lum = A.mean(2)


def flood(seed, ok):
    """Loang 4 hướng trong vùng `ok` từ các ô `seed` (không cần scipy)."""
    out = np.zeros_like(ok)
    frontier = seed & ok
    while frontier.any():
        out |= frontier
        grow = np.zeros_like(ok)
        grow[1:] |= frontier[:-1]; grow[:-1] |= frontier[1:]
        grow[:, 1:] |= frontier[:, :-1]; grow[:, :-1] |= frontier[:, 1:]
        frontier = grow & ok & ~out
    return out


def polyline_y(points):
    xs, ys = zip(*points)
    return np.interp(np.arange(W), xs, ys)


# The AI plate is used ONLY for sky; the original panorama remains untouched.
# Keep the first mountain silhouette in each column, rather than color-flooding through blue mountains.
if not experimental:
    sky_plate = Image.open(ROOT / 'docs/art/world-map-sky-clean-v2.png').convert('RGB')
    # An explicit silhouette avoids color-classification spikes and clipped cloud rectangles.
    guide = polyline_y(CFG['skyline'])
    sky_color = (B>G) & (B>=190) & ((R>=110)|(B>=225))
    candidates = ~sky_color & (np.arange(H)[:,None]>=guide[None,:]-12)
    boundary = np.clip(np.argmax(candidates,axis=0),guide-12,guide+3)
    boundary = np.median(np.stack([np.roll(boundary,k) for k in range(-5,6)]),axis=0)
    boundary = np.convolve(np.pad(boundary,(2,2),mode='edge'),np.array([1,2,3,2,1])/9,mode='valid')
    sky_blend = np.clip((boundary[None,:]-np.arange(H)[:,None])/1.5,0,1)
    sky = np.arange(H)[:, None] < boundary[None, :]
    OUT.mkdir(parents=True, exist_ok=True)
    sky_plate.save(OUT / 'world-map-sky-clean.png', optimize=True)
else:
    sky_like = (B > 230) & (R < 160) & (G > 140)
    seed = np.zeros((H, W), bool); seed[0] = True
    sky = flood(seed, sky_like)

# nước: xanh lam/ngọc, đỏ thấp; không lẫn mái xanh đậm (G/B thấp) và trời
water = (R < 95) & (B > R + 110) & (B > 140) & (G > 0.55 * B) & ~sky
# bỏ đốm lẻ: giữ ô có ít nhất 5/8 hàng xóm cũng là nước
n = sum(np.roll(np.roll(water, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
water &= n >= 5

# tầng xa: phía trên đường chân trời vẽ tay (núi, hồ xa, thành phố, cầu), trừ trời
far = (np.arange(H)[:, None] < polyline_y(CFG['far_horizon'])[None, :]) & ~sky if experimental else np.zeros((H, W), bool)

# thác: vệt trắng xanh trong các khung thác
fall = np.zeros((H, W), bool)
for x0, y0, x1, y1 in CFG['waterfalls']:
    box = np.zeros((H, W), bool); box[y0:y1, x0:x1] = True
    fall |= box & (B > 215) & (G > 190) & (R > 110) & ~sky

# Shore distance fields are anchored to explicit coastlines, not color-selected roofs.
if not experimental:
    yy, xx = np.mgrid[:H, :W].astype(float)
    distance = np.full((H, W), 80.0)
    impact = np.zeros((H, W))
    for path in CFG['surf_paths']:
        for a, b in zip(path, path[1:]):
            dx, dy = b[0]-a[0], b[1]-a[1]
            t = np.clip(((xx-a[0])*dx + (yy-a[1])*dy) / max(1, dx*dx+dy*dy), 0, 1)
            distance = np.minimum(distance, np.hypot(xx-a[0]-t*dx, yy-a[1]-t*dy))
    for rock in CFG['surf_rocks']:
        cx, cy = rock['center']; rx, ry = rock['radii']
        radial = np.sqrt(((xx-cx)/rx)**2 + ((yy-cy)/ry)**2)
        outside = np.maximum(0, (radial-1) * ry)
        distance = np.minimum(distance, outside)
        impact = np.maximum(impact, np.exp(-outside/9) * (radial>=1))
    # Allow pale blue foam, but reject brown/grey rocks, land and blue roofs far from shore.
    sea_color = ((B>R+25)&(G>R+15)&(B>145)) | ((R>170)&(G>210)&(B>230))
    strength = sea_color * (distance<48) * ~sky
    surf = np.dstack([np.minimum(distance/48, 1)*255, impact*255, strength*255]).astype(np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(surf, 'RGB').save(OUT/'world-map-surf.png', optimize=True)

# Data textures must be opaque: alpha is transparency, not a fourth data channel.
mask = np.dstack([water, sky, fall]).astype(np.uint8) * 255
if not experimental:
    mask[..., 1] = (sky_blend * 255).astype(np.uint8)
OUT.mkdir(parents=True, exist_ok=True)
if not experimental:
    # Wind affects only selected canopy cores, never trunks, roofs or coastline.
    yy,xx = np.mgrid[:H,:W]
    foliage = np.zeros((H,W),bool)
    vegetation = ((G>R*1.13)&(G>B*1.05)) | ((R>170)&(G>100)&(B>150))
    for cx,cy,rx,ry in CFG['canopies']:
        foliage |= (((xx-cx)/rx)**2+((yy-cy)/ry)**2<1) & vegetation
    mask[...,2] = np.where(foliage & ~fall & ~sky,128,mask[...,2])
Image.fromarray(mask, 'RGB').save(OUT / 'world-map-mask.png', optimize=True)

# Deliberate window and lamp anchors; keep night lighting sparse and warm.
core = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(core)
for x, y in CFG['window_lights']:
    draw.ellipse((x - 1, y - 2, x + 1, y + 2), fill=(255, 194, 100))
for x, y in CFG['street_lights']:
    draw.ellipse((x - 1, y - 1, x + 1, y + 1), fill=(255, 218, 146))
glow = core.filter(ImageFilter.GaussianBlur(5))
lights = np.clip(np.array(core).astype(float) + np.array(glow).astype(float) * 3.0, 0, 255).astype(np.uint8)
Image.fromarray(lights, 'RGB').save(OUT / 'world-map-lights.png', optimize=True)

# Phase 1 preserves the original panorama. Legacy extraction is opt-in only.
if '--experimental-landmarks' not in sys.argv:
    # Only the four authorized footprints use the generated restoration plate.
    restored = Image.open(ROOT/'docs/art/world-map-life-clean-v1.png').convert('RGB').resize((W,H), Image.Resampling.LANCZOS)
    runtime = img.copy()
    for x0,y0,x1,y1 in CFG['life_restore']:
        patch = restored.crop((x0,y0,x1,y1))
        # Feather only the perimeter; the removed subject's interior stays fully restored.
        yy,xx = np.mgrid[:y1-y0,:x1-x0]
        edge = np.minimum.reduce([xx,yy,x1-x0-1-xx,y1-y0-1-yy])
        alpha = Image.fromarray((np.clip(edge/3,0,1)*255).astype(np.uint8))
        runtime.paste(patch,(x0,y0),alpha)
    landmark_plate = Image.open(ROOT/'docs/art/world-map-landmarks-clean-v1.png').convert('RGB').resize((W,H), Image.Resampling.LANCZOS)
    for x0,y0,x1,y1 in CFG['landmark_restore']:
        yy,xx = np.mgrid[:y1-y0,:x1-x0]
        edge = np.minimum.reduce([xx,yy,x1-x0-1-xx,y1-y0-1-yy])
        alpha = Image.fromarray((np.clip(edge/4,0,1)*255).astype(np.uint8))
        runtime.paste(landmark_plate.crop((x0,y0,x1,y1)),(x0,y0),alpha)
    landmarks = {}
    for entry in CFG['landmark_sprites']:
        tile = Image.open(ROOT/entry['source']).convert('RGBA')
        bounds = tile.getchannel('A').point(lambda a: 255 if a>24 else 0).getbbox()
        tile = tile.crop(bounds).resize(tuple(entry['size']),Image.Resampling.LANCZOS)
        tile.save(OUT/'sprites'/f"{entry['id']}.png")
        w,h = entry['size']
        x,y = entry['at']
        landmarks[entry['id']] = {'x':x-w/2,'y':y-h/2,'w':w,'h':h,'hub':[x,y]}
    (OUT/'world-map-landmarks.json').write_text(json.dumps(landmarks,indent=2)+'\n')
    atlas = Image.open(ROOT/'docs/art/world-map-life-atlas-v1.png').convert('RGBA')
    life = []
    for entry in CFG['life_sprites']:
        cell = entry['cell']
        tile = atlas.crop((round(atlas.width*cell/4),0,round(atlas.width*(cell+1)/4),atlas.height))
        bounds = tile.getchannel('A').point(lambda a: 255 if a>24 else 0).getbbox()
        tile = tile.crop(bounds).resize(tuple(entry['size']),Image.Resampling.LANCZOS)
        tile.save(OUT/'sprites'/f"{entry['id']}.png")
        life.append({k:v for k,v in entry.items() if k!='cell'})
    (OUT/'world-map-life.json').write_text(json.dumps(life,indent=2)+'\n')
    for sheet in CFG['motion_atlases']:
        atlas = Image.open(ROOT/sheet['source']).convert('RGBA')
        frames = []
        for i in range(4):
            cell = atlas.crop((round(atlas.width*i/4),0,round(atlas.width*(i+1)/4),atlas.height))
            if str(i) in sheet.get('overrides',{}):
                cell = Image.open(ROOT/sheet['overrides'][str(i)]).convert('RGBA')
            box = cell.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
            frame = cell.crop(box)
            if str(i) in sheet.get('overrides',{}):
                target_width = max(f.width for f in frames)
                frame = frame.resize((target_width,round(frame.height*target_width/frame.width)),Image.Resampling.LANCZOS)
            frames.append(frame)
        w,h = sheet['size']
        scale = min((w-1)/max(f.width for f in frames),(h-1)/max(f.height for f in frames))
        for variant,color in sheet['variants'].items():
            for i,frame in enumerate(frames):
                tile = frame.copy()
                if color:
                    data = np.array(tile).astype(float)
                    # Palette variants affect the red shirt only, retaining face/hair/shorts.
                    shirt = (data[...,0]>data[...,1]*1.7)&(data[...,0]>data[...,2]*1.5)&(data[...,0]>90)&(data[...,3]>0)
                    rows = np.arange(tile.height)[:,None]
                    shirt &= (rows>tile.height*0.52)&(rows<tile.height*0.81)
                    shade = data[...,0]/235
                    for k,value in enumerate(color):
                        data[...,k] = np.where(shirt,np.clip(value*shade,0,255),data[...,k])
                    tile = Image.fromarray(data.astype(np.uint8),'RGBA')
                tile = tile.resize((round(tile.width*scale),round(tile.height*scale)),Image.Resampling.LANCZOS)
                canvas = Image.new('RGBA',(w,h))
                canvas.alpha_composite(tile,((w-tile.width)//2,h-1-tile.height))
                name = f"{sheet['id']}-{variant}-{i}"
                canvas.save(OUT/'sprites'/f'{name}.png')
                landmarks[name] = {'x':0,'y':0,'w':w,'h':h}
    (OUT/'world-map-landmarks.json').write_text(json.dumps(landmarks,indent=2)+'\n')
    runtime.save(OUT / 'world-map.jpg', quality=97, subsampling=0, optimize=True)
    zones_rgb = np.zeros((H, W, 3), np.uint8)
    for i, zone in enumerate(ZONES):
        poly = Image.new('L', (W, H), 0)
        ImageDraw.Draw(poly).polygon([tuple(p) for p in zone['area']], fill=255)
        land = (np.array(poly) > 0) & ~water & ~sky
        soft = np.array(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8)))
        sel = land & (zones_rgb[..., 0] == 0)
        zones_rgb[sel, 0] = (i + 1) * 20
        zones_rgb[sel, 1] = soft[sel]
    Image.fromarray(zones_rgb, 'RGB').save(OUT / 'world-map-zones.png', optimize=True)
    print('Phase 1: clean panorama, opaque masks, deliberate lighting, eight zones')
    sys.exit(0)

# ---- sprite động tách từ ảnh (cần opencv-python): cối xay, bò, vòng quay; máy bay, thuyền, nhãn khu
# lấy từ ảnh mẫu có giao diện (world-map-expect-v1.png, cùng khung hình nhưng là một bản vẽ khác) ----
import cv2

SPR = OUT / 'sprites'
SPR.mkdir(exist_ok=True)
sprites = {}


def save_sprite(name, rgb, alpha, origin):
    ys, xs = np.where(alpha > 16)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(SPR / f'{name}.png', optimize=True)
    sprites[name] = {'x': int(origin[0] + x0), 'y': int(origin[1] + y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}


def grabcut(rgb, box, pad=6, scale=3, hints=()):
    """Tách vật khỏi nền trong khung (GrabCut, phóng 3 lần cho mép mịn); trả alpha cùng cỡ khung có lề."""
    x0, y0, x1, y1 = box
    X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
    X1, Y1 = min(rgb.shape[1], x1 + pad), min(rgb.shape[0], y1 + pad)
    crop = np.ascontiguousarray(rgb[Y0:Y1, X0:X1, ::-1]).astype(np.uint8)
    big = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    mask = np.zeros(big.shape[:2], np.uint8)
    bgm, fgm = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(big, mask, ((x0 - X0) * scale, (y0 - Y0) * scale, (x1 - x0) * scale, (y1 - y0) * scale),
                bgm, fgm, 6, cv2.GC_INIT_WITH_RECT)
    if hints:
        for hx_, hy_, r in hints:
            cv2.circle(mask, ((hx_ - X0) * scale, (hy_ - Y0) * scale), r * scale, cv2.GC_FGD, -1)
        cv2.grabCut(big, mask, None, bgm, fgm, 3, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1: m = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    m = cv2.resize(cv2.GaussianBlur(m, (5, 5), 0), (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_AREA)
    return m, (X0, Y0, X1, Y1)


def inpaint(rgb, mask, radius=4):
    out = cv2.inpaint(np.ascontiguousarray(rgb[..., ::-1]).astype(np.uint8), mask.astype(np.uint8), radius, cv2.INPAINT_TELEA)
    return out[..., ::-1].astype(int)


patched = A.copy()
# cối xay: 4 cánh = dải quanh 4 trục chéo, chỉ lấy điểm màu vải (trắng/cam đỏ); nền dưới cánh vá bằng inpaint
mill = CFG['windmill']
hx, hy, length, half = mill['hub'][0], mill['hub'][1], mill['length'], mill['half_width']
yy, xx = np.mgrid[0:H, 0:W]
vx, vy = xx - hx, yy - hy
blade = np.zeros((H, W), bool)
for ang in mill['angles']:
    ax, ay = np.cos(np.radians(ang)), np.sin(np.radians(ang))
    along, perp = vx * ax + vy * ay, -vx * ay + vy * ax
    blade |= (along >= 0) & (along <= length) & (np.abs(perp) <= half)
blade |= np.hypot(vx, vy) <= mill['hub_radius']
paint = (R > 150) & ((R - G > 40) | (lum > 195))
inner = np.zeros((H, W), bool)
for ang in mill['angles']:
    ax, ay = np.cos(np.radians(ang)), np.sin(np.radians(ang))
    along, perp = vx * ax + vy * ay, -vx * ay + vy * ax
    inner |= (along >= 0) & (along <= length - 2) & (np.abs(perp) <= half - 2.5)
blade_px = blade & (paint | inner | (np.hypot(vx, vy) <= mill['hub_radius']))   # lõi cánh lấy hết, mép chỉ lấy màu vải
patched = inpaint(patched, cv2.dilate(blade.astype(np.uint8) * 255, np.ones((3, 3), np.uint8)))
box = (hx - length - 3, hy - length - 3, hx + length + 4, hy + length + 4)
save_sprite('windmill', A[box[1]:box[3], box[0]:box[2]], blade_px[box[1]:box[3], box[0]:box[2]] * 255, box[:2])
sprites['windmill']['hub'] = [hx, hy]

# bò: tách bằng GrabCut, vá cỏ phía dưới để con bò đi lại được
for name, cfg in CFG['animals'].items():
    a_, (X0, Y0, X1, Y1) = grabcut(A, cfg['box'])
    save_sprite(name, A[Y0:Y1, X0:X1], a_, (X0, Y0))
    hole = np.zeros((H, W), np.uint8)
    hole[Y0:Y1, X0:X1] = cv2.dilate((a_ > 40).astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
    patched = inpaint(patched, hole, 5)

# vòng quay: cả đĩa bánh xe quay; chân đỡ và trục (vàng) đứng yên vẽ đè lên
fw = CFG['ferris']
cx, cy, rad = fw['center'][0], fw['center'][1], fw['radius']
disc = np.hypot(xx - cx, yy - cy) <= rad
legs = disc & (R > 190) & (G > 140) & (B < 120) & (yy >= cy - 4)
legs |= np.hypot(xx - cx, yy - cy) <= fw['hub_radius']
wheel = A.copy()
for y_, x_ in zip(*np.where(legs & ~(np.hypot(xx - cx, yy - cy) <= fw['hub_radius']))):
    # điểm chân đỡ trong bánh xe: lấy điểm cùng bán kính lệch góc 20° (không phải chân đỡ)
    r_, t_ = np.hypot(x_ - cx, y_ - cy), np.arctan2(y_ - cy, x_ - cx)
    for dt in (0.35, -0.35, 0.6, -0.6):
        sx, sy = int(round(cx + r_ * np.cos(t_ + dt))), int(round(cy + r_ * np.sin(t_ + dt)))
        if not legs[sy, sx]: wheel[y_, x_] = A[sy, sx]; break
box = (cx - rad - 1, cy - rad - 1, cx + rad + 2, cy + rad + 2)
save_sprite('ferris-wheel', wheel[box[1]:box[3], box[0]:box[2]], disc[box[1]:box[3], box[0]:box[2]] * 255, box[:2])
sprites['ferris-wheel']['hub'] = [cx, cy]
save_sprite('ferris-legs', A[box[1]:box[3], box[0]:box[2]], legs[box[1]:box[3], box[0]:box[2]] * 255, box[:2])

UI = np.array(Image.open(ROOT / 'docs/art/world-map-expect-v1.png').convert('RGB')).astype(int)[:, :W]
for name, cfg in CFG['expect_sprites'].items():
    a_, (X0, Y0, X1, Y1) = grabcut(UI, cfg['box'], pad=cfg.get('pad', 6), hints=[tuple(h) for h in cfg.get('hints', [])])
    save_sprite(name, UI[Y0:Y1, X0:X1], a_, (X0, Y0))
(OUT / 'sprites.json').write_text(json.dumps(sprites, indent=1) + '\n', encoding='utf-8')
img = Image.fromarray(patched.astype(np.uint8), 'RGB')

# ---- vùng khu vực (đất trong đa giác, bỏ nước/trời) để làm sáng mềm khi di chuột --------------
zones_rgba = np.zeros((H, W, 4), np.uint8)
for i, zone in enumerate(ZONES):
    poly = Image.new('L', (W, H), 0)
    ImageDraw.Draw(poly).polygon([tuple(p) for p in zone['area']], fill=255)
    land = (np.array(poly) > 0) & ~water & ~sky
    land_img = Image.fromarray((land * 255).astype(np.uint8))
    inner = np.array(land_img.filter(ImageFilter.GaussianBlur(9))).astype(float) / 255
    soft = np.clip(inner * 1.7, 0, 1) * land
    outer = np.array(land_img.filter(ImageFilter.GaussianBlur(6))).astype(float) / 255 * ~land
    code = (i + 1) * 20
    free = zones_rgba[..., 0] == 0
    sel = land & free
    zones_rgba[sel, 0] = code
    zones_rgba[sel, 1] = (soft[sel] * 255).astype(np.uint8)
    glow = (outer > 0.04) & (zones_rgba[..., 3] == 0) & ~land
    zones_rgba[glow, 2] = (np.clip(outer[glow] * 2, 0, 1) * 255).astype(np.uint8)
    zones_rgba[glow, 3] = code
Image.fromarray(zones_rgba, 'RGBA').save(OUT / 'world-map-zones.png', optimize=True)
img.save(OUT / 'world-map.jpg', quality=92, optimize=True)
print('sky %.1f%%, water %.1f%%, far %.1f%%, waterfall %d px' % (sky.mean() * 100, water.mean() * 100, far.mean() * 100, fall.sum()))
