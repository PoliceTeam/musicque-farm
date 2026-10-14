"""Native hair variants sampled from the isolated layers in the user's reference.
The checked-in crop/anchor configuration keeps every export reproducible.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image
import hair, reference

PALETTE = {'': '#ef8d9f', '': '#b84b65'}


def sample(spec):
    crop = Image.open(reference.SOURCE).convert('RGB').crop(tuple(spec['crop']))
    rgb = np.asarray(crop).astype(float)
    # The reference panels are cool slate; hair is warm, outline nearly black.
    alpha = ((rgb[:, :, 0] - rgb[:, :, 1] > 7) | (rgb.mean(2) < 27))
    mask = Image.fromarray((alpha * 255).astype('uint8'))
    bbox = mask.getbbox()
    if not bbox: raise ValueError('Empty hair crop')
    crop, mask = crop.crop(bbox), mask.crop(bbox)
    # Classify source clusters before reducing, preserving thin highlights/strands.
    rgb = np.asarray(crop).astype(float)
    lum = (rgb * [0.3, 0.55, 0.15]).sum(2)
    tones = (np.asarray(hair.DEFAULT) * [0.3, 0.55, 0.15]).sum(1)
    labels = np.abs(lum[:, :, None] - tones).argmin(2)
    size = (spec['width'], spec['height'])
    coverage = []
    for i in range(5):
        layer = Image.fromarray(((labels == i) * np.asarray(mask)).astype('uint8'))
        coverage.append(np.asarray(layer.resize(size, Image.Resampling.BOX)))
    labels = np.asarray(coverage).argmax(0)
    alpha = np.asarray(mask.resize(size, Image.Resampling.BOX)) >= 100
    x0, y0 = spec['origin']
    out = {(x0 + x, y0 + y): hair.LETTERS[labels[y, x]]
           for y in range(size[1]) for x in range(size[0]) if alpha[y, x]}
    if spec.get('tie'):
        pink = (rgb[:, :, 0] > 150) & (rgb[:, :, 0] - rgb[:, :, 1] > 65)
        accent = np.asarray(Image.fromarray((pink * 255).astype('uint8')).resize(size, Image.Resampling.BOX))
        for p in out:
            x, y = p[0] - x0, p[1] - y0
            if accent[y, x] >= 50: out[p] = '' if accent[y, x] >= 140 else ''
    return out


def variants():
    for spec in json.loads((Path(__file__).parent / 'hair-styles.json').read_text()):
        full = sample(spec['front'])
        if 'back' in spec:
            front, back = full, sample(spec['back'])
        else:
            # Ponytail is on the near/rear side; it must sit behind the face/body.
            front = {p: c for p, c in full.items() if p[0] >= -25 and p[1] <= -34}
            back = full
        yield spec['id'], spec['label'], front, back
