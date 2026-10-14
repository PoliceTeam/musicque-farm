"""Mắt nữ từ nhân vật mẫu: mi trên dày (E), con ngươi tối (C) và tròng (B/b) đổi được theo màu mắt,
đốm sáng trắng (W). Da để trống cho đầu gốc hiện ra."""
import numpy as np

# Keep the eye apertures on the shared skull. The wider reference crop also
# sampled dark hair/face edges beside both eyes, creating a cheek-side stroke
# and a detached vertical mark below the far eye when equipped without hair.
BOXES = [(-9, -3), (5, 9)]
Y0, Y1 = -42, -34


def eyes(G):
    rows = []
    for y in range(Y0, Y1 + 1):
        row = ''
        for x in range(BOXES[0][0], BOXES[1][1] + 1):
            if not any(a <= x <= b for a, b in BOXES): row += '.'; continue
            lab, c = G[(x, y)]
            lum = c.mean()
            if lab == 'W': row += 'W'
            elif lab == 'K': row += 'E' if y <= -40 else 'C'
            elif lab == 'H' and y >= -37: row += 'B' if lum < 65 else 'b'   # tròng; trên đó là mái tóc
            else: row += '.'
        rows.append(row)
    return rows, BOXES[0][0], Y0
