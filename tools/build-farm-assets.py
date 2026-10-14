"""Reproduce runtime WebPs from preserved atlases and explicit usage manifest.

Requires Pillow with WebP support. Intermediate PNG slices never ship to the app.
"""
from pathlib import Path
import json
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EXPORTERS = [
    'export-farm-v4.py', 'export-farm-v5.py', 'export-farm-v6.py',
    'export-farm-v9-crops.py', 'export-farm-animals.py',
    'export-farm-v21-crops.py', 'export-farm-v22-food.py', 'export-farm-v23-reference.py',
]
for exporter in EXPORTERS:
    subprocess.run([sys.executable, str(ROOT / 'tools' / exporter)], check=True, cwd=ROOT)
manifest = json.loads((ROOT / 'tools/farm-runtime-assets.json').read_text())
destination = ROOT / 'apps/game/src/assets/farm'
keys, files = set(), set()
for entry in manifest:
    assert entry['key'] not in keys and entry['file'] not in files
    keys.add(entry['key'])
    files.add(entry['file'])
    source = ROOT / 'tools/.farm-export' / entry['source']
    original = Image.open(source).convert('RGBA')
    output = destination / entry['file']
    output.parent.mkdir(parents=True, exist_ok=True)
    original.save(output, format='WEBP', lossless=True, method=6, exact=True)
    decoded = Image.open(output).convert('RGBA')
    assert original.size == decoded.size and original.tobytes() == decoded.tobytes(), entry['key']
# Remove only obsolete generated derivatives, never preserved source artwork.
for output in destination.rglob('*.webp'):
    if output.relative_to(destination).as_posix() not in files:
        output.unlink()
print(f'Built {len(files)} lossless runtime WebPs; RGBA verified.')
