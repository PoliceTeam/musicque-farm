"""Export the supplied reference atlas without repainting the source artwork."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
TARGET = ROOT / 'apps/game/src/assets/farm-entrance'
TARGET.mkdir(parents=True, exist_ok=True)
atlas = Image.open(SOURCE / 'source-atlas.png').convert('RGBA')
for item in json.loads((SOURCE / 'assets.json').read_text()):
    image = atlas.crop(item['box'])
    for box in item.get('clear', []):
        image.paste((0, 0, 0, 0), box)
    # The supplied sheet has nearly invisible alpha noise around its cutouts.
    floor = item.get('alphaFloor', 16)
    image.putalpha(image.getchannel('A').point(lambda alpha: 0 if alpha < floor else alpha))
    destination = (ROOT / 'apps/game/src/assets/common/scenery' / f"{item['sceneryKey']}.webp") if 'sceneryKey' in item else TARGET / f"{item['key']}.webp"
    image.save(destination, lossless=True, exact=True)

# Newly authored terrain and shared environment props stay separate from scene composition.
scenery_path = ROOT / 'tools/scenery/assets.json'
shared = json.loads(scenery_path.read_text())
entries = json.loads((SOURCE / 'scenery.json').read_text())
for item in entries:
    image = Image.open(SOURCE / 'source-art' / item['source']).convert('RGBA').crop(item['box'])
    if floor := item.get('alphaFloor'):
        image.putalpha(image.getchannel('A').point(lambda alpha: 0 if alpha < floor else alpha))
    if item.get('trim'):
        image = image.crop(image.getchannel('A').getbbox())
    image.save(ROOT / 'apps/game/src/assets/common/scenery' / f"{item['key']}.webp", lossless=True, exact=True)
keys = {item['key'] for item in entries}
shared = [item for item in shared if item['key'] not in keys]
shared.extend({**item, 'file': f"{item['key']}.webp", 'source': f"farm-entrance/source-art/{item['source']}"} for item in entries)
scenery_path.write_text(json.dumps(shared, indent=2) + '\n')
props = Image.open(SOURCE / 'source-art/scenery-atlas.png').convert('RGBA')
for key, box in [('chest', (180, 580, 665, 965)), ('farm-sign', (850, 540, 1400, 965))]:
    image = props.crop(box)
    image.putalpha(image.getchannel('A').point(lambda alpha: 0 if alpha < 180 else alpha))
    image = image.crop(image.getchannel('A').getbbox())
    image.save(TARGET / f"{key}.webp", lossless=True, exact=True)

# The second user-supplied atlas owns the current entrance props.
from runpy import run_path
run_path(str(SOURCE / 'export-country-v2.py'))

# Latest supplied atlas supersedes the matching props.
run_path(str(SOURCE / 'export-country-v3.py'))
