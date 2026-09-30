"""Blender: add a compact waddle rig to the unmodified imported duck source."""
import bpy, math
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/duck/little-duck.glb'))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
rotation=Matrix.Rotation(-math.pi/2,4,'Z')
coords=[rotation@mesh.matrix_world@v.co for v in mesh.data.vertices]
minimum=Vector(tuple(min(v[i] for v in coords) for i in range(3)))
maximum=Vector(tuple(max(v[i] for v in coords) for i in range(3)))
center=(minimum+maximum)/2;center.z=minimum.z
scale=1.45/(maximum.z-minimum.z)
mesh.parent=None;mesh.matrix_world=Matrix.Identity(4)
for v,co in zip(mesh.data.vertices,coords):v.co=(co-center)*scale
mesh.name='Duck'
arm=bpy.data.armatures.new('Duck skeleton');rig=bpy.data.objects.new('DuckRig',arm)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,head,tail,parent in [
 ('Root',(0,0,0),(0,0,.1),None),
 ('Body',(0,0,.36),(0,0,1.1),'Root'),
 ('Foot.L',(.27,0,.22),(.27,-.25,.08),'Root'),
 ('Foot.R',(-.27,0,.22),(-.27,-.25,.08),'Root')]:
 b=arm.edit_bones.new(name);b.head=head;b.tail=tail
 if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
mesh.vertex_groups.clear()
groups={n:mesh.vertex_groups.new(name=n) for n in ['Body','Foot.L','Foot.R']}
for v in mesh.data.vertices:
 t=max(0,min(1,(v.co.z-.16)/.24));body=t*t*(3-2*t)
 groups['Body'].add([v.index],body,'REPLACE')
 groups['Foot.L' if v.co.x>0 else 'Foot.R'].add([v.index],1-body,'REPLACE')
mesh.parent=rig;mod=mesh.modifiers.new('Duck waddle','ARMATURE');mod.object=rig
scene=bpy.context.scene;scene.render.fps=30
for name,duration,stride,lift in [('Idle',2,0,0),('Walk',1,.16,.075),('Run',.7,.22,.105)]:
 rig.animation_data_clear();count=round(duration*30)
 for frame in range(count+1):
  phase=math.tau*frame/count
  for pb in rig.pose.bones:
   pb.rotation_mode='XYZ';pb.location=(0,0,0);pb.rotation_euler=(0,0,0)
  body=rig.pose.bones['Body']
  # Feet remain rooted independently while the rounded body waddles over them.
  offset=Vector((0,0,.008*math.sin(phase) if name=='Idle' else .015*(1-math.cos(2*phase))))
  body.location=body.bone.matrix_local.to_3x3().inverted()@offset
  body.rotation_euler[2]=(.012 if name=='Idle' else .045)*math.sin(phase)
  for side,shift in [('L',0),('R',math.pi)]:
   p=phase+shift;pb=rig.pose.bones['Foot.'+side]
   # Front is -Y: lifted swing travels rear-to-front; planted stance
   # travels front-to-rear relative to the advancing body.
   offset=Vector((0,stride*math.cos(p),lift*max(0,math.sin(p))**2))
   pb.location=pb.bone.matrix_local.to_3x3().inverted()@offset
  for pb in rig.pose.bones:
   pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_euler',frame=frame)
 action=rig.animation_data.action;action.name=name;action.use_fake_user=True
 for curve in action.fcurves:
  for key in curve.keyframe_points:key.interpolation='LINEAR'
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/duck/little-duck-animated-v2.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/characters/duck/little-duck-animated-v2.blend'))
print('DUCK_ANIMATIONS',[(a.name,a.frame_range[:]) for a in bpy.data.actions])
