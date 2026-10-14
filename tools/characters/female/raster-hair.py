"""Quantize painted lock clusters before native reduction, like the male atlas.
The atlas owns the design; this exporter only samples, anchors and splits layers.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image
import hair

CONFIG = json.loads((Path(__file__).parent / 'raster-styles.json').read_text())
ROOT = Path(__file__).resolve().parents[3]


def sample(spec):
    source = Image.open(ROOT / spec.get('atlas', CONFIG['atlas'])).convert('RGBA').crop(tuple(spec['crop']))
    box = source.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    if not box: raise ValueError(f"Empty raster hair: {spec['id']}")
    source = source.crop(box)
    rgb = np.asarray(source)[:, :, :3].astype(float)
    alpha = np.asarray(source)[:, :, 3] >= 128
    tones = np.array(spec.get('tones', CONFIG['tones']), float)
    labels = ((rgb[:, :, None] - tones) ** 2).sum(3).argmin(2)
    size = tuple(spec['size'])
    masks = [np.asarray(Image.fromarray(((labels == i) & alpha).astype('uint8') * 255).resize(size, Image.Resampling.BOX)) for i in range(5)]
    coverage = np.asarray(masks)
    labels = coverage.argmax(0)
    # Keep real shadow separation instead of averaging it into the midtone.
    labels[(labels >= 2) & (coverage[0] >= 64)] = 0
    labels[(labels == 3) & (coverage[4] >= 64)] = 4
    mask = np.asarray(Image.fromarray(alpha.astype('uint8') * 255).resize(size, Image.Resampling.BOX)) >= 110
    x0, y0 = spec['origin']
    # Align the transparent face opening to the shared eyes/skull, not the
    # bounding box of the rear curtain or raised ponytail. Apply to both layers.
    x0 += spec.get('face_shift_x', 0)
    cells = {(int(x) + x0, int(y) + y0): hair.LETTERS[labels[y, x]] for y, x in zip(*np.where(mask))}
    if spec.get('tie') or spec.get('accent'):
        pink = alpha & (rgb[:, :, 0] > 140) & (rgb[:, :, 0] - rgb[:, :, 1] > 45) & (rgb[:, :, 2] > rgb[:, :, 1] * .9)
        accent = np.asarray(Image.fromarray(pink.astype('uint8') * 255).resize(size, Image.Resampling.BOX))
        for p in cells:
            amount = accent[p[1] - y0, p[0] - x0]
            if amount >= 90: cells[p] = '' if amount >= 170 else ''
    # Validate the face aperture before the builder fills scalp gaps or removes
    # eye pixels: those repairs must not conceal a misaligned source anchor.
    row = sorted(x for x, y in cells if y == -36)
    openings = [(a + 1, b - 1) for a, b in zip(row, row[1:]) if b - a > 8]
    if not openings: raise ValueError(f"{spec['id']}: no face opening at eye height")
    left, right = max(openings, key=lambda span: span[1] - span[0])
    if abs((left + right) / 2 + 1) > 2:
        raise ValueError(f"{spec['id']}: align face opening {left}..{right} to shared skull axis x=-1")
    return cells


def variants():
    for spec in CONFIG['styles']:
        full = sample(spec)
        # Long/side locks are behind the face and shoulders. Bangs and upper
        # temples stay in front; the builder seals the shared skull and eyes.
        front = {p: c for p, c in full.items() if p[1] <= -39 or (p[0] >= 10 and p[1] <= -28)}
        if spec.get('tie'):
            front = {p: c for p, c in front.items() if p[0] >= -25 and p[1] >= -65}
        yield spec['id'], spec['label'], front, full


def hat_tie():
    """Retain the original upper ponytail behind the hat without reshaping it."""
    spec = next(s for s in CONFIG['styles'] if s.get('tie'))
    full = sample(spec)
    # Keep native coordinates, shading, the complete rounded top and ribbon.
    # Continue down to the brim so the exposed root joins its original tail.
    return {(x, y): c for (x, y), c in full.items()
            if y <= -49 and x <= -13 - max(0, y + 61)}
