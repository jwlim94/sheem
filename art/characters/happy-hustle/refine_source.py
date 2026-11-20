"""Small derivative edits of Golden Bean's Happy Hustle Boy; preserves source mesh.
Source: https://sketchfab.com/3d-models/happy-hustle-boy-bdc75c61891d42058fc414d0560f0a48
License: CC-BY-NC-SA-4.0. This is not an independently authored character or a rig.
Requires inspect_source.py's saved review scene.
"""
import bpy, json, math
import numpy as np
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[3]; out=root/'art/characters/happy-hustle'; public=root/'public/models/happy-hustle'
bpy.ops.wm.open_mainfile(filepath=str(out/'source-review.blend'))
parent=bpy.data.objects['ReferencePresentation']; meshes=[o for o in parent.children_recursive if o.type=='MESH']
# Normalize once for presentation; preserve every source vertex, UV, and triangle.
def select_asset():
 bpy.ops.object.select_all(action='DESELECT');parent.select_set(True)
 for o in parent.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=parent
meta={'title':'Happy Hustle Boy — subtle portfolio study','author':'Golden Bean','source':'https://sketchfab.com/3d-models/happy-hustle-boy-bdc75c61891d42058fc414d0560f0a48','license':'CC-BY-NC-SA-4.0','changes':'Original geometry and pose retained. Slightly muted spectacle frame; added small J badge on laptop. Presentation scale normalized. No rig or animation added.'}
for k,v in meta.items():parent[k]=v
parent['title']='Happy Hustle Boy — original comparison'
parent['changes']='Presentation scale and origin normalized only. Original mesh, materials and pose retained.'
select_asset();bpy.ops.export_scene.gltf(filepath=str(public/'happy-hustle-original.glb'),export_format='GLB',use_selection=True,export_extras=True)
for k,v in meta.items():parent[k]=v
material=meshes[0].data.materials[0];tex=next(n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='sRGB');w,h=tex.size
pixels=np.empty(w*h*4,dtype=np.float32);tex.pixels.foreach_get(pixels);pixels=pixels.reshape((h,w,4))
# Vertex tint multiplies the EXISTING PBR base texture. No texture replacement.
# Isolate the strongly red frame within the upper face, excluding cheeks/skin.
counts=[]
for ob in meshes:
 me=ob.data;col=me.color_attributes.new(name='SpectacleTint',type='FLOAT_COLOR',domain='CORNER');me.color_attributes.active_color=col
 changed=0;uv=me.uv_layers.active.data
 for i,loop in enumerate(me.loops):
  world=ob.matrix_world@me.vertices[loop.vertex_index].co
  p=uv[i].uv;c=pixels[min(h-1,max(0,int(p.y*h))),min(w-1,max(0,int(p.x*w)))];r,g,b=c[:3]
  # Coordinates below are normalized studio coordinates. Skin is much less red.
  sat=max(0,min(1,(r/max(g,.001)-1.8)/.5))*max(0,min(1,(r/max(b,.001)-1.7)/.5))
  zone=max(0,min(1,(world.z-1.72)/.04))*max(0,min(1,(2.13-world.z)/.05))
  front=max(0,min(1,(-world.y+.12)/.10));amount=sat*zone*front
  col.data[i].color=(1-.22*amount,1-.06*amount,1-.03*amount,1)
  if amount>.5:changed+=1
 counts.append(changed)
node=material.node_tree.nodes;links=material.node_tree.links;bsdf=next(n for n in node if n.type=='BSDF_PRINCIPLED');base=bsdf.inputs['Base Color'];original=base.links[0].from_socket
vc=node.new('ShaderNodeVertexColor');vc.layer_name='SpectacleTint';mix=node.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;links.new(original,mix.inputs[1]);links.new(vc.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],base)
# Locate the laptop front by a ray, then sit a tiny circular enamel badge on it.
# Original black mark is near x=0, z=1.0 in the normalized presentation.
origin=Vector((-.13,-3,1.10));direction=Vector((0,1,0));candidates=[]
for ob in meshes:
 inv=ob.matrix_world.inverted();hit,loc,normal,index=ob.ray_cast(inv@origin,(inv.to_3x3()@direction).normalized())
 if hit:
  wp=ob.matrix_world@loc;wn=(ob.matrix_world.to_3x3().inverted().transposed()@normal).normalized();candidates.append(((wp-origin).length,wp,wn))
if not candidates:raise RuntimeError('Laptop badge ray missed')
_,point,normal=min(candidates,key=lambda x:x[0]);print('BADGE_POINT',list(point),list(normal),'TINT_LOOPS',counts)
if normal.dot(direction)>0:normal=-normal
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.061,depth=.005,location=point+normal*.004)
badge=bpy.context.object;badge.name='Small ivory laptop badge';badge.rotation_euler=normal.to_track_quat('Z','Y').to_euler()
cream=bpy.data.materials.new('Badge ivory');cream.diffuse_color=(.86,.82,.68,1);cream.use_nodes=True;cream.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.86,.82,.68,1);cream.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.7;badge.data.materials.append(cream)
# Parent with world transform retained, because presentation parent has scale.
badge.parent=parent;badge.matrix_parent_inverse=parent.matrix_world.inverted()
bpy.ops.object.text_add(location=point+normal*.008);letter=bpy.context.object;letter.name='Laptop initial J';letter.data.body='J';letter.data.align_x='CENTER';letter.data.align_y='CENTER';letter.data.size=.087;letter.data.extrude=.0003;letter.rotation_euler=normal.to_track_quat('Z','Y').to_euler();green=bpy.data.materials.new('Badge sage ink');green.diffuse_color=(.10,.22,.16,1);letter.data.materials.append(green);letter.parent=parent;letter.matrix_parent_inverse=parent.matrix_world.inverted();bpy.ops.object.convert(target='MESH')
select_asset();bpy.ops.export_scene.gltf(filepath=str(public/'happy-hustle-refined.glb'),export_format='GLB',use_selection=True,export_extras=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'happy-hustle-refined.blend'))
sc=bpy.context.scene;sc.render.filepath=str(out/'refined-front.png');bpy.ops.render.render(write_still=True)
(public/'SOURCE.json').write_text(json.dumps(meta,indent=2)+'\n');print('REFINED_COMPLETE')
