# Ô icon góc "Nghiêng" (3/4 quay phải) của từng họ mũ trên bảng mẫu hat-sheet-v1.png.
from PIL import Image
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
im=Image.open(ROOT/'docs/art/hat-sheet-v1.png').convert('RGB')
FAM=[('cap','left',0),('beanie','right',0),('cat','left',1),('bunny','right',1),('wizard','left',2),('knight','right',2),('crown','left',3),('halo','right',3),('horns','left',4),('headset','right',4)]
LAB=[169,368,567,766,980]; TOP=[60,250,455,655,860]
CX={'left':[151,402,644],'right':[915,1165,1408]}
def box(f,lv):
    name,side,r=f; cx=CX[side][lv]
    return (cx-46,TOP[r]-25,cx+46,LAB[r]-12)
