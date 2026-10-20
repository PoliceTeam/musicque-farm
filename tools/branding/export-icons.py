#!/usr/bin/env python3
"""Export the Chibi Town favicon, app icons and share images from the supplied artwork.

Browsers, iOS and social crawlers need ICO/PNG here, so these files are the documented PNG exception to the
WebP runtime rule. Run from the repository root: python3 tools/branding/export-icons.py
"""

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / 'source-art'
PUBLIC = ROOT / 'apps/game/public/icons'

# Files live in public/ and are declared in app/layout.tsx metadata: app/ icon files would become
# route handlers whose generated type validator fails this repo's noUnusedLocals.
# The head-and-shoulders crop reads at tab size; the farm scene is for previews where there is room.
face = Image.open(SOURCE / 'icon-face.png').convert('RGB')
scene = Image.open(SOURCE / 'icon-scene.png').convert('RGB')


def square(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'PNG', optimize=True)


def share_image() -> Image.Image:
    """1200x630 card: the scene blurred as backdrop, the full square artwork centred on top."""
    width, height = 1200, 630
    cover = scene.resize((width, width), Image.Resampling.LANCZOS)
    top = (width - height) // 2
    canvas = cover.crop((0, top, width, top + height)).filter(ImageFilter.GaussianBlur(18))
    canvas = Image.blend(canvas, Image.new('RGB', canvas.size, (24, 40, 64)), 0.25)
    art = square(scene, 560)
    shadow = Image.new('RGBA', (art.width + 40, art.height + 40), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 110), (20, 24, art.width + 20, art.height + 24))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    left, offset = (width - art.width) // 2, (height - art.height) // 2
    canvas.paste(shadow, (left - 20, offset - 20), shadow)
    canvas.paste(art, (left, offset))
    return canvas


ICO_SIZES = [(16, 16), (32, 32), (48, 48)]
PUBLIC.mkdir(parents=True, exist_ok=True)
square(face, 256).save(PUBLIC.parent / 'favicon.ico', format='ICO', sizes=ICO_SIZES)
for size in (32, 192, 512):
    save_png(square(face, size), PUBLIC / f'icon-{size}.png')
save_png(square(face, 180), PUBLIC / 'apple-touch-icon.png')
save_png(share_image(), PUBLIC / 'share.png')
print('Exported favicon.ico, icons/icon-{32,192,512}.png, icons/apple-touch-icon.png and icons/share.png.')
