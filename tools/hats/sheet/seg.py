# Tách icon khỏi nền bảng mẫu: loang nền từ mép khung (qua nét viền tối hoặc theo độ lệch màu nền),
# rồi lấy khối ở giữa ô; WIN/OFF chỉnh tay cho ô Lv.3 bị icon bên cạnh hoặc nhãn chen vào.
from PIL import Image; import numpy as np
from scipy import ndimage
from crops import FAM, box, im
A=np.array(im).astype(int)
TOL=16
BAR={}
MODE={}
OFF={(3,2):17,(4,2):4,(5,2):9,(6,2):3,(8,2):-2,(9,2):10}
HW={}
WIN={(3,2):(1372,1448),(4,2):(608,690),(5,2):(1380,1462),(8,1):(355,445),(8,2):(598,690),(7,2):(1352,1452),(9,2):(1362,1462),(0,2):(598,700)}
FORCE={(3,2):'tol',(4,2):'tol',(5,2):'tol',(8,1):'tol',(8,2):'tol',(7,2):'tol',(9,2):'tol'}
ER={}
TOLS={(3,2):34,(8,2):30,(9,2):30,(6,2):24}
def segment(fi,lv,pad=(0,20,0,0)):
    if (fi,lv) in FORCE: return _seg(fi,lv,pad,FORCE[(fi,lv)])
    a,m=_seg(fi,lv,pad,'outline')
    if m.sum()>=1200: return a,m
    return _seg(fi,lv,pad,'tol')
def _seg(fi,lv,pad,mode):
    b=box(FAM[fi],lv); o=OFF.get((fi,lv),0); hw=HW.get((fi,lv),52)
    cx=(b[0]+b[2])//2+o
    if (fi,lv) in WIN: cx=sum(WIN[(fi,lv)])//2; hw=max(hw,(WIN[(fi,lv)][1]-WIN[(fi,lv)][0])//2+8)
    b=(cx-hw,b[1]+pad[1]-(25 if lv==2 else 0),cx+hw,b[3]); a=A[b[1]:b[3],b[0]:b[2]]
    border=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]]); bg=np.median(border,0)
    d=np.sqrt(((a-bg)**2).sum(2)); lum=a.mean(2)
    # nét viền ngoài của icon rất tối (lum ~10) so với nền (~32) và glow: loang từ mép khung qua mọi
    # ô không phải viền -> nền, glow, icon hàng xóm bị cắt mép; icon chính khép kín bởi viền thì còn lại
    bar=ndimage.binary_dilation(lum<=BAR.get((fi,lv),24))
    close=~bar if mode=='outline' else d<TOLS.get((fi,lv),TOL)
    lab0,_=ndimage.label(close,structure=[[0,1,0],[1,1,1],[0,1,0]])
    edge=set(np.unique(np.concatenate([lab0[0],lab0[-1],lab0[:,0],lab0[:,-1]])))-{0}
    fg=~np.isin(lab0,list(edge))
    # badges: saturated header boxes at the top rows - remove components touching top edge
    fg=ndimage.binary_opening(fg,iterations=1)
    if (fi,lv) in WIN:
        xx=np.arange(fg.shape[1])+b[0]; fg&=((xx>=WIN[(fi,lv)][0])&(xx<WIN[(fi,lv)][1]))[None]
    h,w=fg.shape
    # tách khỏi icon bên cạnh/nhãn: bóc 2px rồi lấy khối ở giữa, mọc lại trong fg
    core=ndimage.binary_erosion(fg,iterations=ER.get((fi,lv),2))
    lab,k=ndimage.label(core,structure=np.ones((3,3)))
    if k==0: lab,k=ndimage.label(fg)
    sizes=ndimage.sum(lab>0,lab,range(1,k+1))
    best=None; cx=w/2
    for i in range(1,k+1):
        ys,xs=np.where(lab==i)
        if ys.max()<h*0.3: continue
        if not (xs.min()<cx<xs.max()) and abs(xs.mean()-cx)>w*0.18: continue
        if best is None or sizes[i-1]>sizes[best-1]: best=i
    keep=lab==best
    for i in range(1,k+1):   # phần lớn khác sát khối chính (sừng, chụp tai), không lấy hạt rời
        if i!=best and sizes[i-1]>=40 and (ndimage.binary_dilation(keep,iterations=4)&(lab==i)).any():
            ys,xs=np.where(lab==i)
            if abs(xs.mean()-cx)<w*0.42: keep|=lab==i
    for _ in range(ER.get((fi,lv),2)+1): keep=ndimage.binary_dilation(keep)&fg
    keep=ndimage.binary_fill_holes(keep)
    return a,keep
