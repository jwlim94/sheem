"""Baked humanoid animation clips for the reconstructed Happy Hustle Boy study."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from math import sin,cos,pi
root=Path(__file__).resolve().parents[3];out=root/'art/characters/happy-hustle';pub=root/'public/models/happy-hustle'
bpy.ops.wm.open_mainfile(filepath=str(out/'happy-student-rigged.blend'))
rig=bpy.data.objects['HappyStudentRig'];mesh=bpy.data.objects['HappyStudent'];sc=bpy.context.scene;sc.render.fps=24
rest={b.name:b.matrix_local.copy()for b in rig.data.bones};poses={};identity=Quaternion((1,0,0,0))
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def reset():
 poses.clear()
 for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
def fk(n,q=None,loc=None):
 b=rig.data.bones[n];parent=b.parent;base=(poses[parent.name]@rest[parent.name].inverted()@rest[n])if parent else rest[n].copy();basis=(Matrix.Translation(Vector(loc))if loc else Matrix.Identity(4))@(q.to_matrix().to_4x4()if q else Matrix.Identity(4));poses[n]=base@basis
 return poses[n]
def world(n,head,direction=None):
 b=rig.data.bones[n];q=rest[n].to_quaternion()
 if direction:q=(b.tail_local-b.head_local).rotation_difference(Vector(direction))@q
 poses[n]=Matrix.Translation(Vector(head))@q.to_matrix().to_4x4();return poses[n]
def direction(n,d,amount=1):
 b=rig.data.bones[n];parent=b.parent;current=poses[parent.name]@rest[parent.name].inverted()@rest[n];currentdir=current.to_quaternion()@Vector((0,1,0));delta=currentdir.rotation_difference(Vector(d));q=identity.slerp(delta,amount)@current.to_quaternion();poses[n]=Matrix.Translation(current.translation)@q.to_matrix().to_4x4()
def finish(frame):
 # Convert world-space solved joints into normal local FK animation tracks.
 for p in rig.pose.bones:
  n=p.name
  if n not in poses:fk(n)
  parent=p.parent
  local=poses[parent.name].inverted()@poses[n]if parent else poses[n]
  bind=rest[parent.name].inverted()@rest[n]if parent else rest[n]
  p.matrix_basis=bind.inverted()@local
  p.keyframe_insert('location',frame=frame,group=n);p.keyframe_insert('rotation_quaternion',frame=frame,group=n)
def action(name):
 a=bpy.data.actions.new(name);a.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=a;return a
def base(bob=0):
 fk('Root');fk('Hips',loc=(0,bob,0));fk('Spine');fk('Chest');fk('Neck');fk('Head')
clips={}
a=action('Idle')
for f in range(97):
 reset();t=2*pi*f/96;base();fk('Spine',Quaternion((1,0,0),.008*sin(t)));fk('Chest',loc=(0,.003*sin(t),0));fk('Neck');fk('Head',Quaternion((0,1,0),.025*sin(t))@Quaternion((1,0,0),.010*sin(t+.6)))
 for side,tag in [(-1,'R'),(1,'L')]:fk('UpperArm.'+tag,Quaternion((1,0,0),.025*sin(t+side*.5)));fk('Forearm.'+tag,Quaternion((1,0,0),.02*sin(t)));fk('Hand.'+tag);fk('Grip.'+tag);fk('Thigh.'+tag);fk('Shin.'+tag);fk('Foot.'+tag)
 finish(f+1)
clips['Idle']=a
# In-place walk, with world-space two-bone IK and an explicit planted stance phase.
a=action('Walk')
for f in range(33):
 reset();t=f/32;bob=-.026+.008*cos(4*pi*t);base(bob);fk('Spine',Quaternion((0,1,0),.014*sin(2*pi*t)));fk('Chest');fk('Neck');fk('Head',Quaternion((0,1,0),-.01*sin(2*pi*t)))
 for side,tag in [(-1,'R'),(1,'L')]:
  phase=(t+(0 if side<0 else .5))%1;stride=.115
  if phase<.6:y=-stride+2*stride*phase/.6;lift=0
  else:u=(phase-.6)/.4;y=stride-2*stride*smooth(u);lift=.070*sin(pi*u)**1.3
  thigh=rig.data.bones['Thigh.'+tag];shin=rig.data.bones['Shin.'+tag];foot=rig.data.bones['Foot.'+tag]
  h=(poses['Hips']@rest['Hips'].inverted()@rest[thigh.name]).translation;ankle=foot.head_local+Vector((0,y,lift));v=ankle-h;dist=min(v.length,thigh.length+shin.length-.00001);axis=v.normalized();along=(thigh.length**2-shin.length**2+dist**2)/(2*dist);height=math.sqrt(max(0,thigh.length**2-along**2));forward=Vector((0,-1,0));bend=(forward-axis*forward.dot(axis)).normalized();k=h+axis*along+bend*height
  world(thigh.name,h,k-h);world(shin.name,k,ankle-k);world(foot.name,ankle)
  fk('UpperArm.'+tag,Quaternion((1,0,0),side*.16*sin(2*pi*t)));fk('Forearm.'+tag,Quaternion((1,0,0),-.055+.025*cos(2*pi*phase)));fk('Hand.'+tag);fk('Grip.'+tag)
 finish(f+1)
clips['Walk']=a
# Greeting returns to neutral, with a eased shoulder lift and a small wrist wave.
a=action('Wave')
for f in range(73):
 reset();t=f/24;amount=smooth(t/.65)*(1-smooth((t-2.15)/.85));base();fk('Head',Quaternion((0,1,0),-.055*amount))
 direction('UpperArm.R',(-.98,-.08,.10),amount);direction('Forearm.R',(-.70,-.10,.70),amount);fk('Hand.R',Quaternion((0,0,1),.15*sin(2*pi*(t-.65)*2)*amount));fk('Grip.R')
 fk('UpperArm.L');fk('Forearm.L');fk('Hand.L');fk('Grip.L')
 for tag in ['R','L']:fk('Thigh.'+tag);fk('Shin.'+tag);fk('Foot.'+tag)
 finish(f+1)
clips['Wave']=a
for a in clips.values():
 for layer in a.layers:
  for strip in layer.strips:
   for slot in a.slots:
    try:bag=strip.channelbag(slot)
    except:continue
    if bag:
     for fc in bag.fcurves:
      for key in fc.keyframe_points:key.interpolation='LINEAR'
# Structural checks are independent of the viewer.
assert len(rig.data.bones)==20
for v in mesh.data.vertices:
 assert all(math.isfinite(x)for x in v.co)
 assert abs(sum(g.weight for g in v.groups)-1)<.0001,('weight',v.index)
rig.animation_data.action=clips['Idle'];sc.frame_start=1;sc.frame_end=97;sc.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(pub/'happy-student-rigged.glb'),export_format='GLB',use_selection=True,export_extras=True,export_skins=True,export_animations=True,export_animation_mode='ACTIONS')
# Save a convenient front studio view with the rig ready to pose.
sc.camera.location=(3.5,-6,2.8);sc.camera.rotation_euler=(Vector((0,0,1.3))-sc.camera.location).to_track_quat('-Z','Y').to_euler();bpy.ops.wm.save_as_mainfile(filepath=str(out/'happy-student-rigged.blend'))
for name,frame in [('Idle',1),('Walk',9),('Wave',31)]:
 rig.animation_data.action=clips[name];sc.frame_set(frame);sc.render.filepath=str(out/('student-'+name.lower()+'.png'));bpy.ops.render.render(write_still=True)
print('ANIMATION_COMPLETE',[(n,a.frame_range[:])for n,a in clips.items()])
