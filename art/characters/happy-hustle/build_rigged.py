"""Repose and rig the user-selected Happy Hustle Boy derivative in Blender.
Source Golden Bean, CC-BY-NC-SA-4.0; see public/models/happy-hustle/ATTRIBUTION.txt.
Original fused surface/PBR retained except laptop excision and contact repair.
"""
import bpy,bmesh,math,json
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from math import sin,cos,pi
root=Path(__file__).resolve().parents[3];out=root/'art/characters/happy-hustle';pub=root/'public/models/happy-hustle'
bpy.ops.wm.open_mainfile(filepath=str(out/'rig-analysis.blend'))
o=bpy.data.objects['SourceJoined'];me=o.data;data=np.load(out/'source-points.npz');colors=data['colors'];oldco=data['points']
# Remove laptop by its two slab surfaces, protecting the brighter skin at contacts.
def laptop(v,c):
 x,y,z=v
 if not(-.43<x<.43 and -.91<y<-.14 and .725<z<1.29):return False
 screen=abs(y-(-.56-.59*(z-.80)))<.10 and z>.79
 keyboard=.735<z<.855 and -.63<y<-.14
 brown=c[0]<.67 and c[2]/max(c[0],.001)>.48
 core=abs(x)<.235
 return (screen or keyboard) and (brown or core or (screen and z>.99))
remove=set(i for i,(v,c)in enumerate(zip(oldco,colors))if laptop(v,c))
bm=bmesh.new();bm.from_mesh(me);bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
faces=[f for f in bm.faces if sum(v.index in remove for v in f.verts)>=2]
bmesh.ops.delete(bm,geom=faces,context='FACES')
# Remove isolated tiny slivers from the cut, then patch each remaining contact loop.
loose=[v for v in bm.verts if not v.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
def plainmat(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.7;me.materials.append(m);return len(me.materials)-1
skinmat=plainmat('Repaired palm skin',(.60,.30,.19));shirtmat=plainmat('Repaired shirt hem',(.47,.255,.08))
bound=[e for e in bm.edges if e.is_boundary];seen=set();patches=[]
for e in bound:
 if e in seen:continue
 stack=[e];edges=[];seen.add(e)
 while stack:
  a=stack.pop();edges.append(a)
  for v in a.verts:
   for n in v.link_edges:
    if n.is_boundary and n not in seen:seen.add(n);stack.append(n)
 if len(edges)>2:
  verts=set(v for e in edges for v in e.verts);center=sum((v.co for v in verts),Vector())/len(verts)
  # Only repair new laptop contact holes; don't seal original mouth geometry.
  if center.z<1.3:
   result=bmesh.ops.holes_fill(bm,edges=edges,sides=0)
   for f in result.get('faces',[]):f.material_index=skinmat if abs(center.x)>.23 else shirtmat;f.smooth=True
   patches.append((len(edges),list(center)))
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();print('LAPTOP_CUT',len(faces),'PATCHES',patches)
# Bone endpoints in the source running pose and the reconstructed relaxed pose.
src={};dst={};parents={}
def bone(name,sa,sb,ta,tb,parent=None):src[name]=(Vector(sa),Vector(sb));dst[name]=(Vector(ta),Vector(tb));parents[name]=parent
bone('Root',(0,0,0),(0,0,.2),(0,0,0),(0,0,.2))
bone('Hips',(0,.02,.73),(0,.02,.85),(0,.02,.73),(0,.02,.85),'Root')
bone('Spine',(0,.02,.85),(0,0,1.06),(0,.02,.85),(0,0,1.06),'Hips')
bone('Chest',(0,0,1.06),(0,0,1.24),(0,0,1.06),(0,0,1.24),'Spine')
bone('Neck',(0,0,1.24),(0,-.015,1.37),(0,0,1.24),(0,-.015,1.37),'Chest')
bone('Head',(0,-.015,1.37),(0,-.015,2.2),(0,-.015,1.37),(0,-.015,2.2),'Neck')
for side,tag in [(-1,'R'),(1,'L')]:
 sh=(side*.27,-.035,1.20);el=(side*.38,-.30,1.00);wr=(side*.40,-.55,.845);ha=(side*.41,-.58,.74)
 tel=(side*.36,-.025,.88);twr=(side*.38,-.06,.58);tha=(side*.39,-.08,.47)
 bone('UpperArm.'+tag,sh,el,sh,tel,'Chest');bone('Forearm.'+tag,el,wr,tel,twr,'UpperArm.'+tag);bone('Hand.'+tag,wr,ha,twr,tha,'Forearm.'+tag)
 hip=(side*.17,.02,.73);knee=(side*.21,-.22,.51) if side<0 else(side*.23,.28,.51);ank=(side*.23,-.43,.33)if side<0 else(side*.27,.52,.40);toe=(side*.23,-.59,.20)if side<0 else(side*.27,.62,.22)
 tk=(side*.18,.005,.43);ta=(side*.18,.02,.15);tt=(side*.18,-.20,.105)
 bone('Thigh.'+tag,hip,knee,hip,tk,'Hips');bone('Shin.'+tag,knee,ank,tk,ta,'Thigh.'+tag);bone('Foot.'+tag,ank,toe,ta,tt,'Shin.'+tag)
 bone('Grip.'+tag,ha,(ha[0],ha[1]-.04,ha[2]),tha,(tha[0],tha[1]-.04,tha[2]),'Hand.'+tag)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def line_t(v,a,b):return max(0,min(1,(v-a).dot(b-a)/(b-a).length_squared))
def weight(v):
 x,y,z=v;tag='L'if x>0 else'R';ax=abs(x)
 if z>1.43 or (z>1.27 and y<-.14):return {'Head':1}
 if z>1.28:
  if y>.17:return {'Chest':1}
  t=smooth(1.28,1.4,z);return {'Head':t,'Neck':1-t}
 # Arms are in front/outside the shirt; keep backpack and shoulder straps on chest.
 arm=smooth(.245,.32,ax)*(1-smooth(.04,.16,y))*smooth(.70,.90,z)
 if y<-.30 and z>.67:arm=max(arm,smooth(.21,.30,ax))
 if arm>.001:
  wrist=src['Hand.'+tag][0];elbow=src['Forearm.'+tag][0]
  # Blend over joints, while preserving long forearm/hand shapes.
  ht=smooth(-.515,-.60,y) if False else 1-smooth(-.60,-.50,y)
  et=1-smooth(-.34,-.23,y)
  w={'UpperArm.'+tag:arm*(1-et),'Forearm.'+tag:arm*et*(1-ht),'Hand.'+tag:arm*et*ht,'Chest':1-arm}
  return {k:v for k,v in w.items()if v>.00001}
 if z<.85:
  hip=src['Thigh.'+tag][0];knee=src['Shin.'+tag][0];ankle=src['Foot.'+tag][0]
  direction=(ankle-hip).normalized();along=(v-hip).dot(direction);hipblend=smooth(.00,.17,along)*smooth(.025,.14,ax)
  k=(knee-hip).dot(direction);a=(ankle-hip).dot(direction)
  lower=smooth(k-.07,k+.07,along);foot=smooth(a-.065,a+.035,along)
  return {'Hips':1-hipblend,'Thigh.'+tag:hipblend*(1-lower),'Shin.'+tag:hipblend*lower*(1-foot),'Foot.'+tag:hipblend*lower*foot}
 if y>.15:return {'Chest':1}
 t=smooth(.9,1.15,z);return {'Spine':1-t,'Chest':t}
rot={n:(src[n][1]-src[n][0]).rotation_difference(dst[n][1]-dst[n][0])for n in src}
allweights=[]
for v in me.vertices:
 w=weight(v.co);s=sum(w.values());w={k:f/s for k,f in w.items()if f>0};old=v.co.copy();v.co=sum(((rot[n]@(old-src[n][0])+dst[n][0])*f for n,f in w.items()),Vector());allweights.append(w)
# Ground the sole, then shift every bone consistently.
lowest=min(v.co.z for v in me.vertices);lift=.025-lowest
for v in me.vertices:v.co.z+=lift
for n,(a,b)in list(dst.items()):dst[n]=(a+Vector((0,0,lift)),b+Vector((0,0,lift)))
me.update();o.name='HappyStudentSurface'
bpy.ops.object.select_all(action='DESELECT');ad=bpy.data.armatures.new('HappyStudentSkeleton');rig=bpy.data.objects.new('HappyStudentRig',ad);bpy.context.collection.objects.link(rig);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for n,(a,b)in dst.items():
 eb=ad.edit_bones.new(n);eb.head=a;eb.tail=b
 if parents[n]:eb.parent=ad.edit_bones[parents[n]]
bpy.ops.object.mode_set(mode='OBJECT');o.parent=rig
for n in dst:o.vertex_groups.new(name=n)
for i,w in enumerate(allweights):
 for n,f in w.items():o.vertex_groups[n].add([i],f,'REPLACE')
mod=o.modifiers.new('Humanoid skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
rig['author']='Golden Bean';rig['license']='CC-BY-NC-SA-4.0';rig['source']='https://sketchfab.com/3d-models/happy-hustle-boy-bdc75c61891d42058fc414d0560f0a48';rig['changes']='Laptop removed; contact surfaces patched; neutral pose reconstructed; humanoid skin and Idle/Walk clips added.'
sc=bpy.context.scene;sc.render.fps=24
# Rest-pose renders first, used to inspect all repaired contacts and proportions.
sc.camera.location=(3.5,-6,2.8+lift);sc.camera.rotation_euler=(Vector((0,0,1.35+lift))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=3.5
bpy.ops.wm.save_as_mainfile(filepath=str(out/'happy-student-rigged.blend'))
sc.render.filepath=str(out/'rigged-rest-front.png');bpy.ops.render.render(write_still=True)
sc.camera.location=(6,0,1.5+lift);sc.camera.rotation_euler=(Vector((0,0,1.35+lift))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.render.filepath=str(out/'rigged-rest-side.png');bpy.ops.render.render(write_still=True)
print('RIG_REST_COMPLETE',len(me.vertices),lift)
