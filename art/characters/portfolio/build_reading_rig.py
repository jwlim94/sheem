"""Build a non-destructive V65 derivative with articulated plush arms.
Run: Blender -b --python art/characters/portfolio/build_reading_rig.py
"""
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'art/characters/rabbit/sheem-rabbit-v65.blend'
OUT=ROOT/'art/characters/portfolio'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['RabbitRig']; mesh=bpy.data.objects['Rabbit']
rig.animation_data.action=None
for pb in rig.pose.bones:
 pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
profiles={}
for side in ['L','R']:
 upper=rig.data.edit_bones['Arm.'+side]
 shoulder=upper.head.copy();wrist=upper.tail.copy()
 elbow=shoulder.lerp(wrist,.52)
 # Retain the original bind direction so the authored walk/run clips still work.
 upper.tail=elbow
 fore=rig.data.edit_bones.new('Forearm.'+side);fore.head=elbow;fore.tail=wrist
 fore.parent=upper;fore.use_connect=True
 hand=rig.data.edit_bones.new('Hand.'+side);hand.head=wrist
 hand.tail=wrist+(wrist-shoulder).normalized()*.065
 hand.parent=fore;hand.use_connect=True
 profiles[side]=(shoulder,elbow,wrist,hand.tail.copy())
bpy.ops.object.mode_set(mode='OBJECT')
for side,(shoulder,elbow,wrist,tip) in profiles.items():
 upper=mesh.vertex_groups['Arm.'+side]
 fore=mesh.vertex_groups.new(name='Forearm.'+side)
 hand=mesh.vertex_groups.new(name='Hand.'+side)
 axis=(wrist-shoulder).normalized();elbow_t=(elbow-shoulder).length;wrist_t=(wrist-shoulder).length
 def smooth(v):
  v=max(0,min(1,v));return v*v*(3-2*v)
 for v in mesh.data.vertices:
  weight=next((g.weight for g in v.groups if g.group==upper.index),0)
  if weight<=0:continue
  t=(v.co-shoulder).dot(axis)
  lower=smooth((t-elbow_t+.045)/.09)
  palm=smooth((t-wrist_t+.03)/.06)
  upper.add([v.index],weight*(1-lower),'REPLACE')
  fore.add([v.index],weight*lower*(1-palm),'REPLACE')
  hand.add([v.index],weight*lower*palm,'REPLACE')
 # A visible palm-center socket, independent of the mesh's rounded fingertip.
 bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
 socket=rig.data.edit_bones.new('Grip.'+side)
 socket.head=wrist+(tip-wrist).normalized()*.05
 socket.tail=socket.head+(tip-wrist).normalized()*.01
 socket.parent=rig.data.edit_bones['Hand.'+side]
 bpy.ops.object.mode_set(mode='OBJECT')
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'portfolio-reading-rig.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/rabbit/portfolio-reading-rig.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_yup=True,export_skins=True)
print('Reading rig: elbows, wrists, grip sockets and blended weights exported; V65 source preserved.')
