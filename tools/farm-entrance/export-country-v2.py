"""Extract independent props from the user's second countryside atlas, without repainting."""
import json
from pathlib import Path

from collections import deque
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
ATLAS = SOURCE / 'source-art/country-v2-atlas.png'
COMMON = ROOT / 'apps/game/src/assets/common/scenery'
FEATURE = ROOT / 'apps/game/src/assets/farm-entrance'
entries = json.loads((SOURCE / 'country-v2.json').read_text())
atlas = Image.open(ATLAS).convert('RGBA')
registry_path = ROOT / 'tools/scenery/assets.json'
registry = json.loads(registry_path.read_text())
new_registry = []

for entry in entries:
    image = atlas.crop(entry['box'])
    alpha = bytearray(image.getchannel('A').tobytes())
    for index, value in enumerate(alpha):
        if value < 140:
            alpha[index] = 0
    if polygon := entry.get('polygon'):
        mask = Image.new('L', atlas.size)
        ImageDraw.Draw(mask).polygon([tuple(point) for point in polygon], fill=255)
        for index, value in enumerate(mask.crop(entry['box']).tobytes()):
            if not value:
                alpha[index] = 0
    # Keep the selected object's connected silhouette, dropping neighboring fragments and halo noise.
    width, height = image.size
    pending = bytearray(1 if value else 0 for value in alpha)
    largest = []
    for start, present in enumerate(pending):
        if not present:
            continue
        component = []
        queue = deque([start])
        pending[start] = 0
        while queue:
            index = queue.popleft()
            component.append(index)
            x, y = index % width, index // width
            for ny in range(max(0, y - 1), min(height, y + 2)):
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = ny * width + nx
                    if pending[neighbor]:
                        pending[neighbor] = 0
                        queue.append(neighbor)
        if len(component) > len(largest):
            largest = component
    cleaned = bytearray(len(alpha))
    for index in largest:
        cleaned[index] = alpha[index]
    image.putalpha(Image.frombytes('L', image.size, bytes(cleaned)))
    bounds = image.getbbox()
    if not bounds:
        raise ValueError(f"Empty crop: {entry['key']}")
    image = image.crop(bounds)
    destination = COMMON if entry.get('scenery') else FEATURE
    image.save(destination / f"{entry['key']}.webp", lossless=True, exact=True)
    if entry.get('scenery'):
        new_registry.append({
            'key': entry['key'],
            'file': f"{entry['key']}.webp",
            'source': 'farm-entrance/source-art/country-v2-atlas.png',
            'box': entry['box'], 'alphaFloor': 140, 'largestComponent': True, 'trim': True,
        })
keys = {entry['key'] for entry in new_registry}
registry = [entry for entry in registry if entry['key'] not in keys]
registry_path.write_text(json.dumps([*registry, *new_registry], indent=2) + '\n')
