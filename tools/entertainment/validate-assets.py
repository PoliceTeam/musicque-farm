"""Regression checks for the neighbouring fragments reported in the scene screenshots."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'apps/game/src/assets/entertainment'
CHECKS = {
    'evergreen': (62, 0, 86, 25),  # stray paving block beside the tree tip
    'racing': (0, 0, 65, 5),      # neighbouring bush above the building
    'hall': (215, 98, 217, 153),  # isolated leaf outside the wall
    'cloud': (0, 68, 175, 72),    # unrelated skyline tip below the cloud
    'shrubs': (0, 43, 51, 46),    # yellow/brown roof edge beneath the bush
}
for key, rectangle in CHECKS.items():
    image = Image.open(ASSETS / f'{key}.webp')
    assert image.getchannel('A').crop(rectangle).getextrema() == (0, 0), f'{key}: neighbouring fragment remains'
print(f'Passed {len(CHECKS)} crop-fragment regression checks')

# The full support outline must have alpha padding on every side, so filtering cannot clip its feet.
billboard=Image.open(ASSETS / 'billboard.webp')
bbox=billboard.getchannel('A').point(lambda value: 255 if value > 24 else 0).getbbox()
assert bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<billboard.width and bbox[3]<billboard.height, 'billboard supports touch crop boundary'
print('Passed billboard support-padding check')

# The roof peak and the skyline silhouette need transparent padding above their tips.
for key in ['hall', 'skyline', 'cloud']:
    image = Image.open(ASSETS / f'{key}.webp')
    bbox = image.getchannel('A').point(lambda value: 255 if value > 24 else 0).getbbox()
    assert bbox and bbox[1] > 0, f'{key}: top silhouette is clipped'
print('Passed roof, skyline and cloud top-padding checks')
