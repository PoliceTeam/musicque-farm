"""Reproduce six deterministic alpha-preserving atlas crops; no art edits."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'docs/art/farm-v5-shore-props-atlas.png').convert('RGBA')
config = json.loads((root / 'tools/farm-v5-slices.json').read_text())
destination = root / 'tools/.farm-export/extracted-v5'
destination.mkdir(parents=True, exist_ok=True)
for name, spec in config.items():
    sprite = source.crop(tuple(spec['sourceRect'])).crop(tuple(spec['trimRect']))
    assert sprite.size == (spec['width'], spec['height'])
    sprite.save(destination / f'{name}.png')
