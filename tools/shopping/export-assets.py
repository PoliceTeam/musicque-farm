"""Slice supplied shopping artwork; retain sources and crop coordinates for repeatable exports."""
import json
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/shopping'
COMMON = ROOT / 'apps/game/src/assets/common/scenery'
BUILDINGS = ROOT / 'apps/game/src/assets/shopping'

for manifest, destination in [('assets.json', BUILDINGS), ('scenery.json', COMMON)]:
    destination.mkdir(parents=True, exist_ok=True)
    for entry in json.loads((Path(__file__).parent / manifest).read_text()):
        image = Image.open(SOURCE / entry['source']).convert('RGBA').crop(entry['box'])
        # The overview atlas has a faint translucent background, unlike the building sheet.
        if floor := entry.get('alphaFloor'):
            image.putalpha(image.getchannel('A').point(lambda a: a if a >= floor else 0))
        if entry.get('largestComponent'):
            alpha = image.getchannel('A')
            pixels = alpha.load()
            visited = set()
            largest = []
            for y in range(image.height):
                for x in range(image.width):
                    if (x, y) in visited or not pixels[x, y]:
                        continue
                    component, stack = [], [(x, y)]
                    visited.add((x, y))
                    while stack:
                        px, py = stack.pop()
                        component.append((px, py))
                        for nx, ny in [(px-1, py), (px+1, py), (px, py-1), (px, py+1)]:
                            if 0 <= nx < image.width and 0 <= ny < image.height and (nx, ny) not in visited and pixels[nx, ny]:
                                visited.add((nx, ny))
                                stack.append((nx, ny))
                    if len(component) > len(largest):
                        largest = component
            mask = Image.new('L', image.size)
            for point in largest:
                mask.putpixel(point, 255)
            mask = mask.filter(ImageFilter.MaxFilter(3))
            image.putalpha(Image.composite(alpha, Image.new('L', image.size), mask))
        bounds = image.getchannel('A').getbbox()
        if not bounds:
            raise ValueError(f"Empty asset: {entry['key']}")
        image = image.crop(bounds)
        padded = Image.new('RGBA', (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        padded.save(destination / entry['file'], lossless=True, exact=True)

manifest_path = ROOT / 'tools/scenery/assets.json'
shared = json.loads(manifest_path.read_text())
additions = json.loads((Path(__file__).parent / 'scenery.json').read_text())
keys = {entry['key'] for entry in additions}
shared = [entry for entry in shared if entry['key'] not in keys]
shared.extend({**entry, 'source': f"shopping/{entry['source']}"} for entry in additions)
manifest_path.write_text(json.dumps(shared, indent=2) + '\n')
print('Exported shopping buildings and shared scenery')
