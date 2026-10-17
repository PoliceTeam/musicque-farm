"""Export individual race props from the retained source; never bake a complete runtime map."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
source = Image.open(root / 'tools/pet-racing/source/race-ground-v2.png').convert('RGB')
target = root / 'apps/game/src/assets/pet-racing'
for part in json.loads((root / 'tools/pet-racing/parts.json').read_text()):
    image = Image.open(root / 'tools/pet-racing/source' / part['source']).convert('RGB') if 'source' in part else source
    image.crop(part['box']).save(target / (part['key'] + '.webp'), format='WEBP', lossless=True, method=6)
legacy = target / 'race-ground-v2.webp'
if legacy.exists():
    legacy.unlink()
print('Exported independent race props')
