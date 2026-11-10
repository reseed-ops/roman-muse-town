# Minimal binary FBX (6.x/7.x <7500) reader: dump node tree / extract meshes.
import struct, zlib, sys
def read(path):
    d=open(path,'rb').read(); ver=struct.unpack_from('<I',d,23)[0]
    def prop(o):
        t=chr(d[o]); o+=1
        if t in 'YCILFD':
            fmt={'Y':'<h','C':'<?','I':'<i','L':'<q','F':'<f','D':'<d'}[t]; v=struct.unpack_from(fmt,d,o)[0]; return v,o+struct.calcsize(fmt)
        if t in 'SR':
            n=struct.unpack_from('<I',d,o)[0]; o+=4; s=d[o:o+n]; return (s.decode('utf8','replace') if t=='S' else s),o+n
        if t in 'fdlib':
            n,enc,cl=struct.unpack_from('<III',d,o); o+=12; raw=d[o:o+cl]; o+=cl
            if enc: raw=zlib.decompress(raw)
            fmt={'f':'f','d':'d','l':'q','i':'i','b':'?'}[t]; return list(struct.unpack('<%d%s'%(n,fmt),raw)),o
        raise ValueError(t)
    def node(o):
        end,np_,pl=struct.unpack_from('<III',d,o); nl=d[o+12]; name=d[o+13:o+13+nl].decode()
        if end==0: return None,o+13
        p=o+13+nl; props=[]
        for _ in range(np_):
            v,p=prop(p); props.append(v)
        kids=[]
        while p<end:
            k,p=node(p)
            if k is None: break
            kids.append(k)
        return (name,props,kids),end
    o=27; out=[]
    while o<len(d)-13:
        n,o=node(o)
        if n is None: break
        out.append(n)
    return ver,out
def dump(n,depth=0,maxd=4):
    name,props,kids=n
    ps=[(p if not isinstance(p,list) else '[%d]'%len(p)) for p in props]
    ps=[ (p[:60] if isinstance(p,str) else p) for p in ps]
    print('  '*depth+name,ps[:6])
    if depth<maxd:
        for k in kids[:40]: dump(k,depth+1,maxd)
if __name__=='__main__':
    ver,tree=read(sys.argv[1]); print('version',ver)
    for n in tree: dump(n,0,int(sys.argv[2]) if len(sys.argv)>2 else 3)
