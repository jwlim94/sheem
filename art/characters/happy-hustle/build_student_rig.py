"""Animation-ready adaptation retaining Happy Hustle Boy's detailed source upper/feet.
Golden Bean / CC BY-NC-SA 4.0. New deformation surfaces for torso and limbs.
"""
import bpy,bmesh,math
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from math import sin,cos,pi
root=Path(__file__).resolve().parents[3];out=root/'art/characters/happy-hustle';pub=root/'public/models/happy-hustle'
bpy.ops.wm.open_mainfile(filepath=str(out/'rig-analysis.blend'))
source=bpy.data.objects['SourceJoined'];parts=[]
source_colors=np.load(out/'source-points.npz')['colors']
def is_head(v,i):
 c=source_colors[i];hair=c[2]>c[1]*.72 and c[0]<.65
 return v.z>1.445 or(v.z>1.16 and -.60<v.y<-.20)or(v.z>1.28 and -.60<v.y<.20)or(v.z>1.30 and v.y<.5 and hair)
def material(name,c,rough=.65):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;return m
skin=material('Student warm skin',(.70,.345,.22));shirt=material('Student ochre cotton',(.66,.34,.095));shirtedge=material('Cotton seams',(.44,.23,.072));pants=material('Student cocoa shorts',(.26,.175,.155));pantsedge=material('Shorts rolled hem',(.205,.125,.11));sock=material('Cream socks',(.76,.72,.60));nail=material('Nails',(.72,.405,.29))
def assign(o,name,mat,weights):
 o.name=name
 if mat:o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 for n in set(n for w in weights for n in w):o.vertex_groups.new(name=n)
 for i,w in enumerate(weights):
  for n,v in w.items():
   if v>0:o.vertex_groups[n].add([i],v,'REPLACE')
 parts.append(o);return o
def extract(name,test,bone,rotation=None,place=None):
 o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);bm=bmesh.new();bm.from_mesh(o.data)
 dead=[v for v in bm.verts if not test(v.co,v.index)];bmesh.ops.delete(bm,geom=dead,context='VERTS');# Keep the actual connected part, dropping detached contact fragments.
 unseen=set(bm.verts);components=[]
 while unseen:
  seed=unseen.pop();stack=[seed];component=[seed]
  while stack:
   v=stack.pop()
   for e in v.link_edges:
    other=e.other_vert(v)
    if other in unseen:unseen.remove(other);stack.append(other);component.append(other)
  components.append(component)
 if len(components)>1:
  largest=max(components,key=len);keep=set(largest);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in keep],context='VERTS')
 # Close new extraction boundaries before rigging; all vertices here share one bone.
 repair=skin if bone=='Head' else material('Source contact repair '+name,(.19,.07,.035))
 o.data.materials.append(repair);slot=len(o.data.materials)-1
 boundary=[e for e in bm.edges if e.is_boundary]
 if boundary:
  result=bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
  for f in result.get('faces',[]):f.material_index=slot
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 if rotation:
  for v in o.data.vertices:v.co=rotation@v.co
 if place:
  # Ground and center each preserved sneaker independently after flattening its sole.
  lo=Vector(tuple(min(v.co[i]for v in o.data.vertices)for i in range(3)));hi=Vector(tuple(max(v.co[i]for v in o.data.vertices)for i in range(3)));delta=Vector((place[0]-(lo.x+hi.x)/2,place[1]-(lo.y+hi.y)/2,place[2]-lo.z))
  for v in o.data.vertices:v.co+=delta
 return assign(o,name,None,[{bone:1}for _ in o.data.vertices])
# Preserve silhouette/face UVs and PBR details. Cut is hidden by collar and backpack.
head=extract('Original head hair glasses and cap',is_head,'Head')
bag=extract('Original canvas backpack',lambda v,i:.765<v.z<1.445 and v.y>=.20 and not is_head(v,i),'Chest')
# Source soles are tilted differently in the fixed run pose; make each sole horizontal.
rshoe=extract('Original right sneaker',lambda v,i:v.y<-.20 and v.z<.53 and .6*(v.y+.34)+.8*(v.z-.40)<0,'Foot.R',Matrix.Rotation(.70,3,'X'),(-.19,-.075,.022))
lshoe=extract('Original left sneaker',lambda v,i:v.y>.40 and v.z<.64 and .95*(v.y-.45)-.35*(v.z-.48)>0,'Foot.L',Matrix.Rotation(-1.40,3,'X'),(.19,-.075,.022))
bpy.data.objects.remove(source,do_unlink=True)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def ell(name,pos,scale,mat,bone):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=18,location=pos);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);return assign(o,name,mat,[{bone:1}for _ in o.data.vertices])
def tube(name,pts,radius,mat,bone):
 bpy.ops.object.select_all(action='DESELECT');c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=3;c.resolution_u=14;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for a,p in zip(sp.bezier_points,pts):a.co=p;a.handle_left_type='AUTO';a.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return assign(o,name,mat,[{bone:1}for _ in o.data.vertices])
def surface(name,rings,mat,weight,N=32):
 # Rings are (cx, cy, z, rx, ry), a continuous quad deformation surface.
 verts=[];faces=[]
 for x,y,z,rx,ry in rings:
  for k in range(N):
   a=2*pi*k/N;verts.append((x+rx*cos(a),y+ry*sin(a),z))
 for j in range(len(rings)-1):
  for k in range(N):a=j*N+k;b=j*N+(k+1)%N;faces.append((a,b,b+N,a+N))
 faces.append(tuple(reversed(range(N))));faces.append(tuple((len(rings)-1)*N+k for k in range(N)))
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
 # Round only geometry while the rig is in neutral pose, then assign smooth weights.
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Tailored surface','SUBSURF');mod.levels=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return assign(o,name,mat,[weight(v.co)for v in o.data.vertices])
ell('Neck',(0,-.015,1.28),(.112,.105,.13),skin,'Neck')
surface('Tailored shirt',[(0,0,.785,.245,.174),(0,0,.805,.267,.18),(0,0,.84,.267,.18),(0,0,.95,.272,.186),(0,0,1.08,.267,.182),(0,0,1.16,.25,.16),(0,0,1.23,.215,.125),(0,0,1.28,.12,.105)],shirt,lambda v:{'Spine':1-smooth(.91,1.17,v.z),'Chest':smooth(.91,1.17,v.z)})
tube('Shirt collar',[(-.11,-.05,1.275),(-.09,-.106,1.258),(0,-.12,1.251),(.09,-.106,1.258),(.11,-.05,1.275)],.016,shirtedge,'Chest')
tube('Shirt hem',[(-.23,-.105,.821),(-.14,-.16,.811),(0,-.176,.808),(.14,-.16,.811),(.23,-.105,.821)],.007,shirtedge,'Spine')
# Shoulder straps have a stable chest attachment; no disconnected front bag.
for s in [-1,1]:
 tube('Canvas shoulder strap',[(s*.14,.21,1.30),(s*.19,.01,1.25),(s*.21,-.115,1.13),(s*.22,-.153,.99),(s*.18,.13,.88)],.027,material('Canvas strap '+str(s),(.19,.075,.038)), 'Chest')
# Short, tailored pelvis underneath shirt, continuous with the legs by overlapping seams.
surface('Shorts waist',[(0,.01,.79,.235,.153),(0,.01,.76,.257,.166),(0,.01,.68,.253,.161),(0,.01,.615,.205,.144)],pants,lambda v:{'Hips':1})
D={};P={}
def bone(n,a,b,parent=None):D[n]=(Vector(a),Vector(b));P[n]=parent
bone('Root',(0,0,0),(0,0,.2));bone('Hips',(0,.02,.75),(0,.02,.86),'Root');bone('Spine',(0,.02,.86),(0,0,1.06),'Hips');bone('Chest',(0,0,1.06),(0,0,1.23),'Spine');bone('Neck',(0,0,1.23),(0,-.015,1.36),'Chest');bone('Head',(0,-.015,1.36),(0,-.015,2.20),'Neck')
for s,tag in [(-1,'R'),(1,'L')]:
 sh=(s*.235,0,1.18);el=(s*.355,-.005,.94);wr=(s*.385,-.025,.73);ha=(s*.39,-.035,.635)
 bone('UpperArm.'+tag,sh,el,'Chest');bone('Forearm.'+tag,el,wr,'UpperArm.'+tag);bone('Hand.'+tag,wr,ha,'Forearm.'+tag);bone('Grip.'+tag,ha,(ha[0],ha[1]-.05,ha[2]),'Hand.'+tag)
 hip=(s*.155,.02,.75);knee=(s*.18,-.015,.465);ank=(s*.19,.02,.235);toe=(s*.19,-.20,.12)
 bone('Thigh.'+tag,hip,knee,'Hips');bone('Shin.'+tag,knee,ank,'Thigh.'+tag);bone('Foot.'+tag,ank,toe,'Shin.'+tag)
 def arw(v):
  f=1-smooth(.855,1.035,v.z);return {'UpperArm.'+tag:1-f,'Forearm.'+tag:f}
 surface('Short sleeve '+tag,[(s*.236,0,1.225,.069,.088),(s*.265,0,1.19,.103,.116),(s*.30,-.002,1.11,.108,.12),(s*.331,-.004,1.035,.098,.112),(s*.336,-.004,1.013,.095,.110)],shirt,lambda v:{'UpperArm.'+tag:1})
 surface('Arm '+tag,[(s*.32,-.003,1.07,.081,.084),(s*.343,-.004,1.02,.084,.085),(s*.355,-.005,.965,.080,.081),(s*.36,-.010,.92,.076,.077),(s*.375,-.020,.84,.069,.071),(s*.385,-.025,.735,.061,.063)],skin,arw)
 # Relaxed chibi hand with separate rounded fingers and a thumb, all attached to hand bone.
 ell('Palm '+tag,(s*.39,-.03,.685),(.077,.064,.088),skin,'Hand.'+tag)
 for i in range(4):
  x=s*(.339+i*.030);y=-.042-.018*sin(i/3*pi);top=.675;bottom=.594+abs(i-1.4)*.012
  tube('Finger '+tag+str(i),[(x,y,top),(x,y-.015,(top+bottom)/2),(x,y-.004,bottom)],.0205,skin,'Hand.'+tag)
 tube('Thumb '+tag,[(s*.334,-.048,.713),(s*.311,-.083,.681),(s*.32,-.091,.652)],.026,skin,'Hand.'+tag)
 # Shorts bend from hip; knee and ankle use smooth, contiguous skin loops.
 surface('Short leg '+tag,[(s*.15,.012,.748,.130,.155),(s*.16,.009,.715,.14,.155),(s*.174,.002,.63,.139,.148),(s*.18,-.008,.554,.135,.139),(s*.181,-.01,.535,.133,.139)],pants,lambda v:{'Thigh.'+tag:1})
 surface('Short cuff '+tag,[(s*.18,-.008,.552,.139,.145),(s*.181,-.01,.538,.14,.146),(s*.181,-.01,.523,.135,.141)],pantsedge,lambda v:{'Thigh.'+tag:1})
 surface('Lower leg '+tag,[(s*.18,-.014,.57,.094,.096),(s*.18,-.015,.49,.095,.096),(s*.182,-.008,.445,.092,.093),(s*.186,.008,.36,.086,.086),(s*.19,.02,.265,.075,.079)],skin,lambda v:{'Thigh.'+tag:smooth(.39,.54,v.z),'Shin.'+tag:1-smooth(.39,.54,v.z)})
 surface('Sock '+tag,[(s*.19,.025,.375,.093,.098),(s*.19,.025,.36,.102,.107),(s*.19,.025,.28,.097,.102),(s*.19,.025,.22,.092,.098)],sock,lambda v:{'Shin.'+tag:1})
# All geometry uses explicit weights; source silhouette parts keep their PBR material.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=head;bpy.ops.object.join();mesh=bpy.context.object;mesh.name='HappyStudent';mesh.parent=None
ad=bpy.data.armatures.new('HappyStudentSkeleton');rig=bpy.data.objects.new('HappyStudentRig',ad);bpy.context.collection.objects.link(rig);bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for n,(a,b)in D.items():
 eb=ad.edit_bones.new(n);eb.head=a;eb.tail=b
 if P[n]:eb.parent=ad.edit_bones[P[n]]
bpy.ops.object.mode_set(mode='OBJECT');mesh.parent=rig;mod=mesh.modifiers.new('Student skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
rig['author']='Golden Bean';rig['license']='CC-BY-NC-SA-4.0';rig['source']='https://sketchfab.com/3d-models/happy-hustle-boy-bdc75c61891d42058fc414d0560f0a48';rig['changes']='Preserved source head, hair, glasses, cap, backpack and sneakers; reconstructed torso/limbs for deformation; removed laptop; added neutral humanoid rig and animation.'
sc=bpy.context.scene;sc.render.fps=24;sc.camera.location=(3.5,-6,2.8);sc.camera.rotation_euler=(Vector((0,0,1.3))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=3.3
bpy.ops.wm.save_as_mainfile(filepath=str(out/'happy-student-rigged.blend'))
sc.render.filepath=str(out/'student-rest-front.png');bpy.ops.render.render(write_still=True)
sc.camera.location=(6,0,1.5);sc.camera.rotation_euler=(Vector((0,0,1.3))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.render.filepath=str(out/'student-rest-side.png');bpy.ops.render.render(write_still=True)
print('STUDENT_REST_COMPLETE',len(mesh.data.vertices),len(ad.bones))
