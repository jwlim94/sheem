"""Rebuild Sheem's rabbit with Blender 4.4+, no external assets or add-ons.

blender --background --python art/characters/rabbit/build_rabbit.py
Model coordinates: Z up, facing -Y. Export: Y up, facing +Z, meters.
"""
import bpy
import math
import random
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/models/rabbit'
SOURCE = Path(__file__).parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(12)

def material(name, color, roughness=0.88):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    tint = m.node_tree.nodes.new('ShaderNodeVertexColor')
    tint.layer_name = 'Tint'
    m.node_tree.links.new(tint.outputs['Color'], p.inputs['Base Color'])
    return m

# Linear colors, deliberately warm cream rather than bright white.
fur = material('Oatmeal', (0.76, 0.61, 0.43))
cream = material('Muzzle cream', (0.84, 0.70, 0.51))
peach = material('Ear peach', (0.64, 0.35, 0.21))
blush = material('Cheek peach', (0.77, 0.55, 0.38))
dark = material('Espresso eyes', (0.065, 0.042, 0.027), 0.55)
nose = material('Warm cocoa', (0.32, 0.16, 0.083))
glint = material('Eye glints', (0.98, 0.92, 0.78))
sage = material('Sage linen', (0.26, 0.34, 0.19))
sage_light = material('Sage folds', (0.34, 0.41, 0.25))
leather = material('Apricot leather', (0.55, 0.29, 0.14))
flapmat = material('Bag flap', (0.63, 0.36, 0.19))
stitchmat = material('Linen stitches', (0.76, 0.52, 0.30))
parts = []

def finish(obj, name, mat, bone, smooth=False):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    obj.name = name
    obj.data.materials.append(mat)
    tint = obj.data.color_attributes.new(name='Tint', type='FLOAT_COLOR', domain='POINT')
    for item in tint.data:
        item.color = mat.diffuse_color
    for p in obj.data.polygons:
        p.use_smooth = smooth
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    parts.append(obj)
    return obj

def ellipsoid(name, pos, scale, mat, bone='Body', smooth=False, segments=24, rings=14, rotate=None):
    if name in ['Head', 'Pear body', 'Cotton tail'] or name.startswith(('Arm.', 'Thigh.', 'Foot.')):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4 if name == 'Head' else 3 if name == 'Pear body' else 2, radius=1, location=pos)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    if rotate:
        obj.rotation_euler = rotate
    return finish(obj, name, mat, bone, smooth)

def mesh(name, verts, faces, mat, bone, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, bone, smooth)

def line(name, points, radius, mat, bone='Head'):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 4
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = 'AUTO'
        p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object, name, mat, bone, True)

def ribbon(name, points, width, mat, bone='Body'):
    verts = []
    for i, p in enumerate(points):
        prev = Vector(points[max(0, i-1)])
        nex = Vector(points[min(len(points)-1, i+1)])
        tangent = nex-prev
        # Width lies in X/Z; path follows front or back of the torso.
        across = Vector((tangent.z, 0, -tangent.x)).normalized() * width/2
        verts += [Vector(p)-across, Vector(p)+across]
    faces = [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(len(points)-1)]
    obj = mesh(name, verts, faces, mat, bone)
    mod = obj.modifiers.new('Leather thickness', 'SOLIDIFY')
    mod.thickness = 0.014
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

# Rounded pear body, fuller at the hips. Deliberate facets keep the meadow style.
body = ellipsoid('Pear body', (0, 0.03, 0.86), (0.435, 0.33, 0.59), fur, segments=24, rings=16)
for v in body.data.vertices:
    t = (v.co.z-.86)/.59
    v.co.x *= 1-.13*t


for side, s in [('L', 1), ('R', -1)]:
    ellipsoid('Thigh.'+side, (s*.235, .035, .37), (.21, .225, .31), fur, 'Leg.'+side, segments=18, rings=12)
    ellipsoid('Foot.'+side, (s*.25, -.125, .12), (.205, .29, .13), fur, 'Leg.'+side, segments=20, rings=10)
    # Small toe seams follow the top of the forefoot, without separated fingers.
    for offset in [-.056, .056]:
        x = s*.25+offset
        line('Toe seam', [(x,-.366,.139),(x,-.325,.19),(x,-.277,.222)], .005, peach, 'Leg.'+side)
    ellipsoid('Arm.'+side, (s*.445, -.015, .89), (.145,.155,.405), fur, 'Arm.'+side, segments=18, rings=12, rotate=(0,s*-.28,0))

ellipsoid('Cotton tail', (0, .365, .60), (.185,.18,.18), cream, 'Tail', segments=18, rings=12)

# Keep the rounded cheek profile; trim V7's lateral swelling from .090 to .075.
# The broad vertical falloff keeps the outermost turn round rather than a ridge.
head = ellipsoid('Head', (0, -.015, 1.73), (.575,.435,.475), fur, 'Head', segments=32, rings=20)
for v in head.data.vertices:
    x, y, z = v.co
    t = (z - 1.73) / .475
    cheek = math.exp(-((z - 1.535) / .265) ** 2)
    side = min(1, abs(x) / .575)
    v.co.x = x * (.86 - .04 * t) + math.copysign(.075 * cheek * side ** .7, x)
    # Only a trace of depth: no paired lumps on the back or front surface.
    v.co.y = -.015 + (y + .015) * (1 + .025 * cheek * side)
head.data.update()

# Leaf-shaped ears are solid lofted meshes with inset peach front panels.
for side, s, lean, height in [('L',1,.17,.84),('R',-1,.24,.79)]:
    base = Vector((s*.265, .025, 2.08))
    verts, faces = [], []
    steps, around = 12, 16
    def ear_center(t):
        return base + Vector((s*lean*t, .02*math.sin(t*math.pi), height*t))
    for i in range(steps+1):
        t=i/steps
        w=.155*math.sin(math.pi*t)**.72+.009
        depth=.065*math.sin(math.pi*t)**.65+.006
        for j in range(around):
            a=2*math.pi*j/around
            p=ear_center(t)+Vector((w*math.cos(a),depth*math.sin(a),0))
            verts.append(p)
    for i in range(steps):
        for j in range(around):
            a=i*around+j; b=i*around+(j+1)%around
            faces.append((a,b,b+around,a+around))
    faces += [tuple(reversed(range(around))), tuple(steps*around+j for j in range(around))]
    mesh('Ear.'+side, verts, faces, fur, 'Ear.'+side)
    # Convex inset follows the actual front surface; cream border remains visible.
    verts, faces = [], []
    for i in range(11):
        t=.12+.76*i/10
        outer=.155*math.sin(math.pi*t)**.72+.009
        w=.105*math.sin(math.pi*i/10)**.7+.002
        depth=.065*math.sin(math.pi*t)**.65+.006
        for j in range(5):
            x=w*(j/2-1)
            p=ear_center(t)+Vector((x,-depth*math.sqrt(max(0,1-(x/outer)**2))-.003,0))
            verts.append(p)
    for i in range(10):
        for j in range(4):
            k=i*5+j
            faces.append((k,k+1,k+6,k+5))
    mesh('Inner ear.'+side, verts, faces, peach, 'Ear.'+side, True)

# Paint the features into the head material: zero eye/brow/mouth silhouette.
# Planar UVs are restricted to front polygons; the rear samples plain fur.
SIZE = 768
xx, zz = np.meshgrid(np.linspace(-.65,.65,SIZE), np.linspace(1.20,2.28,SIZE))
paint = np.empty((SIZE,SIZE,4), dtype=np.float32)
paint[:] = tuple(fur.diffuse_color)

def blend_face(color, alpha):
    alpha = np.clip(alpha,0,1)[...,None]
    paint[:,:,:3] = paint[:,:,:3]*(1-alpha) + np.array(color[:3])*alpha

def oval(cx,cz,rx,rz,color,soft=.035,opacity=1):
    d=np.sqrt(((xx-cx)/rx)**2+((zz-cz)/rz)**2)
    blend_face(color, np.clip((1-d)/soft,0,1)*opacity)

def stroke(points, radius, color):
    distance=np.full_like(xx,100)
    for (ax,az),(bx,bz) in zip(points,points[1:]):
        dx=bx-ax;dz=bz-az
        t=np.clip(((xx-ax)*dx+(zz-az)*dz)/(dx*dx+dz*dz),0,1)
        distance=np.minimum(distance,np.sqrt((xx-ax-t*dx)**2+(zz-az-t*dz)**2))
    blend_face(color,np.clip((radius+.0015-distance)/.003,0,1))

def bezier(a,b,c,count=32):
    return [((1-t)**2*a[0]+2*(1-t)*t*b[0]+t*t*c[0],
             (1-t)**2*a[1]+2*(1-t)*t*b[1]+t*t*c[1])
            for t in np.linspace(0,1,count)]

oval(0,1.56,.215,.13,cream.diffuse_color,soft=.65,opacity=.4)
for sign in [-1,1]:
    oval(sign*.35,1.63,.125,.078,(.84,.43,.26),soft=1,opacity=.35)
    oval(sign*.235,1.78,.052,.077,dark.diffuse_color)
    oval(sign*.235-.013,1.81,.010,.013,glint.diffuse_color)
    stroke(bezier((sign*.177,1.965),(sign*.221,1.993),(sign*.268,1.977)),.0085,nose.diffuse_color)
    stroke(bezier((0,1.569),(sign*.048,1.527),(sign*.11,1.561)),.0055,nose.diffuse_color)
stroke([(0,1.638),(0,1.569)],.0055,nose.diffuse_color)

# Store sRGB pixels; the glTF texture loader decodes them to linear for lighting.
linear=paint[:,:,:3]
paint[:,:,:3]=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
face_image=bpy.data.images.new('Rabbit painted face',width=SIZE,height=SIZE,alpha=True)
face_image.colorspace_settings.name='sRGB'
face_image.pixels.foreach_set(paint.ravel())
face_image.filepath_raw=str(SOURCE/'rabbit-face-v8.png')
face_image.file_format='PNG'
face_image.save();face_image.pack()
face_mat=bpy.data.materials.new('Painted face');face_mat.use_nodes=True
principled=face_mat.node_tree.nodes.get('Principled BSDF')
principled.inputs['Roughness'].default_value=.92
texture=face_mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=face_image
face_mat.node_tree.links.new(texture.outputs['Color'],principled.inputs['Base Color'])
head.data.materials[0]=face_mat
for item in head.data.color_attributes['Tint'].data: item.color=(1,1,1,1)
head.data.update()
while head.data.uv_layers:
    head.data.uv_layers.remove(head.data.uv_layers[0])
uv=head.data.uv_layers.new(name='UVMap')
for polygon in head.data.polygons:
    front=polygon.center.y<-.05
    for loop_index in polygon.loop_indices:
        v=head.data.vertices[head.data.loops[loop_index].vertex_index].co
        uv.data[loop_index].uv=((v.x+.65)/1.3,(v.z-1.2)/1.08) if front else (.01,.01)

# Only the tiny nose has relief, embedded against the actual faceted head.
def face_y(x,z):
    hit,point,normal,index=head.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    if not hit: raise RuntimeError('Face projection missed head')
    return point.y
nose_points=[(-.047,1.668),(.047,1.668),(0,1.626),(0,1.651)]
verts=[(x,face_y(x,z)-(.010 if i==3 else .001),z) for i,(x,z) in enumerate(nose_points)]
mesh('Inset nose',verts,[(0,1,3),(1,2,3),(2,0,3)],nose,'Head',True)

# Folded kerchief collar: polygonal ring and two soft tapered ends.
verts, faces = [], []
for row in range(3):
    for j in range(24):
        a=2*math.pi*j/24
        r=[.27,.315,.30][row]
        verts.append((r*math.cos(a),r*.87*math.sin(a),[1.45,1.36,1.28][row]+.018*math.sin(3*a)))
for row in range(2):
    for j in range(24):
        k=row*24+j; n=row*24+(j+1)%24
        faces.append((k,n,n+24,k+24))
mesh('Folded scarf',verts,faces,sage,'Body')
line('Collar fold',[(-.27,-.09,1.39),(-.17,-.25,1.35),(0,-.279,1.34),(.17,-.24,1.38)],.023,sage_light,'Body')
ellipsoid('Scarf knot',(.20,-.263,1.345),(.065,.056,.078),sage_light,'Body',segments=14,rings=10)
mesh('Scarf left end',[(.19,-.28,1.34),(.095,-.36,1.20),(.09,-.365,1.09),(.21,-.32,1.18),(.245,-.29,1.32),(.16,-.385,1.23)],[(0,1,5),(1,2,5),(2,3,5),(3,4,5),(4,0,5)],sage,'Body')
mesh('Scarf right end',[(.22,-.26,1.33),(.31,-.26,1.30),(.395,-.22,1.16),(.285,-.31,1.20),(.30,-.32,1.26)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],sage_light,'Body')

# Crossbody strap wraps over shoulder and around back, not a floating diagonal.
ribbon('Front strap',[(.28,-.09,1.38),(.28,-.25,1.26),(.20,-.315,1.12),(.10,-.325,.98),(-.05,-.33,.85),(-.20,-.315,.72)],.082,flapmat)
ribbon('Back strap',[(-.285,-.255,.75),(-.40,-.12,.72),(-.43,.04,.72),(-.36,.24,.74),(-.21,.345,.84),(-.09,.37,1.0),(.09,.335,1.19),(.25,.20,1.35),(.28,.02,1.39),(.28,-.09,1.38)],.082,leather)

def rounded_box(name,pos,size,mat,bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    obj=bpy.context.object
    obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    m=obj.modifiers.new('Rounded sewn corners','BEVEL');m.width=bevel;m.segments=3
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=m.name)
    return finish(obj,name,mat,'Body')

rounded_box('Satchel',(-.285,-.307,.72),(.35,.17,.33),leather,.065)
rounded_box('Bag flap',(-.285,-.403,.80),(.35,.035,.18),flapmat,.045)
rounded_box('Clasp tab',(-.285,-.43,.72),(.047,.019,.095),leather,.012)
ellipsoid('Brass clasp',(-.285,-.447,.746),(.020,.009,.019),stitchmat,'Body',True,12,8)
for i in range(8):
    x=-.423+i*.039
    line('Bag stitch',[(x,-.426,.846),(x+.012,-.426,.846)],.0025,stitchmat,'Body')

# One mesh with material slots and a genuine armature. Soft body deformation and
# a walk cycle are deliberately left for the locomotion milestone.
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    # Vertex paint carries the palette; only two roughness materials are needed.
    if obj != head:
        obj.data.materials[0] = dark if obj.data.materials[0] == dark else fur
    obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join()
character=bpy.context.object
character.name='Rabbit'
SCALE=.58
for v in character.data.vertices: v.co*=SCALE

arm_data=bpy.data.armatures.new('Rabbit skeleton')
rig=bpy.data.objects.new('RabbitRig',arm_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
character.select_set(False);rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bones={
 'Root':((0,0,0),(0,0,.2),None),
 'Body':((0,0,.62),(0,0,1.32),'Root'),
 'Head':((0,0,1.36),(0,0,2.12),'Body'),
 'Ear.L':((.265,.025,2.08),(.435,.025,2.92),'Head'),
 'Ear.R':((-.265,.025,2.08),(-.505,.025,2.87),'Head'),
 'Arm.L':((.36,0,1.19),(.53,-.05,.62),'Body'),
 'Arm.R':((-.36,0,1.19),(-.53,-.05,.62),'Body'),
 'Leg.L':((.235,.035,.57),(.25,-.125,.12),'Root'),
 'Leg.R':((-.235,.035,.57),(-.25,-.125,.12),'Root'),
 'Tail':((0,.28,.60),(0,.47,.60),'Body'),
}
for name,(a,b,parent) in bones.items():
    bone=arm_data.edit_bones.new(name)
    bone.head=Vector(a)*SCALE;bone.tail=Vector(b)*SCALE
    if parent: bone.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
character.parent=rig
mod=character.modifiers.new('Rabbit armature','ARMATURE');mod.object=rig
rig.show_in_front=True

# Quiet four-second loop, no constant bobbing or locomotion implied.
for pb in rig.pose.bones: pb.rotation_mode='XYZ'
for frame in [1,31,61,91,121]:
    t=(frame-1)/120*math.tau
    pb=rig.pose.bones['Body'];pb.location.z=.005*math.sin(t)
    pb.keyframe_insert('location',frame=frame,group='Body')
    pb=rig.pose.bones['Head'];pb.rotation_euler=(.015*math.sin(t),0,.025*math.sin(t))
    pb.keyframe_insert('rotation_euler',frame=frame,group='Head')
    for side,s in [('L',1),('R',-1)]:
        pb=rig.pose.bones['Ear.'+side]
        pb.rotation_euler=(.02*math.sin(t),s*.025*math.sin(t),0)
        pb.keyframe_insert('rotation_euler',frame=frame,group='Ear.'+side)
rig.animation_data.action.name='Idle'
bpy.context.scene.frame_set(1)
scene=bpy.context.scene
scene.frame_start=1;scene.frame_end=121;scene.render.fps=30

OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
character.select_set(True);rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'sheem-rabbit-v8.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_yup=True,export_skins=True)

# Save an editable model plus a small neutral presentation setup in the .blend.
ground=material('Studio sand',(.64,.67,.52))
ground.node_tree.links.remove(ground.node_tree.nodes['Principled BSDF'].inputs['Base Color'].links[0])
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(ground)
def aim(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,1))
area('Large warm key',(-3,-4,6),450,4)
area('Soft fill',(4,-2,3),180,5)
area('Ear rim',(0,3,4),280,3)
world=bpy.data.worlds.new('Soft studio');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.79,.83,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.world=world
cam_data=bpy.data.cameras.new('Portrait');cam=bpy.data.objects.new('Portrait',cam_data)
bpy.context.collection.objects.link(cam);cam.location=(2.6,-5,2.2);aim(cam,(0,0,.87))
cam_data.type='ORTHO';cam_data.ortho_scale=2.25;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'sheem-rabbit-v8.blend'))
scene.render.filepath=str(SOURCE/'rabbit-preview-v8.png')
bpy.ops.render.render(write_still=True)
character.data.calc_loop_triangles()
print('RABBIT_TRIANGLES',len(character.data.loop_triangles))
print('RABBIT_HEIGHT_METERS',round(character.dimensions.z,3))

cam.location=(0,5,1.75);aim(cam,(0,0,.87))
scene.render.filepath=str(SOURCE/'rabbit-back-v8.png')
bpy.ops.render.render(write_still=True)
