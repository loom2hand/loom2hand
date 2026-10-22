"""
Loom2hand photo cleaner – removes the backdrop and text labels from a product
photo and places the product on the site's soft cream background (1000x1000).

  pip install rembg pillow opencv-python-headless
  python tools/clean_photos.py raw_photo.jpg images/TW-57/01.jpg
  python tools/clean_photos.py --flat poster_photo.jpg images/TW-58/01.jpg   # keep whole photo (towel fills the frame)

First run downloads the background-removal model (~180 MB).
"""
import sys, os, numpy as np, cv2
from PIL import Image
from rembg import remove, new_session
SESSION=None
def text_mask(bgr):
    h,w=bgr.shape[:2]
    g=cv2.cvtColor(bgr,cv2.COLOR_BGR2GRAY)
    hsv=cv2.cvtColor(bgr,cv2.COLOR_BGR2HSV)
    white=((g>238)&(hsv[...,1]<40)).astype(np.uint8)
    dark=(g<60).astype(np.uint8)
    k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7))
    nearDark=cv2.dilate(dark,k); nearWhite=cv2.dilate(white,k)
    m=((white&nearDark)|(dark&nearWhite)).astype(np.uint8)
    zone=np.zeros_like(m); zone[:int(h*.42),:int(w*.85)]=1; zone[int(h*.86):,int(w*.3):]=1
    m=m*zone
    # keep only text-like clusters: group via horizontal dilation, keep groups with many stroke pixels
    grp=cv2.dilate(m,cv2.getStructuringElement(cv2.MORPH_RECT,(25,9)))
    n,lab,st,_=cv2.connectedComponentsWithStats(grp)
    out=np.zeros_like(m)
    for i in range(1,n):
        x,y,ww,hh,a=st[i]
        if hh<h*0.12 and ww>w*0.04:
            out[lab==i]=1
    out=out&cv2.dilate(m,np.ones((3,3),np.uint8))
    return cv2.dilate(out,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))*255

def product_mask(bgr,rgb_pil):
    h,w=bgr.shape[:2]
    a=np.array(remove(rgb_pil,session=SESSION,only_mask=True))
    m1=(a>30).astype(np.uint8)
    # background colour distance
    lab=cv2.cvtColor(bgr,cv2.COLOR_BGR2LAB).astype(np.float32)
    b=8; border=np.concatenate([lab[:b].reshape(-1,3),lab[-b:].reshape(-1,3),lab[:,:b].reshape(-1,3),lab[:,-b:].reshape(-1,3)])
    bg=np.median(border,axis=0)
    diff=lab-bg; diff[...,0]*=0.5
    d=np.linalg.norm(diff,axis=2)
    green = bg[1]<118   # LAB a channel well below neutral -> green backdrop
    if green:
        A=lab[...,1]; B=lab[...,2]
        bgkey=(A<bg[1]+14)&(np.abs(B-bg[2])<22)
        m2=(~bgkey).astype(np.uint8)
        m2=cv2.morphologyEx(m2,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
        m=(m1|(m2&cv2.dilate(m1,np.ones((61,61),np.uint8)))).astype(np.uint8)
    else:
        m1=(a>10).astype(np.uint8)
        m2=(d>28).astype(np.uint8)
        m=((m1|m2)&cv2.dilate(m1,np.ones((25,25),np.uint8))).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9)))
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    n,labm,st,_=cv2.connectedComponentsWithStats(m)
    keep=np.zeros_like(m)
    for i in range(1,n):
        if st[i,4]>h*w*0.01: keep[labm==i]=1
    # fill holes
    inv=(1-keep).astype(np.uint8); ff=inv.copy(); n2,l2,s2,_=cv2.connectedComponentsWithStats(inv)
    for i in range(1,n2):
        x,y,ww,hh,ar=s2[i]
        if x>0 and y>0 and x+ww<w and y+hh<h: keep[l2==i]=1
    return keep, bg

def refine(bgr,keep,bg):
    lab=cv2.cvtColor(bgr,cv2.COLOR_BGR2LAB).astype(np.float32)
    d=np.linalg.norm(lab-bg,axis=2)
    er=cv2.erode(keep,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(13,13)))
    band=(keep>0)&(er==0)
    m=keep.copy(); m[band&(d<60)]=0
    green = bg[1]<118
    m=cv2.erode(m,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5) if green else (3,3)))
    if green:
        b_,g_,r_=[bgr[...,i].astype(np.int16) for i in range(3)]
        mx=np.maximum(r_,b_)
        near=cv2.dilate(band.astype(np.uint8),np.ones((15,15),np.uint8))>0
        spill=near&(g_>mx)&((g_-mx)<70)
        g2=g_.copy(); g2[spill]=mx[spill]
        bgr=bgr.copy(); bgr[...,1]=np.clip(g2,0,255).astype(np.uint8)
    # despill: in edge band, pull chroma away from background chroma
    bandw=cv2.dilate((band).astype(np.uint8),np.ones((5,5),np.uint8))>0
    bgc=bg[1:]-128; nb=np.linalg.norm(bgc)
    if nb>8:
        u=bgc/nb; ab=lab[...,1:]-128
        proj=(ab@u)
        corr=np.clip(proj,0,None)[...,None]*u
        ab[bandw]=ab[bandw]-corr[bandw]
        lab[...,1:]=ab+128
        bgr=cv2.cvtColor(np.clip(lab,0,255).astype(np.uint8),cv2.COLOR_LAB2BGR)
    return bgr,m

def whitebalance(img,mask):
    px=img[mask>0].astype(np.float32)
    lum=px.mean(1); top=px[lum>np.percentile(lum,85)]
    if len(top)==0: return img
    mean=top.mean(0); sat=(mean.max()-mean.min())/max(mean.max(),1)
    if sat<0.12:  # bright areas near-neutral -> correct cast
        scale=mean.mean()/np.maximum(mean,1)
        img=np.clip(img.astype(np.float32)*scale,0,255)
    # gentle levels: stretch so brightest ~ 250
    p=np.percentile(img[mask>0].mean(1),99.5); img=np.clip(img.astype(np.float32)*(250/max(p,1)),0,255)
    return img.astype(np.uint8)

def compose(bgr,mask,size=1000,bg=(247,243,236)):
    rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB)
    rgb=whitebalance(rgb,mask)
    # soft alpha edge
    alpha=cv2.GaussianBlur(mask.astype(np.float32),(5,5),0)
    ys,xs=np.where(mask>0); x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
    rgb=rgb[y0:y1+1,x0:x1+1]; alpha=alpha[y0:y1+1,x0:x1+1]
    hh,ww=alpha.shape; s=(size*0.84)/max(hh,ww)
    nw,nh=int(ww*s),int(hh*s)
    rgb=cv2.resize(rgb,(nw,nh),interpolation=cv2.INTER_AREA); alpha=cv2.resize(alpha,(nw,nh),interpolation=cv2.INTER_AREA)
    canvas=np.zeros((size,size,3),np.float32); canvas[:]=bg
    # subtle radial vignette lighter centre
    yy,xx=np.mgrid[0:size,0:size]; r=np.sqrt((xx-size/2)**2+(yy-size*0.45)**2)/(size*0.75)
    canvas=canvas*(1.02-0.06*r[...,None]); canvas=np.clip(canvas,0,255)
    ox,oy=(size-nw)//2,(size-nh)//2
    # shadow
    sh=np.zeros((size,size),np.float32); sh[oy:oy+nh,ox:ox+nw]=alpha
    sh=np.roll(sh,(int(size*0.018),int(size*0.01)),(0,1)); sh=cv2.GaussianBlur(sh,(0,0),size*0.018)
    canvas=canvas*(1-0.28*sh[...,None])
    a=np.zeros((size,size),np.float32); a[oy:oy+nh,ox:ox+nw]=alpha
    fg=np.zeros((size,size,3),np.float32); fg[oy:oy+nh,ox:ox+nw]=rgb
    out=canvas*(1-a[...,None])+fg*a[...,None]
    return Image.fromarray(np.clip(out,0,255).astype(np.uint8))

def process(src,dst,flat=False):
    global SESSION
    if SESSION is None: SESSION=new_session('isnet-general-use')
    bgr=cv2.imread(src)
    tm=text_mask(bgr)
    bgr=cv2.inpaint(bgr,tm,7,cv2.INPAINT_TELEA)
    pil=Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB))
    if flat:
        h,w=bgr.shape[:2]; m=np.zeros((h,w),np.uint8); m[int(h*.01):int(h*.99),int(w*.01):int(w*.99)]=1
    else:
        m,bg=product_mask(bgr,pil); bgr,m=refine(bgr,m,bg)
    compose(bgr,m).save(dst,quality=92)

if __name__=='__main__':
    a=sys.argv[1:]; flat='--flat' in a; a=[x for x in a if x!='--flat']
    if len(a)!=2: sys.exit(__doc__)
    os.makedirs(os.path.dirname(os.path.abspath(a[1])),exist_ok=True)
    process(a[0],a[1],flat); print('saved',a[1])
