# Mũ từ bảng mẫu của người dùng (cột "Nghiêng" = góc 3/4 quay phải như nhân vật): tách nền, khoét lòng
# mũ trùm/mũ giáp để lộ mặt, thu về lưới native, giữ màu nguồn (lượng tử hoá riêng từng mũ).
import json, numpy as np
from pathlib import Path
from PIL import Image
from scipy import ndimage
import seg
from crops import ROOT
BEANIE=json.loads((Path(__file__).resolve().parents[1]/'beanie.json').read_text())
WIZARD=json.loads((Path(__file__).resolve().parents[1]/'wizard.json').read_text())
CROWN=json.loads((Path(__file__).resolve().parents[1]/'crown.json').read_text())
HALO=json.loads((Path(__file__).resolve().parents[1]/'halo.json').read_text())
ATLASES={'beanie':BEANIE,'wizard':WIZARD,'crown':CROWN,'halo':HALO}
S=0.667   # tỉ lệ chung: mũ lưỡi trai trên bảng rộng ~75px, bản runtime 50px
# họ: (nhãn, tâm x, đáy y, cách ghép tóc, tỉ lệ riêng)
FAMS={1:('beanie','Mũ len',BEANIE['centerX'],BEANIE['bottomY'],'brim',1.0),
      4:('wizard','Mũ pháp sư',WIZARD['centerX'],WIZARD['bottomY'],'brim',1.0),
      6:('crown','Vương miện',CROWN['centerX'],CROWN['bottomY'],'open',1.0),
      7:('halo','Halo',HALO['centerX'],HALO['bottomY'],'ring',1.0)}
def ring(a,m):
    # halo: lòng vòng là nền (bị lấp khi tách) -> trong suốt
    # và quầng sáng mờ quanh vòng (pixel tối không sát nét sáng) -> bỏ, chỉ giữ viền 1px quanh vàng/cánh
    lum=a.mean(2); bright=ndimage.binary_dilation(m&(lum>=110),iterations=2)
    return m&(lum<55)&~bright
def visor(a,m):
    # mũ giáp: khe tối giữa các nan che mặt -> trong suốt (mắt nhìn qua nan); viền ngoài giữ nguyên
    lum=a.mean(2); inner=ndimage.binary_erosion(m,iterations=3)
    ys,xs=np.where(m); y0,y1=ys.min(),ys.max(); x0,x1=xs.min(),xs.max()
    zone=np.zeros_like(m); zone[y0+int((y1-y0)*0.35):y1-2, x0:x0+int((x1-x0)*0.62)]=True
    R,G,B=a[...,0],a[...,1],a[...,2]
    c=inner&zone&((lum<58)|((lum<120)&(R-G>30)&(B-G>-4)))
    lab,k=ndimage.label(c); sz=ndimage.sum(c,lab,range(1,k+1))
    return np.isin(lab,[i+1 for i,v in enumerate(sz) if v>=6])
def cavity(a,m,visor_=False):
    lum=a.mean(2); R,G,B=a[...,0],a[...,1],a[...,2]
    # lòng mũ trùm/mũ giáp: tím đỏ tối (khác lông trắng/hồng/đen của mũ), kèm bóng đen sát trong lòng
    mau=m&(lum<130)&(R-G>30)&(B-G>-4)
    mau=ndimage.binary_opening(mau,iterations=1)
    lab,k=ndimage.label(mau)
    ys,xs=np.where(m); y0,y1=ys.min(),ys.max()
    sel=[]
    for i in range(1,k+1):
        yy,xx=np.where(lab==i)
        if yy.mean()<y0+(y1-y0)*0.45 or len(yy)<0.015*m.sum(): continue
        sel.append((len(yy),i))
    if not sel: return np.zeros_like(m)
    big=max(sel)[0]; c=np.isin(lab,[i for n,i in sel if n>=0.25*big])
    c=ndimage.binary_closing(c,iterations=3)&m
    for _ in range(2): c|=ndimage.binary_dilation(c)&m&(lum<60)
    # lòng mũ lồi: mỗi hàng lấp kín từ mép trái tới mép phải của lòng (gồm bóng đen, vệt sáng giữa lòng)
    rows=[y for y in range(c.shape[0]) if c[y].any()]
    for y in rows:
        xx=np.where(c[y])[0]; c[y,xx.min():xx.max()+1]|=m[y,xx.min():xx.max()+1]
    # bóng đen/nền lọt ở đáy lòng mũ (dưới vùng tím) cũng là lòng mũ; không lấy viền mảnh ngoài
    dk=ndimage.binary_opening(m&(lum<75)&~c,iterations=1)
    lab2,k2=ndimage.label(dk); cyc=np.where(c)[0].mean(); near=ndimage.binary_dilation(c,iterations=2)
    for i in range(1,k2+1):
        q=lab2==i
        if (q&near).any() and np.where(q)[0].mean()>cyc: c|=q
    for y in range(c.shape[0]):
        xx=np.where(c[y])[0]
        if len(xx): c[y,xx.min():xx.max()+1]|=m[y,xx.min():xx.max()+1]
    c=ndimage.binary_fill_holes(c)&m
    return ndimage.binary_closing(c,iterations=2)&m
def native(fi,lv,gender=None):
    name,label,cx,bot,mode,sc=FAMS[fi]
    if name in ATLASES:
        # Dedicated artwork keeps actual alpha, material shading and ornaments
        # instead of extracting tiny equipment icons from the reference sheet.
        config=ATLASES[name]
        if gender and gender in config: config={**config,**config[gender]}
        source=config
        cell_index=lv
        higher=config.get('higherLevels')
        if higher and lv+1>=higher['firstLevel']:
            source=higher
            cell_index=lv+1-higher['firstLevel']
        atlas=Image.open(ROOT/source['atlas']).convert('RGBA')
        cells=source['cells']
        region=source.get('regions')
        x0,x1=region[cell_index] if region else (cell_index*atlas.width//cells,(cell_index+1)*atlas.width//cells)
        cell=atlas.crop((x0,0,x1,atlas.height))
        threshold=config['alphaThreshold']
        bounds=cell.getchannel('A').point(lambda a:255 if a>=threshold else 0).getbbox()
        if bounds is None: raise ValueError(f'Empty {name} cell {lv+1}')
        if source is higher and min(bounds[0],bounds[1],cell.width-bounds[2],cell.height-bounds[3])<8:
            raise ValueError(f'{name} level {lv+1} touches its atlas cell edge; refine the source before export')
        width=source['widths'][cell_index] if 'widths' in source else source['width']
        p=np.array(cell.crop(bounds).resize((width,source['heights'][cell_index]),Image.Resampling.BOX))
        return p[...,:3],p[...,3]>=threshold,np.zeros(p.shape[:2],dtype=bool)
    a,m=seg.segment(fi,lv)
    cav=cavity(a,m) if mode=='hood' else visor(a,m) if mode=='visor' else ring(a,m) if mode=='ring' else np.zeros_like(m)
    keep=m&~cav
    ys,xs=np.where(m); a=a[ys.min():ys.max()+1,xs.min():xs.max()+1]; keep=keep[ys.min():ys.max()+1,xs.min():xs.max()+1]
    cv=cav[ys.min():ys.max()+1,xs.min():xs.max()+1]
    h,w=keep.shape; s_=S*sc
    if mode=='hood':
        # Fit the skull, not the small dark opening in the source icon. Stretching
        # that opening made the whole hood enormous and erased the hairstyle.
        s_=50/w
    sy=s_
    W,H=max(1,round(w*s_)),max(1,round(h*sy))
    rgba=np.dstack([a*keep[...,None],keep*255]).astype(np.uint8)
    pm=Image.fromarray(rgba,'RGBA').resize((W,H),Image.Resampling.BOX)   # premultiplied (nền = 0)
    p=np.array(pm).astype(float); al=p[...,3]
    # Pillow's RGBA resize already returns straight-alpha RGB. Dividing by alpha
    # again bleaches edge pixels and turns the fine trim into bright speckles.
    rgb=p[...,:3]
    op=al>=128
    cvn=np.array(Image.fromarray((cv*255).astype(np.uint8)).resize((W,H),Image.Resampling.BOX))>=128
    # These side-view icons face left in the reference sheet. Export them facing
    # right to match the avatar; the runtime handles the opposite facing.
    if name=='crown':
        rgb=rgb[:,::-1].copy(); op=op[:,::-1].copy(); cvn=cvn[:,::-1].copy()
    return rgb.astype(np.uint8),op,cvn
