"""Extract salon modules from the supplied transparent atlas, without regenerating artwork."""
import json
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
source = Image.open(ROOT / 'docs/art/salon/atlas.png').convert('RGBA')
output = ROOT / 'apps/game/src/assets/salon'
output.mkdir(parents=True, exist_ok=True)
for entry in json.loads((Path(__file__).parent / 'assets.json').read_text()):
    image = source.crop(entry['box'])
    if entry['key'] == 'counter':
        # The atlas separates both U-shaped wings from the central desk.
        # Join the supplied pieces without stretching their artwork or the employee.
        left = image.crop((0, 0, 60, image.height))
        right = image.crop((272, 0, image.width, image.height))
        image.paste((0, 0, 0, 0), (0, 0, 60, image.height))
        image.paste((0, 0, 0, 0), (272, 0, image.width, image.height))
        image.alpha_composite(left, (15, 0))
        image.alpha_composite(right, (257, 0))
    if entry.get('largestComponent'):
        alpha = image.getchannel('A')
        seen, largest = set(), []
        for y in range(image.height):
            for x in range(image.width):
                if (x, y) in seen or alpha.getpixel((x, y)) <= 24:
                    continue
                points, stack = [], [(x, y)]
                seen.add((x, y))
                while stack:
                    px, py = stack.pop()
                    points.append((px, py))
                    for nx, ny in [(px-1, py), (px+1, py), (px, py-1), (px, py+1)]:
                        if 0 <= nx < image.width and 0 <= ny < image.height and (nx, ny) not in seen and alpha.getpixel((nx, ny)) > 24:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
                if len(points) > len(largest):
                    largest = points
        mask = Image.new('L', image.size)
        for point in largest:
            mask.putpixel(point, 255)
        image.putalpha(Image.composite(alpha, Image.new('L', image.size), mask.filter(ImageFilter.MaxFilter(3))))
    if entry['key'] not in ['floor', 'wall', 'front-wall']:
        bounds = image.getchannel('A').getbbox()
        if not bounds:
            raise ValueError(entry['key'])
        image = image.crop(bounds)
        padded = Image.new('RGBA', (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        image = padded
    image.save(output / entry['file'], lossless=True, exact=True)
print('Exported salon modules')
