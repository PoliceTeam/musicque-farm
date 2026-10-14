"""Lấy mẫu ảnh nhân vật nữ của người dùng (docs/art/female-reference-v1.png, nhân vật lớn bên trái)
về lưới native của game, từng ô một như lúc dựng nhân vật nam: không thu nhỏ trung bình, mỗi ô lấy
nhóm màu chiếm đa số trong ô (nét tối thắng khi chiếm >=40%) và giữ màu trung bình của nhóm đó.

Căn: đầu mẫu trùng tỉ lệ đầu gốc (3,47 px bảng = 1 px game; hai mắt mẫu khớp eyes.big x −9..10,
y −42). Chân mẫu dài hơn thân gốc nên phần dưới cằm (y > −27) ép dọc 36→27 hàng để đế giày về y 0.
"""
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'docs/art/female-reference-v1.png'
A = np.array(Image.open(SOURCE).convert('RGB')).astype(int)
S, X0, Y0, KB = 3.47, 141, 214, 36 / 27


def ref_y(y):
    yy = y if y <= -27 else -27 + (y + 27) * KB
    return Y0 + (yy + 42) * S


def pixels(x, y):
    x0, y0, y1 = X0 + (x + 9) * S, ref_y(y), ref_y(y + 1)
    a, b = int(round(y0)), max(int(round(y0)) + 1, int(round(y1)))
    return A[a:b, int(round(x0)):int(round(x0 + S))].reshape(-1, 3)


def classify(c):
    R, G, B = c[:, 0], c[:, 1], c[:, 2]
    lum = c.mean(1)
    k = np.full(len(c), 'o')                       # khác: vàng, xám…
    bg = (B > R + 5) & (lum < 80)
    k[bg] = '.'
    k[lum < 45] = 'K'                              # nét/viền tối
    skin = (R > 200) & (G > 140) & (B > 100) & (R - B > 45) & (G - B < 70)
    k[skin] = 'S'
    white = (lum > 200) & (np.abs(R - B) < 35)
    k[white] = 'W'
    dress = (R - G > 85) & (R > 150) & ~skin
    k[dress] = 'D'
    hair = (lum >= 45) & (lum < 175) & (R > G) & (R - G < 80) & (np.abs(G - B) < 30) & ~skin & ~dress & ~white & ~bg
    k[hair] = 'H'
    return k


def grid(x0=-48, x1=30, y0=-80, y1=1):
    """{(x, y): (nhóm, màu trung bình của nhóm trong ô)} cho vùng native đã cho."""
    out = {}
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = pixels(x, y)
            if not len(c): continue
            k = classify(c)
            if (k == 'K').mean() >= 0.4: lab = 'K'
            else:
                v, n = np.unique(k, return_counts=True); lab = v[n.argmax()]
            out[(x, y)] = (str(lab), c[k == lab].mean(0))
    return out


def tones(colors, n):
    """k-means đơn giản (không cần scipy) → n tâm màu xếp tối→sáng."""
    X = np.array(colors, float)
    C = X[np.linspace(0, len(X) - 1, n).astype(int)][np.argsort(X[np.linspace(0, len(X) - 1, n).astype(int)].sum(1))]
    for _ in range(40):
        lab = ((X[:, None] - C[None]) ** 2).sum(2).argmin(1)
        C = np.array([X[lab == i].mean(0) if (lab == i).any() else C[i] for i in range(n)])
    order = np.argsort(C.sum(1))
    return C[order]
