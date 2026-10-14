"""Slice a transparent atlas; background cleanup is performed upstream, not here."""
import json
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'tools/farm-v4-slices.json'
SOURCE = ROOT / 'docs/art/farm-v4-transparent-atlas.png'
DEST = ROOT / 'tools/.farm-export/extracted-v4'

def export():
    config = json.loads(CONFIG.read_text())
    atlas = Image.open(SOURCE).convert('RGBA')
    if atlas.getchannel('A').getextrema()[0] != 0:
        raise ValueError('Source must contain actual alpha transparency')
    trees = Image.open(ROOT / config['treeSource']).convert('RGBA')
    sx, sy = atlas.width / config['sourceWidth'], atlas.height / config['sourceHeight']
    if abs(sx / sy - 1) > 0.02:
        raise ValueError('Atlas aspect ratio changed; review slice coordinates before exporting')
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, (x, y, w, h) in config['sprites'].items():
        source = atlas
        source_path = str(SOURCE.relative_to(ROOT))
        if name in config['treeSprites']:
            source = trees
            source_path = config['treeSource']
            x, y, w, h = config['treeSprites'][name]
        override = config.get('overrides', {}).get(name)
        if override:
            source_path = override['source']
            source = Image.open(ROOT / source_path).convert('RGBA')
            x, y, w, h = 0, 0, source.width, source.height
        rect = tuple(round(v) for v in (x*sx, y*sy, (x+w)*sx, (y+h)*sy))
        sprite = source.crop(rect)
        bbox = sprite.getchannel('A').point(lambda a: 255 if a > 12 else 0).getbbox()
        if not bbox:
            raise ValueError(f'Empty sprite: {name}')
        sprite = sprite.crop(bbox)
        if override:
            sprite.thumbnail(tuple(override['maxSize']), Image.Resampling.LANCZOS)
        sprite.save(DEST / f'{name}.png')
        manifest[name] = {'width': sprite.width, 'height': sprite.height,
                          'anchor': [sprite.width / 2, sprite.height],
                          'sourceRect': rect, 'trimRect': list(bbox),
                          'source': source_path,
                          'status': 'reviewed-static-cutout',
                          'animationReady': False}
        if name in config.get('contents', {}):
            manifest[name]['contents'] = config['contents'][name]
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    # Contact sheet is review-only, never imported as map scenery.
    (DEST / 'README.md').write_text('Source slices for review only. Runtime assets are selected by tools/farm-runtime-assets.json.\n')
    names = list(manifest)
    sheet = Image.new('RGB', (800, ((len(names)+5)//6)*128), '#d8dfcf')
    draw = ImageDraw.Draw(sheet)
    for i,name in enumerate(names):
        x,y = (i%6)*133, (i//6)*128
        im = Image.open(DEST / f'{name}.png').convert('RGBA')
        im.thumbnail((120, 94), Image.Resampling.LANCZOS)
        sheet.paste(im, (x+(133-im.width)//2, y+8+(94-im.height)//2), im)
        draw.text((x+5,y+107), name, fill='#33412c')
    review = ROOT.parent / 'outputs/farm-review/v4-extracted-sprites.png'
    review.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(review)
    terrain_names = config.get('terrainSprites', [])
    terrain = Image.new('RGB', (1000, ((len(terrain_names)+5)//6)*130), '#d8dfcf')
    terrain_draw = ImageDraw.Draw(terrain)
    for i, name in enumerate(terrain_names):
        x, y = (i%6)*166, (i//6)*130
        im = Image.open(DEST / f'{name}.png').convert('RGBA')
        im.thumbnail((145, 90), Image.Resampling.LANCZOS)
        terrain.paste(im, (x+(166-im.width)//2, y+10+(90-im.height)//2), im)
        terrain_draw.text((x+3, y+107), name.replace('terrain-', '').replace('decor-', ''), fill='#33412c')
    terrain.save(review.parent / 'v4-terrain-sprites.png')
    with zipfile.ZipFile(review.parent / 'farm-v4-extracted-assets.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in manifest:
            archive.write(DEST / f'{name}.png', f'farm-v4/{name}.png')
        for filename in ['manifest.json', 'README.md']:
            archive.write(DEST / filename, f'farm-v4/{filename}')
    print(f'Exported {len(manifest)} sprites. Review: {review}')

if __name__ == '__main__':
    export()
