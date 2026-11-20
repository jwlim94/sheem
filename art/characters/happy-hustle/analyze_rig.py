import bpy,bmesh,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[3];out=root/'art/characters/happy-hustle'
bpy.ops.wm.open_mainfile(filepath=str(out/'source-review.blend'))
p=bpy.data.objects['ReferencePresentation'];meshes=[o for o in p.children_recursive if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();o=bpy.context.object;mw=o.matrix_world.copy();o.parent=None;o.matrix_world=mw;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000015);bm.to_mesh(o.data);bm.free();me=o.data
adj=[[]for _ in me.vertices]
for e in me.edges:
 a,b=e.vertices;adj[a].append(b);adj[b].append(a)
seen=set();comps=[]
for v in me.vertices:
 if v.index in seen:continue
 stack=[v.index];seen.add(v.index);ids=[]
 while stack:
  i=stack.pop();ids.append(i)
  for j in adj[i]:
   if j not in seen:seen.add(j);stack.append(j)
 co=[me.vertices[i].co for i in ids];lo=[min(v[a]for v in co)for a in range(3)];hi=[max(v[a]for v in co)for a in range(3)];comps.append({'count':len(ids),'lo':lo,'hi':hi,'ids':ids})
comps.sort(key=lambda c:-c['count']);print('COMPONENTS',json.dumps([{k:v for k,v in c.items()if k!='ids'}for c in comps[:80]]))
(out/'components.json').write_text(json.dumps(comps))
o.name='SourceJoined';bpy.ops.wm.save_as_mainfile(filepath=str(out/'rig-analysis.blend'))
# Side view, texture intact.
sc=bpy.context.scene;cam=sc.camera;cam.location=(6,0,1.4);cam.rotation_euler=(Vector((0,0,1.35))-cam.location).to_track_quat('-Z','Y').to_euler();sc.render.filepath=str(out/'source-side.png');bpy.ops.render.render(write_still=True)
