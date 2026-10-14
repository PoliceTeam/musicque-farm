"""Small silhouette/cluster refinements on the accepted female hair sources.
All shape changes live in finish.json; source artwork and eye anchors stay intact.
"""
from pathlib import Path
import json
from statistics import median
import hair
CONFIG = json.loads((Path(__file__).parent / 'finish.json').read_text())


def refine(cells):
    out = {}
    for (x, y), c in sorted(cells.items()):
        # Shrink around the skull axis, keeping the forehead attachment at y=-46.
        xx = -3 + round((x + 3) * CONFIG['width_scale'])
        yy = -46 + round((y + 46) * CONFIG['crown_scale']) if y < -46 else y
        if x < -20:
            strength = min(1, max(0, (y + 46) / 12))
            xx -= round((x + 20) * (1 - CONFIG['tail_scale']) * strength)
        if (xx, yy) not in out or c != 'K': out[(xx, yy)] = c
    if not CONFIG['clean_clusters']: return out
    original = dict(out)
    for p, c in original.items():
        if c not in hair.LETTERS: continue
        nearby = [original[q] for q in hair.nb8(p) if original.get(q, ".") in hair.LETTERS]
        if len(nearby) < 6: continue  # preserve shading at silhouettes and locks
        if nearby.count(c) < 2:
            out[p] = hair.LETTERS[round(median([hair.LETTERS.index(v) for v in nearby]))]
        elif c == 'h' and sum(v in 'HGL' for v in nearby) >= 6:
            out[p] = 'H'  # close small nicks inside a lit strand cluster
    return out


def outline(cells):
    # Recolourable darkest hair tone is softer than the fixed black character ink.
    return {p: ('I' if c == 'K' else c) for p, c in cells.items()} if CONFIG['soft_outline'] else cells
