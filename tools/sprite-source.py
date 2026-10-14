"""Read/write item-grouped sprite sources. No raster processing or geometry changes."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / 'apps/game/src/assets/sprites'


def parse(text):
    palette, pieces = {}, {}
    section = None
    for line in text.splitlines():
        if not line.strip():
            section = None
        elif line.startswith('#'):
            continue
        elif line == '@palette':
            section = 'palette'
        elif line.startswith('@piece '):
            name = line[7:].strip()
            if name in pieces:
                raise ValueError(f'duplicate piece: {name}')
            pieces[name] = []
            section = name
        elif section == 'palette':
            letter, color = line.split()
            if letter in palette and palette[letter] != color:
                raise ValueError(f'conflicting palette: {letter}')
            palette[letter] = color
        elif section:
            pieces[section].append(line)
        else:
            raise ValueError('pixels outside piece')
    return palette, pieces


def namespace(path):
    return path.parts[0] if path.parts[0] in ('pets', 'scenery') else 'character'


def group(name):
    parts = name.split('.')
    prefix, family = parts[0], parts[1] if len(parts) > 1 else 'basic'
    family = re.sub(r'(?<!^)(?=[A-Z])', '-', family).lower()
    if prefix == 'hair': return f'hair/{family}/sprites.txt'
    if prefix == 'hat': return f'hats/{"witch" if family == "wizard" else family}/sprites.txt'
    if prefix == 'wings': return f'accessories/wings/{family}/sprites.txt'
    if prefix == 'pet': return f'pets/{family}/sprites.txt'
    if prefix in ('held', 'tail'): return f'accessories/{"held" if prefix == "held" else "tails"}/{family}/sprites.txt'
    if prefix in ('body', 'head', 'face', 'eyes', 'mouth', 'nose', 'hand'):
        return f'characters/{"female" if family == "female" else "shared"}/{prefix}/sprites.txt'
    if prefix in ('sticker', 'mouthacc'): return f'accessories/{prefix}/{family}/sprites.txt'
    if prefix in ('shirt', 'pants', 'shoes', 'wrist', 'boots', 'sandal'):
        return f'outfits/{"goku" if family == "goku" else "female-basic" if family == "female" else "basic"}/{prefix}/sprites.txt'
    return f'scenery/{prefix}/sprites.txt'


def render(palette, pieces):
    text = '@palette\n' + '\n'.join(f'{k} {v}' for k, v in palette.items()) + '\n\n' if palette else ''
    return (text + '\n\n'.join('@piece ' + name + '\n' + '\n'.join(rows) for name, rows in pieces.items())).rstrip() + '\n'


def read_sheet(kind='character', root=ROOT):
    palette, pieces = {}, {}
    for path in sorted(root.rglob('*.txt')):
        if namespace(path.relative_to(root)) != kind: continue
        colors, grids = parse(path.read_text(encoding='utf-8'))
        for letter, color in colors.items():
            if letter in palette and palette[letter] != color:
                raise ValueError(f'{path}: conflicting palette {letter}')
            palette[letter] = color
        for name, rows in grids.items():
            if name in pieces: raise ValueError(f'{path}: duplicate piece {name}')
            pieces[name] = rows
    return render(palette, pieces)


def write_sheet(text, palette_name, kind='character', root=ROOT, managed_prefixes=None):
    palette, pieces = parse(text)
    if managed_prefixes:
        pieces = {name: rows for name, rows in pieces.items() if name.startswith(tuple(managed_prefixes))}
    grouped = {}
    for name, rows in pieces.items():
        grouped.setdefault(group(name), {})[name] = rows
    palette_path = f'palettes/{palette_name}.txt' if kind == 'character' else f'{kind}/palette.txt'
    if managed_prefixes and (root / palette_path).exists():
        previous, _ = parse((root / palette_path).read_text(encoding='utf-8'))
        used = {letter for rows in pieces.values() for row in rows for letter in row if letter != '.'}
        palette = {letter: color for letter, color in palette.items() if letter in previous or letter in used}
    outputs = {palette_path: render(palette, {})} if palette else {}
    # Each group includes all frames/width variants, sharing its namespace palette.
    outputs.update({path: render({}, grids) for path, grids in grouped.items()})
    for relative, content in outputs.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or path.read_text(encoding='utf-8') != content:
            path.write_text(content, encoding='utf-8')
