import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[3]; out=root/'art/characters/happy-hustle'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath='/Users/jwlim94/Downloads/happy_hustle_boy.glb')
objects=list(bpy.context.scene.objects)
info=[]
for o in objects:
 if o.type=='MESH':
  info.append({'name':o.name,'vertices':len(o.data.vertices),'matrix':[list(r)for r in o.matrix_world],'bounds':[list(o.matrix_world@Vector(v))for v in o.bound_box]})
print('SOURCE_INFO',json.dumps(info))
for m in bpy.data.materials:
 if not m.use_nodes:continue
 print('MATERIAL',m.name,[(n.type,n.image.name if n.type=='TEX_IMAGE' and n.image else '')for n in m.node_tree.nodes])
for im in bpy.data.images:
 print('IMAGE',im.name,list(im.size),im.colorspace_settings.name)
# Normalize a parent root to 2.5 scene units without changing the source geometry.
pts=[o.matrix_world@Vector(v)for o in objects if o.type=='MESH' for v in o.bound_box]
lo=Vector(tuple(min(p[i]for p in pts)for i in range(3)));hi=Vector(tuple(max(p[i]for p in pts)for i in range(3)))
parent=bpy.data.objects.new('ReferencePresentation',None);bpy.context.collection.objects.link(parent)
for o in objects:
 if not o.parent:o.parent=parent
s=2.5/(hi.z-lo.z);parent.scale=(s,s,s);parent.location=(-(lo.x+hi.x)/2*s,-(lo.y+hi.y)/2*s,-lo.z*s+.08)
world=bpy.data.worlds.new('Warm studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.76,.68,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;bpy.context.scene.world=world
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio floor';mat=bpy.data.materials.new('Floor');mat.diffuse_color=(.67,.70,.63,1);floor.data.materials.append(mat)
for pos,power,size in [((-3,-4,6),420,4),((4,-2,3.5),200,3),((1,3,5),400,3)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.5,-6,2.8));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.3))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.3
sc=bpy.context.scene;sc.camera=cam;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True;sc.render.resolution_x=900;sc.render.resolution_y=1000;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'source-review.blend'))
sc.render.filepath=str(out/'source-front.png');bpy.ops.render.render(write_still=True)
