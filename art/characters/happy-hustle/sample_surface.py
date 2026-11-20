import bpy,numpy as np
from pathlib import Path
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'rig-analysis.blend'));o=bpy.data.objects['SourceJoined'];m=o.data;coords=np.array([v.co[:]for v in m.vertices]);mat=m.materials[0];im=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='sRGB');w,h=im.size;a=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(a);a=a.reshape(h,w,4);colors=np.zeros((len(m.vertices),3));counts=np.zeros(len(m.vertices));uv=m.uv_layers.active.data
for i,l in enumerate(m.loops):
 u,v=uv[i].uv;c=a[min(h-1,max(0,int(v*h))),min(w-1,max(0,int(u*w))),:3];colors[l.vertex_index]+=c;counts[l.vertex_index]+=1
colors/=np.maximum(counts[:,None],1);np.savez(p/'source-points.npz',points=coords,colors=colors)
