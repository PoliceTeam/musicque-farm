"""Crop the user's transparent material sheet without recoloring or regenerating art."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / 'source-art/materials-atlas.png'
TARGET = ROOT / 'apps/game/src/assets/jeweler'
BOXES = {
    'blue': (20, 30, 385, 425),
    'green': (385, 30, 718, 425),
    'purple': (720, 30, 1075, 425),
    'pink': (1075, 30, 1420, 425),
    'gold': (1420, 30, 1765, 425),
    'mystic': (175, 432, 640, 850),
    'stellar': (650, 432, 1100, 850),
    'celestial': (1110, 432, 1610, 855),
}
TARGET.mkdir(parents=True, exist_ok=True)
atlas = Image.open(SOURCE).convert('RGBA')
for key, box in BOXES.items():
    image = atlas.crop(box)
    bounds = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    image.crop(bounds).save(TARGET / f'{key}.webp', lossless=True, exact=True)
