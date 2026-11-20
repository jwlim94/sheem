"""Original chibi student mesh, humanoid rig and clips. No reference mesh imported.
Run Blender --background --python art/characters/boy/build_boy.py
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'art/characters/boy'; PUBLIC=ROOT/'public/models/boy'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials):bpy.data.materials.remove(d)
def mat(name,color,rough=.6):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
 return m
skin=mat('Warm porcelain skin',(.64,.365,.23),.65);inner=mat('Ear warmth',(.59,.255,.18));cheek=mat('Soft cheeks',(.68,.29,.23))
hair=mat('Ink brown hair',(.027,.021,.02),.43);hairhi=mat('Soft hair ridges',(.045,.034,.028),.5)
shirt=mat('Sage knit',(.24,.37,.285));rib=mat('Sage ribbing',(.18,.29,.23));cream=mat('Cream cotton',(.83,.79,.65));pants=mat('Warm charcoal trousers',(.18,.19,.19));sole=mat('Ivory rubber',(.73,.70,.61));shoe=mat('Deep teal sneakers',(.10,.20,.22));bag=mat('Midnight canvas',(.09,.155,.21));bagtrim=mat('Canvas edging',(.055,.105,.15));leather=mat('Honey leather',(.40,.25,.115));frame=mat('Tortoise glasses',(.15,.095,.05),.32);white=mat('Eyes warm white',(.88,.86,.77),.28);iris=mat('Dark hazel iris',(.13,.07,.025),.27);pupil=mat('Pupils',(.008,.01,.011),.18);mouth=mat('Smile umber',(.20,.075,.04));highlight=mat('Eye catchlights',(.98,.98,.93),.15)
parts=[]
def finish(obj,name,material,bone):
 obj.name=name;obj.data.materials.append(material)
 if obj.type=='MESH':
  for p in obj.data.polygons:p.use_smooth=True
  bpy.context.view_layer.objects.active=obj;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))),1,'REPLACE');parts.append(obj)
 return obj
def ell(name,pos,scale,material,bone,segments=24,rings=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos);o=bpy.context.object;o.scale=scale;return finish(o,name,material,bone)
def rounded(name,pos,scale,bevel,material,bone):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=4;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);return finish(o,name,material,bone)
def tube(name,pts,radius,material,bone):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=3;c.resolution_u=18
 sp=c.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for p,v in zip(sp.bezier_points,pts):p.co=v;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.select_set(False);return finish(o,name,material,bone)
def segment(name,a,b,r,material,bone):
 a,b=Vector(a),Vector(b);mid=(a+b)/2
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=14,location=mid);o=bpy.context.object;o.scale=(r,r,(b-a).length/2+r*.6);o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');return finish(o,name,material,bone)
# Three-head proportions: total 2.52 m in source; fit by caller if a different height is needed.
ell('Head',(0,-.018,1.99),(.445,.365,.465),skin,'Head',40,28)
ell('Lower face',(0,-.06,1.805),(.34,.30,.235),skin,'Head',32,20)
ell('Neck',(0,0,1.51),(.125,.115,.18),skin,'Neck')
ell('Sweater body',(0,.025,1.15),(.29,.205,.37),shirt,'Spine',32,22)
rounded('Sweater hem',(0,.02,.87),(.50,.35,.085),.035,rib,'Hips')
tube('Ivory crew collar',[(-.13,-.10,1.475),(-.08,-.158,1.445),(0,-.175,1.434),(.08,-.158,1.445),(.13,-.10,1.475)],.028,cream,'Chest')
# Small embroidered campus-inspired mark: original geometric stitch, no school logo.
tube('Chest embroidery',[(-.095,-.188,1.25),(-.065,-.203,1.20),(-.035,-.207,1.25)],.008,cream,'Spine')
# Head silhouette, ears, layered eye parts.
for side in [-1,1]:
 ell('Ear',(side*.437,.0,1.94),(.103,.075,.139),skin,'Head');ell('Ear inner',(side*.477,-.055,1.95),(.053,.020,.08),inner,'Head')
 ell('Cheek blush',(side*.277,-.285,1.805),(.062,.009,.024),cheek,'Head')
 ell('Eye white',(side*.175,-.351,2.014),(.115,.035,.139),white,'Head',32,20)
 ell('Iris',(side*.175,-.385,2.003),(.068,.014,.086),iris,'Head',28,20)
 ell('Pupil',(side*.175,-.398,2.004),(.037,.010,.059),pupil,'Head')
 ell('Eye sparkle',(side*.175-.018,-.409,2.038),(.015,.006,.018),highlight,'Head',16,12)
 tube('Upper eyelid',[(side*.175-.092,-.367,2.091),(side*.175,-.39,2.142),(side*.175+.092,-.367,2.091)],.012,skin,'Head')
 tube('Eyebrow',[(side*.175-.082,-.312,2.20),(side*.175,-.338,2.223),(side*.175+.082,-.313,2.204)],.021,hair,'Head')
ell('Button nose',(0,-.387,1.9),(.067,.068,.060),skin,'Head')
tube('Quiet smile',[(-.089,-.346,1.76),(-.043,-.37,1.742),(0,-.377,1.739),(.049,-.367,1.752),(.084,-.345,1.778)],.009,mouth,'Head')
# Rounded octagonal spectacles, narrower and quieter than the reference's red frames.
for side in [-1,1]:
 cx=side*.184;pts=[]
 for i in range(33):
  a=i/32*2*pi;x=math.copysign(abs(cos(a))**.62,cos(a));z=math.copysign(abs(sin(a))**.62,sin(a));pts.append((cx+x*.159,-.414,2.011+z*.169))
 tube('Spectacle rim',pts,.015,frame,'Head')
 tube('Glasses temple',[(side*.34,-.413,2.075),(side*.404,-.21,2.08),(side*.446,.008,2.02)],.013,frame,'Head')
tube('Spectacle bridge',[(-.026,-.414,2.029),(0,-.427,2.046),(.026,-.414,2.029)],.014,frame,'Head')
# Original sculpted cap with broad swept locks; no geometry or textures from reference.
verts=[];faces=[];U=48;V=18
for j in range(V+1):
 for i in range(U):
  phi=2*pi*i/U;theta=(.02+(1.50+.65*sin(phi))*j/V)
  verts.append((.465*sin(theta)*cos(phi),.398*sin(theta)*sin(phi)-.018,1.99+.485*cos(theta)))
for j in range(V):
 for i in range(U):a=j*U+i;b=j*U+(i+1)%U;faces.append((a,b,b+U,a+U))
me=bpy.data.meshes.new('Hair cap');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Hair silhouette',me);bpy.context.collection.objects.link(o);finish(o,o.name,hair,'Head')
def lock(name,controls,width,depth,material):
 vs=[];fs=[];N=24;R=10
 for i in range(N+1):
  t=i/N;P=[Vector(x)for x in controls];v=(1-t)**3*P[0]+3*(1-t)**2*t*P[1]+3*(1-t)*t*t*P[2]+t**3*P[3]
  tangent=(3*(1-t)**2*(P[1]-P[0])+6*(1-t)*t*(P[2]-P[1])+3*t*t*(P[3]-P[2])).normalized();normal=Vector((v.x,v.y,v.z-2.0)).normalized();across=tangent.cross(normal).normalized();normal=across.cross(tangent).normalized();taper=max(.035,sin(pi*t)**.55)
  for k in range(R):a=k/R*2*pi;vs.append(v+across*cos(a)*width*taper+normal*sin(a)*depth*taper)
 for i in range(N):
  for k in range(R):a=i*R+k;b=i*R+(k+1)%R;fs.append((a,b,b+R,a+R))
 fs.append(tuple(reversed(range(R))));fs.append(tuple(N*R+k for k in range(R)))
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,name,material,'Head')
for i in range(6):
 y=-.13-i*.036
 lock('Swept fringe '+str(i),[(.27,y,2.31+i*.007),(.16,y-.08,2.54-i*.019),(-.25,y-.12,2.43-i*.034),(-.40+i*.018,y-.065,2.19-i*.021)],.103,.045,hair if i%2==0 else hairhi)
for side in [-1,1]:
 lock('Side lock',[(side*.35,-.11,2.31),(side*.49,-.08,2.21),(side*.46,-.12,2.04),(side*.39,-.17,1.96)],.073,.031,hair)
# Legs / flexible arm surfaces, with independently weighted elbow and knee transitions.
for side,tag in [(-1,'R'),(1,'L')]:
 upper='UpperArm.'+tag;fore='Forearm.'+tag;hand='Hand.'+tag;thigh='Thigh.'+tag;shin='Shin.'+tag;foot='Foot.'+tag
 segment('Trouser leg',(side*.145,0,.85),(side*.16,0,.30),.118,pants,thigh)
 leg=parts[-1];leg.vertex_groups.new(name=shin)
 for v in leg.data.vertices:
  t=max(0,min(1,(.58-v.co.z)/.20));t=t*t*(3-2*t);leg.vertex_groups[thigh].add([v.index],1-t,'REPLACE');leg.vertex_groups[shin].add([v.index],t,'REPLACE')
 ell('Ankle sock',(side*.16,-.005,.245),(.093,.095,.12),cream,shin)
 rounded('Sneaker sole',(side*.16,-.08,.09),(.25,.39,.13),.055,sole,foot)
 ell('Sneaker upper',(side*.16,-.065,.17),(.125,.179,.106),shoe,foot)
 ell('Toe cap',(side*.16,-.216,.148),(.115,.061,.070),cream,foot)
 for k in range(3):tube('Laces',[(side*.16-.059,-.09+k*.036,.245-k*.004),(side*.16+.059,-.09+k*.036,.245-k*.004)],.009,cream,foot)
 tube('Shoe side stitch',[(side*.16+side*.117,-.16,.14),(side*.16+side*.125,-.04,.15),(side*.16+side*.10,.03,.18)],.008,leather,foot)
 a=(side*.25,0,1.36);b=(side*.40,-.005,1.095);c=(side*.46,-.015,.855)
 segment('Sleeved arm',a,(side*.425,-.01,.97),.116,shirt,upper)
 arm=parts[-1];arm.vertex_groups.new(name=fore)
 for v in arm.data.vertices:
  t=max(0,min(1,(1.17-v.co.z)/.15));t=t*t*(3-2*t);arm.vertex_groups[upper].add([v.index],1-t,'REPLACE');arm.vertex_groups[fore].add([v.index],t,'REPLACE')
 segment('Forearm skin',(side*.414,-.01,1.01),c,.081,skin,fore)
 segment('Sweater cuff',(side*.41,-.01,1.023),(side*.425,-.012,.978),.092,rib,fore)
 ell('Rounded palm',(side*.465,-.014,.825),(.082,.070,.106),skin,hand)
 ell('Thumb',(side*.413,-.063,.834),(.044,.044,.064),skin,hand)
 for k in range(2):tube('Finger crease',[(side*.465+(.022-k*.027),-.077,.80),(side*.465+(.022-k*.027),-.071,.775)],.0035,inner,hand)
# Compact canvas backpack anchored to the chest with visible straps resting on shoulders.
rounded('Backpack body',(0,.265,1.16),(.43,.24,.52),.087,bag,'Chest')
rounded('Backpack front pocket',(0,.402,1.05),(.325,.075,.23),.045,bagtrim,'Chest')
rounded('Backpack flap',(0,.395,1.34),(.39,.065,.17),.047,bag,'Chest')
rounded('Leather backpack label',(0,.447,1.078),(.095,.012,.045),.01,leather,'Chest')
tube('Pocket zipper',[(-.14,.445,1.14),(0,.454,1.16),(.14,.445,1.14)],.007,leather,'Chest')
rounded('Zip pull',(.125,.462,1.105),(.016,.01,.047),.006,leather,'Chest')
tube('Bag carry handle',[(-.07,.26,1.415),(-.06,.275,1.49),(.06,.275,1.49),(.07,.26,1.415)],.017,bagtrim,'Chest')
for side in [-1,1]:
 tube('Shoulder strap',[(side*.145,.29,1.39),(side*.23,.065,1.425),(side*.24,-.13,1.33),(side*.24,-.174,1.14),(side*.21,.02,.94),(side*.17,.25,.97)],.025,bagtrim,'Chest')
 rounded('Strap adjuster',(side*.24,-.191,1.16),(.067,.022,.054),.007,leather,'Chest')
# Skeleton with explicit elbow/knee joints and hand attachment sockets.
bpy.ops.object.select_all(action='DESELECT');armdata=bpy.data.armatures.new('Student skeleton');rig=bpy.data.objects.new('JongwooRig',armdata);bpy.context.collection.objects.link(rig);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(name,a,b,parent=None):
 q=armdata.edit_bones.new(name);q.head=a;q.tail=b
 if parent:q.parent=armdata.edit_bones[parent]
 return q
bone('Root',(0,0,0),(0,0,.2));bone('Hips',(0,0,.82),(0,0,1.0),'Root');bone('Spine',(0,0,1.0),(0,0,1.25),'Hips');bone('Chest',(0,0,1.25),(0,0,1.43),'Spine');bone('Neck',(0,0,1.43),(0,0,1.61),'Chest');bone('Head',(0,0,1.61),(0,0,2.35),'Neck')
for side,tag in [(-1,'R'),(1,'L')]:
 bone('UpperArm.'+tag,(side*.25,0,1.36),(side*.40,-.005,1.095),'Chest');bone('Forearm.'+tag,(side*.40,-.005,1.095),(side*.46,-.015,.855),'UpperArm.'+tag);bone('Hand.'+tag,(side*.46,-.015,.855),(side*.47,-.015,.75),'Forearm.'+tag);bone('Grip.'+tag,(side*.465,-.055,.81),(side*.465,-.09,.81),'Hand.'+tag)
 bone('Thigh.'+tag,(side*.145,0,.83),(side*.16,0,.49),'Hips');bone('Shin.'+tag,(side*.16,0,.49),(side*.16,0,.19),'Thigh.'+tag);bone('Foot.'+tag,(side*.16,0,.19),(side*.16,-.20,.10),'Shin.'+tag)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
for p in parts:p.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name='JongwooStudent';mesh.parent=rig
mod=mesh.modifiers.new('Student skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
for p in rig.pose.bones:p.rotation_mode='XYZ'
def reset():
 for p in rig.pose.bones:p.rotation_euler=(0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
def key(frame):
 for p in rig.pose.bones:p.keyframe_insert('rotation_euler',frame=frame,group=p.name);p.keyframe_insert('location',frame=frame,group=p.name)
def action(name,last):
 a=bpy.data.actions.new(name);a.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=a;reset();return a
scene=bpy.context.scene;scene.render.fps=24
idle=action('Idle',97)
for f in range(1,98,4):
 reset();t=(f-1)/96*2*pi;rig.pose.bones['Spine'].rotation_euler.x=.012*sin(t);rig.pose.bones['Head'].rotation_euler.z=.025*sin(t);rig.pose.bones['Chest'].location.y=.006*sin(t);key(f)
walk=action('Walk',49)
for f in range(1,50,2):
 reset();t=(f-1)/48*2*pi;rig.pose.bones['Hips'].location.y=.014*(1-cos(2*t));rig.pose.bones['Hips'].rotation_euler.z=.024*sin(t)
 for side,tag in [(1,'L'),(-1,'R')]:
  phase=t+(0 if side==1 else pi);v=sin(phase)
  rig.pose.bones['Thigh.'+tag].rotation_euler.x=.36*v
  rig.pose.bones['Shin.'+tag].rotation_euler.x=-.38*max(0,-v)
  rig.pose.bones['Foot.'+tag].rotation_euler.x=-.13*v+.08*max(0,-v)
  rig.pose.bones['UpperArm.'+tag].rotation_euler.x=-.19*v
  rig.pose.bones['Forearm.'+tag].rotation_euler.x=.065+.035*v
 rig.pose.bones['Spine'].rotation_euler.z=-.016*sin(t);rig.pose.bones['Head'].rotation_euler.z=-.012*sin(t);key(f)
rig.animation_data.action=idle;scene.frame_set(1)
# Select only original asset for glTF; lights/studio remain in authoring scene.
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'jongwoo-student-v1.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_yup=True,export_skins=True)
# Studio setup for review renders.
world=bpy.data.worlds.new('Warm studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.76,.68,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45;scene.world=world
floor=mat('Studio cream',(.65,.68,.59),.9);bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor);bpy.context.object.name='Studio floor'
def light(name,pos,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
light('Window',(-3,-4,6),450,4,(1,.88,.72));light('Fill',(4,-2,3.5),220,3,(.78,.86,1));light('Rim',(1,3,5),480,3,(1,.94,.81))
bpy.ops.object.camera_add(location=(3.3,-6.5,3.0));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.25))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.15;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.frame_start=1;scene.frame_end=97;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'jongwoo-student-v1.blend'))
scene.render.filepath=str(OUT/'jongwoo-student-v1-front.png');bpy.ops.render.render(write_still=True)
cam.location=(3.8,6,3.1);cam.rotation_euler=(Vector((0,0,1.25))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/'jongwoo-student-v1-back.png');bpy.ops.render.render(write_still=True)
print('ORIGINAL_STUDENT_DONE',len(mesh.data.vertices),len(mesh.data.polygons),len(armdata.bones))
