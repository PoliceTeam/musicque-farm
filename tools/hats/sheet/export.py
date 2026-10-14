"""Xuất bốn họ mũ từ atlas riêng sang sprite runtime (len Lv.1–3, phù thủy/vương miện/halo Lv.1–5).
Chạy trong game (cần numpy, scipy, Pillow): python3 tools/hats/sheet/export.py
Ghi các nhóm apps/game/src/assets/sprites/hats/*/sprites.txt và cập nhật các mục hat.<họ>.* trong packages/character-core/src/data/items.json
(không đụng họ hat.cap của tools/hats/build.py)."""
import json, re, numpy as np
from PIL import Image
from scipy import ndimage
import build
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from flaps import animate
from crops import ROOT
import importlib
sys.path.insert(0, str(ROOT / 'tools'))
sprite_source = importlib.import_module('sprite-source')
# hạt nhẹ cho Lv.3 (cùng nhịp với crystal của mũ lưỡi trai): vàng/cyan, đỏ cam, hồng trắng
EFFECT={'beanie':'cinder','cat':'blossom','wizard':'crystal','knight':'crystal',
        'crown':'crystal','halo':'crystal'}
# Include retired families so rerunning the exporter also removes old items.
MANAGED_FAMILIES=('beanie','cat','bunny','wizard','knight','crown','halo','horns','headset')
MAXC=24
_items={i['id']:i for i in json.load(open(ROOT/'packages/character-core/src/data/items.json',encoding='utf-8'))['items']}
_txt=sprite_source.read_sheet()
def _piece(n): return [r for r in _txt.split(f'@piece {n}\n')[1].split('\n\n')[0].split('\n') if r and not r.startswith('@')]
EYES={(e['poses']['0'][1]+i,e['poses']['0'][2]+j) for e in _items.values() if e['slot']=='eyes'
      for j,r in enumerate(_piece(e['poses']['0'][0])) for i,c in enumerate(r) if c!='.'}
def grid(fi,lv,base,gender=None):
    name,label,cx,bot,mode,sc=build.FAMS[fi]
    config=build.ATLASES.get(name,{})
    if gender and gender in config:
        bot=config[gender].get('bottomY',bot)
        cx=config[gender].get('centerX',cx)
    rgb,op,cv=build.native(fi,lv,gender)
    lab,k=ndimage.label(op,structure=np.ones((3,3))); sz=ndimage.sum(op,lab,range(1,k+1))
    op&=np.isin(lab,[i+1 for i,v in enumerate(sz) if v>=5])          # bỏ mảnh vụn rời
    count=48 if name in ('wizard','crown','halo') else 32 if name in build.ATLASES else MAXC
    if name=='beanie': base=0xe600+lv*count
    if name=='beanie' and gender=='female': base=0xec00+lv*count
    if name=='wizard': base=0xe700+lv*count
    if name=='crown': base=0xe800+lv*count
    if name=='halo': base=0xe900+lv*count
    # Preserve small blue jewels and gold accents instead of allocating every
    # shade to the much larger purple cloth surface.
    method=Image.Quantize.MAXCOVERAGE if name in ('wizard','crown','halo') else Image.Quantize.MEDIANCUT
    q=Image.fromarray(rgb).quantize(colors=count,method=method,dither=Image.Dither.NONE); idx=np.array(q); pal=q.getpalette()[:count*3]
    chars=[chr(base+i) for i in range(count)]
    colours={chars[i]:'#'+bytes(pal[i*3:i*3+3]).hex() for i in range(count)}
    H,W=op.shape; dx,dy=int(cx-W//2),int(bot-H+1)
    brim_row=None
    higher=build.ATLASES.get(name,{}).get('higherLevels')
    if higher and lv+1>=higher['firstLevel'] and 'brimRows' in higher:
        brim_row=higher['brimRows'][lv+1-higher['firstLevel']]
        # Ribbons extend below the brim: attach at the brim instead of the
        # bounding-box bottom so added tassels do not lift the hat off the head.
        dy=bot-brim_row
    if mode=='hood' and cv.any():
        yy,xx=np.where(cv); dy=int(-52-yy.min()); dx=int(-2-round((xx.min()+xx.max())/2))
    if mode in ('hood','visor'):
        # A continuous arched opening leaves the fringe and temples visible.
        # Never punch individual eye-shaped holes into a closed faceplate.
        for y in range(H):
            for x in range(W):
                wx,wy=dx+x,dy+y
                top=-52 if mode=='hood' else -50
                half=min(19,12+max(0,wy-top))
                if wy>=top and -half<=wx<=half: op[y,x]=False
                if mode=='hood' and wy>-35: op[y,x]=False
    if name=='crown' and name not in build.ATLASES:
        # Anchor the broad lower band, not the pendant hanging below it.
        band=np.where(op.sum(axis=1)>=W*0.45)[0]
        if len(band): dy=-57-int(band.max())
    rows=[''.join(chars[idx[y,x]] if op[y,x] else '.' for x in range(op.shape[1])) for y in range(op.shape[0])]
    hb=(brim_row-5 if brim_row is not None else H-6) if mode=='brim' else -52-dy if mode in('hood','visor') else None
    used={ch for r in rows for ch in r if ch!='.'}
    return rows,{c:v for c,v in colours.items() if c in used},dx,dy,hb
pieces,palette,defs={}, {}, []
for n,fi in enumerate(build.FAMS):
    name,label=build.FAMS[fi][:2]
    for lv in range(1,build.ATLASES.get(name,{}).get('levels',3)+1):
        for gender in (None,'female') if 'female' in build.ATLASES.get(name,{}) else (None,):
            rows,cols,dx,dy,hb=grid(fi,lv-1,0xe300+(n*3+lv-1)*MAXC,gender); palette.update(cols)
            animation, settings = animate(f'hat.{name}.{lv}', rows)
            W=len(rows[0])
            for extra in (0,2,4,6):
                iid=f'hat.{name}.{lv}'+(f'.{gender}' if gender else '')+(f'.w{extra}' if extra else '')
                # mặt rộng: nhân đôi vài cột giữa thân mũ (như mũ lưỡi trai), vật trang trí hai bên giữ nguyên
                cols_=set(round(W*0.35+i*(W*0.3)/max(1,extra-1)) for i in range(extra))
                pieces[iid]=[''.join(ch*(2 if x in cols_ else 1) for x,ch in enumerate(r)) for r in rows]
                if build.FAMS[fi][4] in ('hood','visor'):
                    ox,oy=dx-extra//2,dy
                    pieces[iid]=[''.join('.' if (ox+x,oy+y) in EYES else ch for x,ch in enumerate(r)) for y,r in enumerate(pieces[iid])]
                for suffix, frame in animation.items():
                    pieces[iid + suffix] = [''.join(ch*(2 if x in cols_ else 1) for x,ch in enumerate(r)) for r in frame]
                it={'id':iid,'label':f'{label} Lv.{lv}','slot':'hat','layer':55}
                it.update(settings)
                if hb is not None: it['hairBelow']=hb
                it['poses']={str(p):[iid,dx-extra//2,dy+(1 if p else 0)] for p in range(4)}
                if lv>=3: it['effect']='arcane' if name=='wizard' and lv>=4 else EFFECT[name]
                if gender: it['gender']=gender
                if extra or gender: it['hidden']=True
                else: it.update(family=f'hat.{name}',level=lv)
                defs.append(it)
text='@palette\n'+'\n'.join(f'{c} {v}' for c,v in palette.items())+'\n\n'
text+='\n\n'.join('@piece '+k+'\n'+'\n'.join(r) for k,r in pieces.items())+'\n'
sprite_source.write_sheet(text, 'hat-families')
p=ROOT/'packages/character-core/src/data/items.json'; t=p.read_text(encoding='utf-8')
fams='|'.join(MANAGED_FAMILIES)
t=re.sub(r'^  \{"id": "hat\.(?:'+fams+r')\.[^\n]+\n','',t,flags=re.M)
t=re.sub(r',(\s*\n \]\s*\n\})',r'\1',t)
new=',\n'.join('  '+json.dumps(i,ensure_ascii=False) for i in defs)
t=re.sub(r'(\n \]\s*\n\})',lambda m:',\n'+new+m[1],t)
json.loads(t); p.write_text(t,encoding='utf-8')
print(f'Exported {len(defs)//4} hats, each with 4 face widths.')
