"""Tóc nữ dài từ nhân vật mẫu: ô 'H' (nâu tóc) thuộc khối tóc chính + viền tối ngoài của nó.
Không lấy tròng mắt nâu, dây chuyền/khoá áo, ô của icon bên cạnh."""
import numpy as np
import reference as R

EYE_BOXES = [(-10, -3, -41, -33), (4, 10, -41, -33)]      # hai mắt mẫu (x0, x1, y0, y1)
TORSO = (-14, 8, -26, -9)                                  # thân váy áo
LETTERS = 'IhHGL'
DEFAULT = [(0x2c, 0x19, 0x20), (0x49, 0x30, 0x39), (0x67, 0x43, 0x4b), (0x8a, 0x5d, 0x62), (0xac, 0x7b, 0x7c)]  # Nâu hạt dẻ


def nb8(p):
    x, y = p
    return [(x + a, y + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b]


def nb4(p):
    x, y = p
    return [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]


def inside(p, box):
    return box[0] <= p[0] <= box[1] and box[2] <= p[1] <= box[3]


def cells(G):
    hair = {p for p, (l, c) in G.items() if l == 'H' and p[1] <= -10 and p[0] <= 24
            and not any(inside(p, b) for b in EYE_BOXES) and not inside(p, TORSO)}
    # khối chính: lan từ đỉnh đầu theo 8 hướng
    seed = min(hair, key=lambda p: (p[1], abs(p[0] + 4)))
    main, todo = {seed}, [seed]
    while todo:
        for q in nb8(todo.pop()):
            if q in hair and q not in main: main.add(q); todo.append(q)
    dark = {p for p, (l, c) in G.items() if l == 'K' and p[0] <= 24 and not inside(p, TORSO)
            and not any(inside(p, b) for b in EYE_BOXES)}
    # mảng bóng rất tối của tóc (sau gáy, dưới lọn) cũng là tóc: lan từ khối tóc qua các ô tối,
    # trừ ô tối là viền mặt/tai/áo (sát da, vải) và vùng mặt
    face = (-15, 11, -45, -26)
    dark = {p for p in dark if p[1] <= -11}
    shade, todo = set(), [p for p in dark if any(q in main for q in nb8(p))]
    while todo:
        p = todo.pop()
        if p in shade or inside(p, face): continue
        if any(G.get(q, ('.', 0))[0] in 'SDW' for q in nb4(p)): continue
        shade.add(p)
        todo += [q for q in nb8(p) if q in dark and q not in shade]
    edge = {p for p in shade if any(G.get(q, ('.', 0))[0] == '.' for q in nb8(p))}
    return main | (shade - edge), edge


def paint(G):
    """{(x,y): chữ} — 5 bậc tóc theo độ sáng màu nguồn, viền K."""
    main, dark = cells(G)
    # mỗi ô lấy bậc có độ sáng gần nhất với màu nguồn trên bảng màu tóc mặc định của nhân vật nữ
    # (Nâu hạt dẻ), nên màu mặc định trông như ảnh mẫu; đổi màu tóc vẫn đổi cả 5 bậc
    C = np.array(DEFAULT, float)
    lum = lambda c: (np.asarray(c, float) * [0.3, 0.55, 0.15]).sum(-1)
    out = {p: LETTERS[int(np.abs(lum(C) - lum(G[p][1])).argmin())] for p in main}
    out.update({p: 'K' for p in dark})
    # lỗ kín bên trong khối tóc -> bậc tối
    xs = [p[0] for p in out]; ys = [p[1] for p in out]
    for y in range(min(ys), max(ys) + 1):
        row = [x for x in range(min(xs), max(xs) + 1) if (x, y) in out]
        for x in range(min(row), max(row) + 1) if row else []:
            if (x, y) not in out and (x, y - 1) in out and (x, y + 1) in out and (x - 1, y) in out and (x + 1, y) in out:
                out[(x, y)] = 'h'
    return out, C


def fit(cells):
    """Keep the reference fringe; taper the long rear locks to the shared male skull.

    The sample's windblown tips extend 42px behind the origin, versus the male
    hair's 27px. Compress only behind the ear, fading in below the temple.
    Close sampling cracks there before drawing a single exterior contour.
    """
    out = {}
    for (x, y), c in sorted(cells.items()):
        strength = min(1, max(0, (y + 46) / 12))
        xx = -20 + round((x + 20) * (1 - .45 * strength)) if x < -20 else x
        # A source contour becomes shading after compression; redraw the edge last.
        if (xx, y) not in out or c != 'K': out[(xx, y)] = 'I' if c == 'K' else c

    # The rear curtain is solid. Thin open cracks in the sampled source are not
    # intentional face/ear openings; bridge them without flattening the outer locks.
    for y in range(-46, -9):
        xs = sorted(x for x, yy in out if yy == y and x < -17)
        for left, right in zip(xs, xs[1:]):
            if right - left <= 4:
                for x in range(left + 1, right): out[(x, y)] = 'I'

    # Fill enclosed transparent islands with strand shade (no image averaging).
    x0, x1 = min(x for x, y in out) - 1, max(x for x, y in out) + 1
    y0, y1 = min(y for x, y in out) - 1, max(y for x, y in out) + 1
    exterior, todo = set(), [(x0, y0)]
    while todo:
        p = todo.pop()
        if p in exterior or p in out or not (x0 <= p[0] <= x1 and y0 <= p[1] <= y1): continue
        exterior.add(p); todo.extend(nb4(p))
    for y in range(y0 + 1, y1):
        for x in range(x0 + 1, x1):
            if (x, y) not in exterior and (x, y) not in out: out[(x, y)] = 'h'
    return out


def contour(cells, silhouette):
    """Outline only the actual exterior, never the front/back layer split."""
    return {p: ('K' if any(q not in silhouette for q in nb4(p)) else c) for p, c in cells.items()}
