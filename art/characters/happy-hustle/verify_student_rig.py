"""Numerical animation acceptance checks; run with Blender after animate_student.py."""
import bpy,json,numpy as np
from pathlib import Path
out=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(out/'happy-student-rigged.blend'))
rig=bpy.data.objects['HappyStudentRig'];mesh=bpy.data.objects['HappyStudent'];sc=bpy.context.scene
edges=np.array([e.vertices[:]for e in mesh.data.edges]);base=np.array([v.co[:]for v in mesh.data.vertices]);length=np.linalg.norm(base[edges[:,0]]-base[edges[:,1]],axis=1);valid=length>.005
report={}
for name in ['Idle','Walk','Wave']:
 a=bpy.data.actions[name];rig.animation_data.action=a;start,end=map(int,a.frame_range);sc.frame_set(start);first=np.array([list(v)for pb in rig.pose.bones for v in pb.matrix]);sc.frame_set(end);last=np.array([list(v)for pb in rig.pose.bones for v in pb.matrix]);loop=float(np.max(np.abs(first-last)));assert loop<.0001,(name,'loop',loop)
 floor=10;stretch=0
 for f in np.linspace(start,end,17):
  sc.frame_set(int(f),subframe=float(f%1));obj=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());me=obj.to_mesh();p=np.empty(len(me.vertices)*3);me.vertices.foreach_get('co',p);p=p.reshape(-1,3);assert np.isfinite(p).all();floor=min(floor,float(p[:,2].min()));ratio=np.linalg.norm(p[edges[:,0]]-p[edges[:,1]],axis=1)[valid]/length[valid];stretch=max(stretch,float(ratio.max()));obj.to_mesh_clear()
 assert floor>=-.003,(name,'ground penetration',floor)
 assert stretch<2,(name,'excessive surface stretch',stretch)
 report[name]={'loop_matrix_error':loop,'min_surface_z':floor,'max_edge_length_ratio':stretch,'samples':17}
(out/'rig-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('RIG_VALIDATION',json.dumps(report))
