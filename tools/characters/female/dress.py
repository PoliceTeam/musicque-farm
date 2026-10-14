"""Váy liền theo ảnh mẫu, vẽ thẳng trên thân gốc (không thu nhỏ ảnh): tay phồng viền trắng,
cổ trắng gọn + mặt dây vàng, khoá kéo giữa thân, đai eo, chân váy xoè có diềm trắng.
Bảng chữ áo: T sáng, t, V, Y tối, Z viền; váy: N sáng, P, p, D viền; W trắng."""
GOLD, ZIP = '', ''
TORSO = (-9, 5)          # cột thân giữa hai đường nối tay của thân gốc


def nb4(p):
    x, y = p
    return [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]


def shirt(body):
    out = {}
    for (x, y), c in body.items():
        if not -27 <= y <= -17: continue
        arm = x < TORSO[0] or x > TORSO[1]
        if arm and y > -22: continue                      # tay áo ngắn tới hàng −22
        # hồng mâm xôi như mẫu: nền t, phía lưng V, sáng T ở ngực/vai trước
        if arm: out[(x, y)] = 'W' if y == -22 else ('V' if x < TORSO[0] else ('T' if y <= -25 else 't'))
        else: out[(x, y)] = 'V' if x <= -6 else ('T' if 0 <= x <= 2 and y <= -20 else 't')
    # tay phồng: phình 1 ô ra ngoài ở giữa tay áo
    for y in (-25, -24, -23):
        row = [x for x, yy in out if yy == y]
        out[(min(row) - 1, y)] = 'V'; out[(max(row) + 1, y)] = 't'
    # nếp dưới tay áo và đường nối
    for y in range(-26, -21):
        for x in (TORSO[0] - 1, TORSO[1] + 1):
            if (x, y) in out and out[(x, y)] != 'W': out[(x, y)] = 'V'
    # Compact round collar from v6: a clean rim, a separate pendant and placket.
    for x, y in [(-6,-26),(-5,-25),(-4,-25),(-3,-25),(-2,-25),(-1,-25),(0,-26)]:
        out[(x,y)] = 'W'
    for x in range(-5,0): out.pop((x,-26), None)
    out[(-3,-24)] = GOLD
    for y in range(-23,-17):
        out[(-3,y)] = ZIP
        out[(-2,y)] = 'T'
    # Small connected shoulder/chest planes, not scattered bright pixels.
    for p in [(-7,-24),(-7,-23),(-6,-23),(2,-24),(3,-24),(3,-23)]:
        if p in out: out[p] = 'T'
    for y in (-21,-20,-19):
        if (4,y) in out: out[(4,y)] = 'V'
    for x in range(TORSO[0],TORSO[1]+1): out[(x,-17)] = 'Y'
    out[(-3,-17)] = GOLD
    # viền ngoài
    res = dict(out)
    for p, c in out.items():
        if c != 'W' and any(q not in out and q not in body for q in nb4(p)): res[p] = 'Z'
    return res


def skirt(body):
    out = {}
    for i, y in enumerate(range(-16, -9)):
        left, right = TORSO[0] - 1 - (i + 1) // 2, TORSO[1] + 1 + (i + 1) // 2
        for x in range(left, right + 1):
            if body.get((x, y), '.') in 'Sskn' and (x < TORSO[0] or x > TORSO[1]): continue   # chừa bàn tay
            # Pleats fan out continuously from the waist, with a dark groove
            # and one lit fold face. They do not zigzag as each row widens.
            fold = round((x + 2) / (1 + i * .045)) % 4
            if y >= -11:
                c = ZIP if y == -11 and fold == 0 else ('N' if y == -10 and fold == 0 else 'W')
            else: c = ['D','p','P','N'][fold]
            out[(x, y)] = c
    res = dict(out)
    for p, c in out.items():
        if any(q not in out and q not in body for q in nb4(p)) or p[0] in (min(x for x, yy in out if yy == p[1]), max(x for x, yy in out if yy == p[1])):
            res[p] = 'D' if p[1] < -11 else res[p]
    for x in range(TORSO[0] - 1, TORSO[1] + 2): res[(x, -16)] = 'D' if (x, -16) in res else res.get((x, -16))
    return {p: c for p, c in res.items() if c}


def shoes(rows):
    """Giày gốc của từng pose: 2 hàng vải trên cùng mỗi cột thành tất trắng, còn lại giày hồng."""
    rows = [list(r) for r in rows]
    for x in range(len(rows[0])):
        cloth = [y for y, r in enumerate(rows) if r[x] in 'OoQ']
        for y in cloth[:2]:
            rows[y][x] = 'W'
        if len(cloth) > 2:
            rows[cloth[2]][x] = 'O'  # preserve the lit pink toe below the white sock
        if len(cloth) > 4:
            rows[cloth[-1]][x] = 'Q'  # sole stays readable in every walking pose
    return [''.join(r) for r in rows]
