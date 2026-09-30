"""Rebuild Sheem's rabbit with Blender 4.4+, no external assets or add-ons.

blender --background --python art/characters/rabbit/build_rabbit.py
Model coordinates: Z up, facing -Y. Export: Y up, facing +Z, meters.
"""
import bpy
import math
import random
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'rigging'))
from two_bone_ik import solve_two_bone

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
# Short-pile fur uses embedded tangent normals and broad cloth-like sheen.
# Accessories keep their original untextured material.
accessory = material('Matte accessories', (1,1,1))

def fiber_normal(size, seed, mask=None):
    rng = np.random.default_rng(seed)
    grain = rng.normal(size=(size,size))
    fx = np.fft.fftfreq(size)[None,:]
    fy = np.fft.fftfreq(size)[:,None]
    # Fine, softly elongated fibers; periodic filtering keeps the tile seamless.
    filtered = np.fft.ifft2(np.fft.fft2(grain)*np.exp(-2*math.pi**2*(fx*fx*.85**2+fy*fy*3.2**2))).real
    dx = (np.roll(filtered,-1,1)-np.roll(filtered,1,1))*.5
    dy = (np.roll(filtered,-1,0)-np.roll(filtered,1,0))*.5
    norm = max(np.std(dx),1e-6)
    dx,dy = dx/norm*.22,dy/norm*.22
    if mask is not None: dx,dy = dx*mask,dy*mask
    normals = np.stack((-dx,-dy,np.ones_like(dx)),axis=-1)
    normals /= np.linalg.norm(normals,axis=-1,keepdims=True)
    rgba = np.ones((size,size,4),dtype=np.float32)
    rgba[:,:,:3] = normals*.5+.5
    return rgba

def packed_image(name, pixels, filename):
    size = pixels.shape[0]
    img = bpy.data.images.new(name,width=size,height=size,alpha=True)
    img.colorspace_settings.name='Non-Color'
    img.pixels.foreach_set(pixels.ravel())
    img.filepath_raw=str(SOURCE/filename);img.file_format='PNG'
    img.save();img.pack()
    return img

def soft_fur_material(mat, normal_image, uv_name, strength=.45):
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    shader=nodes['Principled BSDF']
    shader.inputs['Roughness'].default_value=1
    shader.inputs['Sheen Weight'].default_value=.3
    shader.inputs['Sheen Tint'].default_value=(.22,.18,.13,1)
    shader.inputs['Sheen Roughness'].default_value=.9
    tex=nodes.new('ShaderNodeTexImage');tex.image=normal_image
    uv=nodes.new('ShaderNodeUVMap');uv.uv_map=uv_name
    normal=nodes.new('ShaderNodeNormalMap');normal.uv_map=uv_name
    normal.inputs['Strength'].default_value=strength
    links.new(uv.outputs['UV'],tex.inputs['Vector'])
    links.new(tex.outputs['Color'],normal.inputs['Color'])
    links.new(normal.outputs['Normal'],shader.inputs['Normal'])

fur_tile=packed_image('Short fur normals',fiber_normal(256,731),'rabbit-fur-normal-v49.png')
soft_fur_material(fur,fur_tile,'FurUV')
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
        p.use_smooth = smooth or mat == fur or name == 'Cotton tail'
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
    # A shallow local flank recess leaves room for a relaxed hanging arm.
    flank=math.exp(-((v.co.z-.91)/.19)**2-((v.co.y+.015)/.19)**2)
    v.co.x *= 1-.10*flank
    # Fuller low belly and hips, fading gently toward the narrow neck.
    fullness=math.exp(-((v.co.z-.67)/.28)**2)
    v.co.x *= 1+.10*fullness
    v.co.y = .03+(v.co.y-.03)*(1+.06*fullness)


for side, s in [('L', 1), ('R', -1)]:
    thigh = ellipsoid('Thigh.'+side, (s*.235, .035, .37), (.21, .225, .31), fur, 'Leg.'+side, segments=18, rings=12)
    shin_group = thigh.vertex_groups.new(name='Shin.'+side)
    # A broad knee blend preserves the soft low-poly silhouette as it folds.
    for vertex in thigh.data.vertices:
        t = max(0, min(1, (vertex.co.z - .24) / .24))
        upper_weight = t*t*(3-2*t)
        thigh.vertex_groups['Leg.'+side].add([vertex.index], upper_weight, 'REPLACE')
        shin_group.add([vertex.index], 1-upper_weight, 'REPLACE')
    ellipsoid('Foot.'+side, (s*.25, -.125, .12), (.205, .29, .13), fur, 'Foot.'+side, segments=20, rings=10)
    # Small toe seams follow the top of the forefoot, without separated fingers.
    for offset in [-.056, .056]:
        x = s*.25+offset
        line('Toe seam', [(x,-.366,.139),(x,-.325,.19),(x,-.277,.222)], .005, peach, 'Foot.'+side)
    # One continuous short arm, with only two shallow fingertip creases.
    # No separate palm, wrist, thumb, finger bulbs or knuckle shaping.
    arm=ellipsoid('Continuous paw.'+side,(0,0,0),(1,1,1),fur,
                  'Arm.'+side,True,64,40)
    turn=Matrix.Rotation(s*-.22,3,'Y')
    for vertex in arm.data.vertices:
        nx,ny,nz=vertex.co
        ring=math.sqrt(max(0,1-nz*nz))
        # A slightly fuller rounded cap keeps the tip soft, not pointed.
        cap=ring**(-.20) if ring>1e-5 else 1
        x=nx*.110*cap;y=ny*.155*cap;z=nz*.405
        # Two oblique grooves wrap both faces and the underside of the tip.
        # Rotating the division plane exposes the creases in front and side views.
        u=(s*x+y)/math.sqrt(2)
        v=(s*x-y)/math.sqrt(2)
        grooves=sum(math.exp(-((u-seam)/.014)**2) for seam in [-.040,.040])
        tip=math.exp(-((z+.337)/.068)**2)
        v*=1-.50*grooves*tip
        z+=.027*grooves*math.exp(-((z+.385)/.044)**2)
        x=s*(u+v)/math.sqrt(2)
        y=(u-v)/math.sqrt(2)
        vertex.co=Vector((s*.440,-.015,.89))+turn@Vector((x,y,z))
        # Lower the upper-arm crown into the neck slope, avoiding a shoulder cap.
        upper=max(0,min(1,(vertex.co.z-1.08)/.21))
        vertex.co.z-=.035*upper*upper*(3-2*upper)
    arm.data.update()
    bpy.context.view_layer.objects.active=arm
    decimate=arm.modifiers.new('Continuous paw budget','DECIMATE');decimate.ratio=.36
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    arm.name='Arm.'+side

# Keep rounded closed arm surfaces tucked into the torso. Boolean splitting a
# fused body steals a flat slice of the flank and makes it flap during motion.
# The overlap is concealed inside the plush body, with a soft upper bone blend.
for arm in [obj for obj in parts if obj.name in ['Arm.L','Arm.R']]:
    sign=1 if arm.name=='Arm.L' else -1
    body_group=arm.vertex_groups.new(name='Body')
    for vertex in arm.data.vertices:
        vertex.co.x-=sign*.060
        t=max(0,min(1,(vertex.co.z-1.10)/.16))
        shoulder=t*t*(3-2*t)
        arm.vertex_groups[arm.name].add([vertex.index],1-shoulder,'REPLACE')
        body_group.add([vertex.index],shoulder,'REPLACE')
    arm.data.update()


ellipsoid('Cotton tail', (0, .365, .60), (.185,.18,.18), cream, 'Tail', segments=18, rings=12)

# A gentle pear-shaped head: narrower temples flowing into fuller lower cheeks.
# Broad falloffs keep the side contour rounded, without a separate cheek lobe.
head = ellipsoid('Head', (0, -.015, 1.73), (.575,.435,.475), fur, 'Head', segments=32, rings=20)
for v in head.data.vertices:
    x, y, z = v.co
    t = (z - 1.73) / .475
    cheek = math.exp(-((z - 1.55) / .30) ** 2)
    side = min(1, abs(x) / .575)
    # Narrow the all-around lower-head swell; fullness belongs to the front cheeks.
    front = max(0, min(1, -(y+.015)/.435))
    front = front*front*(3-2*front)
    front_cheek = math.exp(-((abs(x)-.30)/.20)**2 - ((z-1.565)/.19)**2)*front
    v.co.x = x*(.82-.13*t) + math.copysign(.040*cheek*side**.7 + .035*front_cheek, x)
    v.co.y = -.015 + (y+.015)*(.90-.05*t) - .050*front_cheek
head.data.update()

# Plush oval ears: a substantial root overlaps the head, with a rounded crown.
for side, s, lean, height in [('L',1,.15,.66),('R',-1,.21,.62)]:
    base = Vector((s*.265, .025, 2.025))
    verts, faces = [], []
    steps, around = 20, 32
    def ear_center(t):
        return base + Vector((s*lean*t, .02*math.sin(t*math.pi), (height + .055)*t))
    # Inner edge moves toward the face (-Y); outer edge toward the back (+Y).
    outward = Matrix.Rotation(s * .50, 3, 'Z')
    def ear_profile(t):
        # An ellipse cap stays round instead of narrowing into a leaf point.
        fullness = math.sqrt(max(0, 1 - (-.70 + 1.70*t)**2))
        root_taper = 1 - .20 * math.exp(-(t / .24)**2)
        return .20*fullness*root_taper + .002, .132*fullness + .002
    def front_depth(t, x):
        width, depth = ear_profile(t)
        cross = max(0, 1 - (x / width)**2)
        # Scoop the actual shell inward; the peach lining shares this cavity.
        # Keep the recess depth stable while adding substance to the outer shell.
        hollow = 1.15 * (.105 / .132) * depth * cross**2 * math.sin(math.pi*t)**.65
        return -depth * math.sqrt(cross) + hollow
    for i in range(steps+1):
        # Extra rings near the tip resolve the curved cap without a sharp apex.
        t=math.sin(math.pi*.5*i/steps)
        w, depth=ear_profile(t)
        for j in range(around):
            a=2*math.pi*j/around
            x = w*math.cos(a)
            y = front_depth(t, x) if math.sin(a) < 0 else depth*math.sin(a)
            p=ear_center(t)+outward @ Vector((x,y,0))
            verts.append(p)
    for i in range(steps):
        for j in range(around):
            a=i*around+j; b=i*around+(j+1)%around
            faces.append((a,b,b+around,a+around))
    faces += [tuple(reversed(range(around))), tuple(steps*around+j for j in range(around))]
    mesh('Ear.'+side, verts, faces, fur, 'Ear.'+side)
    # Recessed peach lining follows the concave shell inside the cream rim.
    verts, faces = [], []
    panel_steps = 20
    for i in range(panel_steps+1):
        # Sample the oval by angle: closely spaced crown rows make a rounded cap.
        angle = math.asin(-.70) + (math.pi/2-math.asin(-.70))*i/panel_steps
        q = math.sin(angle)
        t = .92*(q+.70)/1.70
        root_taper = 1 - .40 * math.exp(-(t / .32)**2)
        w = .113*math.cos(angle)*root_taper+.002
        for j in range(9):
            x=w*(j/4-1)
            p=ear_center(t)+outward @ Vector((x,front_depth(t,x)-.004,0))
            verts.append(p)
    for i in range(panel_steps):
        for j in range(8):
            k=i*9+j
            faces.append((k,k+1,k+10,k+9))
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

def stroke(points, radius, color, end_radius=None, taper_power=1, softness=.003, opacity=1):
    distance=np.full_like(xx,100)
    for index, ((ax,az),(bx,bz)) in enumerate(zip(points,points[1:])):
        dx=bx-ax;dz=bz-az
        t=np.clip(((xx-ax)*dx+(zz-az)*dz)/(dx*dx+dz*dz),0,1)
        progress = (index+t)/(len(points)-1)
        local_radius = radius if end_radius is None else radius + (end_radius-radius)*progress**taper_power
        distance=np.minimum(distance,np.sqrt((xx-ax-t*dx)**2+(zz-az-t*dz)**2)-local_radius)
    blend_face(color,np.clip((softness*.5-distance)/softness,0,1)*opacity)

def bezier(a,b,c,count=32):
    return [((1-t)**2*a[0]+2*(1-t)*t*b[0]+t*t*c[0],
             (1-t)**2*a[1]+2*(1-t)*t*b[1]+t*t*c[1])
            for t in np.linspace(0,1,count)]

muzzle_raise = .025
oval(0,1.56+muzzle_raise,.215,.13,cream.diffuse_color,soft=.65,opacity=.4)
for sign in [-1,1]:
    oval(sign*.35,1.63,.125,.078,(.84,.43,.26),soft=1,opacity=.35)
    # A slightly fuller warm sclera crescent, biased outward and below the iris.
    eye_x = sign*.2162
    eye_height = .90 / .88  # Restore eye height before V35 head compression.
    def eye_z(z): return 1.78 + (z-1.78)*eye_height
    oval(eye_x+sign*.001,eye_z(1.7785),.067,.097*eye_height,(.88,.81,.69),soft=.045)
    oval(eye_x-sign*.005,eye_z(1.781),.058,.089*eye_height,dark.diffuse_color,soft=.04)
    # Blend into the top of the dark oval with a fine inner start, no inner nub.
    lid_top = [(eye_x-sign*.005+sign*.057*math.cos(a), eye_z(1.781+.0875*math.sin(a)))
               for a in np.linspace(2.15,1.25,24)]
    stroke(lid_top,.0005,dark.diffuse_color,end_radius=.004)
    # Only the outer tail moves onto the sclera's outer boundary and drops briefly.
    lid_tail = []
    for t in np.linspace(0,1,24):
        a = 1.25-.91*t
        offset = .010*t*t*(3-2*t)
        lid_tail.append((eye_x-sign*.005+sign*(.057*math.cos(a)+offset),
                         eye_z(1.781+.0875*math.sin(a))))
    stroke(lid_tail,.004,dark.diffuse_color,end_radius=.0008)
    oval(eye_x-sign*.005+.019,eye_z(1.818),.010,.014*eye_height,
         (.70,.61,.48),soft=.38,opacity=.85)
    # Fuller inner brow, gently arched with a lower, tapered outer tail.
    stroke(bezier((sign*.177,1.987),(sign*.221,2.009),(sign*.277,1.958)),
           .015, nose.diffuse_color, end_radius=.0045, taper_power=1.6)
# A soft philtrum and tapered cocoa smile sit within a faint shaded crease.
# Keep this flush to the face, avoiding a raised cord around the muzzle.
smile_paths = [bezier((0,1.569+muzzle_raise),
                     (sign*.048,1.527+muzzle_raise),
                     (sign*.11,1.561+muzzle_raise)) for sign in [-1,1]]
for path in smile_paths:
    stroke(path,.009,(.43,.27,.16),end_radius=.0025,softness=.016,opacity=.16)
    stroke([(x,z-.006) for x,z in path],.004,cream.diffuse_color,
           end_radius=.001,softness=.010,opacity=.30)
stroke([(0,1.638+muzzle_raise),(0,1.569+muzzle_raise)],.0055,
       (.43,.265,.16),softness=.0035)
for path in smile_paths:
    stroke(path,.0055,(.25,.115,.060),end_radius=.005,taper_power=2,
           softness=.0035)

# Independent cylindrical fur UVs prevent the facial projection stretching on
# the sides/back. Leave painted facial features smooth using soft atlas masks.
def head_fur_uv(point):
    return (.5+math.atan2(point.x,-(point.y+.015))/(2*math.pi), (point.z-1.255)/.95)
fu,fv=np.meshgrid(np.linspace(0,1,SIZE),np.linspace(0,1,SIZE))
fur_mask=np.ones((SIZE,SIZE))
def smooth_feature(x,z,ru,rv):
    hit,p,_,_=head.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    if not hit: raise RuntimeError('Fur mask missed face')
    u,v=head_fur_uv(p)
    distance=np.sqrt(((fu-u)/ru)**2+((fv-v)/rv)**2)
    return np.clip((distance-.85)/.30,0,1)
for sign in [-1,1]:
    fur_mask*=smooth_feature(sign*.2162,1.78,.030,.118)
    fur_mask*=smooth_feature(sign*.225,1.985,.027,.039)
fur_mask*=smooth_feature(0,1.60,.052,.084)
face_fur=packed_image('Face fur normals',fiber_normal(SIZE,732,fur_mask),'rabbit-face-normal-v49.png')

# Store sRGB pixels; the glTF texture loader decodes them to linear for lighting.
linear=paint[:,:,:3]
paint[:,:,:3]=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
face_image=bpy.data.images.new('Rabbit painted face',width=SIZE,height=SIZE,alpha=True)
face_image.colorspace_settings.name='sRGB'
face_image.pixels.foreach_set(paint.ravel())
face_image.filepath_raw=str(SOURCE/'rabbit-face-v49.png')
face_image.file_format='PNG'
face_image.save();face_image.pack()
face_mat=bpy.data.materials.new('Painted face');face_mat.use_nodes=True
principled=face_mat.node_tree.nodes.get('Principled BSDF')
soft_fur_material(face_mat,face_fur,'FurUV',strength=.225)
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

fur_uv=head.data.uv_layers.new(name='FurUV')
for polygon in head.data.polygons:
    coords=[head_fur_uv(head.data.vertices[head.data.loops[i].vertex_index].co) for i in polygon.loop_indices]
    # Unwrap the rear seam locally; texture repeat keeps interpolation short.
    seam=max(u for u,v in coords)-min(u for u,v in coords)>.5
    for loop_index,(u,v) in zip(polygon.loop_indices,coords):
        fur_uv.data[loop_index].uv=(u+1 if seam and u<.5 else u,v)

# Only the tiny nose has relief, embedded against the actual faceted head.
def face_y(x,z):
    hit,point,normal,index=head.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    if not hit: raise RuntimeError('Face projection missed head')
    return point.y
# Rounded triangular pillow: curved corners, domed front and buried back.
nose_skin = material('Soft apricot nose', (.58,.29,.20))
corners = [Vector((-.051,1.675)), Vector((.051,1.675)), Vector((0,1.621))]
outline = []
for i, corner in enumerate(corners):
    entry = corner.lerp(corners[(i-1)%3], .24)
    leave = corner.lerp(corners[(i+1)%3], .24)
    outline.extend(Vector(p) for p in bezier(entry, corner, leave, count=9))
    next_entry = corners[(i+1)%3].lerp(corner, .24)
    outline.extend(leave.lerp(next_entry, t) for t in np.linspace(0,1,6)[1:-1])
center = Vector((0,1.650))
outline = [center + (point-center)*1.15 + Vector((0,muzzle_raise)) for point in outline]
center.y += muzzle_raise
verts, faces = [], []
ring_scales = [1, .94, .78, .54, .28]
count = len(outline)
for r in ring_scales:
    relief = .018*math.sqrt(1-r*r)-.001
    for point in outline:
        x,z = center.lerp(point,r)
        verts.append((x,face_y(x,z)-relief,z))
for ring in range(len(ring_scales)-1):
    for j in range(count):
        a=ring*count+j; b=ring*count+(j+1)%count
        faces.append((a,b,b+count,a+count))
front_center=len(verts)
verts.append((0,face_y(0,center.y)-.017,center.y))
for j in range(count):
    faces.append(((len(ring_scales)-1)*count+j,
                  (len(ring_scales)-1)*count+(j+1)%count,front_center))
# The rear cap lies within the head, avoiding a floating button silhouette.
back_center=len(verts)
verts.append((0,face_y(0,center.y)+.010,center.y))
for j in range(count):
    faces.append(((j+1)%count,j,back_center))
# Clockwise X/Z outline needs reversed winding for outward (-Y) front normals.
mesh('Rounded apricot nose',verts,[tuple(reversed(f)) for f in faces],nose_skin,'Head',True)

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

# Compress the finished face together with its painted UVs and projected nose.
# Translate complete ears to the new crown so their accepted proportions survive.
head_height_scale = .88
head_height_anchor = 1.30
ear_drop = (2.025-head_height_anchor)*(1-head_height_scale)
for obj in parts:
    if obj.vertex_groups.get('Head'):
        for vertex in obj.data.vertices:
            vertex.co.z = head_height_anchor + (vertex.co.z-head_height_anchor)*head_height_scale
        obj.data.update()
    elif obj.vertex_groups.get('Ear.L') or obj.vertex_groups.get('Ear.R'):
        ear_group = obj.vertex_groups.get('Ear.L') or obj.vertex_groups.get('Ear.R')
        sign = 1 if ear_group.name == 'Ear.L' else -1
        head_group = obj.vertex_groups.new(name='Head')
        for vertex in obj.data.vertices:
            # Extend only the lower root inside the crown; retain the visible tip.
            root_t = max(0, min(1, (vertex.co.z-2.025)/.24))
            vertex.co.x -= sign*.018
            vertex.co.z -= ear_drop + .015 + .10*(1-root_t)**2
            # The buried root follows the skull while the upper ear can sway.
            ear_weight = root_t*root_t*(3-2*root_t)
            ear_group.add([vertex.index],ear_weight,'REPLACE')
            head_group.add([vertex.index],1-ear_weight,'REPLACE')
        obj.data.update()

# Compact the torso and hanging arms together, translating the complete head
# and scarf down with the neck. Keep feet and the lower legs at floor height.
def compact_height(z):
    return z-.20*max(0,min(.70,z-.65))
for obj in parts:
    for vertex in obj.data.vertices:
        vertex.co.z=compact_height(vertex.co.z)
    obj.data.update()

# V15 blended knee weights and ankle roll remain unchanged.
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    if obj.name.startswith(('Satchel', 'Bag flap', 'Clasp tab', 'Brass clasp', 'Bag stitch')):
        obj.vertex_groups.clear()
        obj.vertex_groups.new(name='Bag').add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    # Only the actual fur gets fibers. Preserve smooth leather/cloth/nose surfaces.
    if obj != head:
        is_fur = obj.data.materials[0] == fur or obj.name == 'Cotton tail'
        obj.data.materials[0] = fur if is_fur else accessory
        if is_fur:
            uv = obj.data.uv_layers.new(name='FurUV')
            for poly in obj.data.polygons:
                axis=max(range(3),key=lambda i:abs(poly.normal[i]))
                for loop_index in poly.loop_indices:
                    co=obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                    u,v=(co.y,co.z) if axis==0 else (co.x,co.z) if axis==1 else (co.x,co.y)
                    uv.data[loop_index].uv=(u*3.5,v*3.5)
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
 'Ear.L':((.265,.025,2.08),(.415,.025,2.74),'Head'),
 'Ear.R':((-.265,.025,2.08),(-.475,.025,2.70),'Head'),
 'Arm.L':((.36,0,1.19),(.53,-.05,.62),'Body'),
 'Arm.R':((-.36,0,1.19),(-.53,-.05,.62),'Body'),
 'Leg.L':((.235,-.125,.86),(.25,-.39,.38),'Root'),
 'Shin.L':((.25,-.39,.38),(.25,-.125,.12),'Leg.L'),
 'Leg.R':((-.235,-.125,.86),(-.25,-.39,.38),'Root'),
 'Shin.R':((-.25,-.39,.38),(-.25,-.125,.12),'Leg.R'),
 'Foot.L':((.25,-.125,.12),(.25,-.35,.12),'Shin.L'),
 'Foot.R':((-.25,-.125,.12),(-.25,-.35,.12),'Shin.R'),
 'Bag':((-.285,-.307,.85),(-.285,-.307,.60),'Body'),
 'Tail':((0,.28,.60),(0,.47,.60),'Body'),
}
for name,(a,b,parent) in bones.items():
    bone=arm_data.edit_bones.new(name)
    a,b=Vector(a),Vector(b)
    if name == 'Head':
        a.z=head_height_anchor+(a.z-head_height_anchor)*head_height_scale
        b.z=head_height_anchor+(b.z-head_height_anchor)*head_height_scale
    elif name.startswith('Ear.'):
        shift = .018 if name == 'Ear.L' else -.018
        a.x-=shift;b.x-=shift
        a.z-=ear_drop+.015;b.z-=ear_drop+.015
    a.z=compact_height(a.z);b.z=compact_height(b.z)
    bone.head=a*SCALE;bone.tail=b*SCALE
    if parent: bone.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
character.parent=rig
mod=character.modifiers.new('Rabbit armature','ARMATURE');mod.object=rig
rig.show_in_front=True

# All clips key every bone channel, so returning to Idle restores the feet.
scene = bpy.context.scene
scene.render.fps = 30
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'

def reset_pose():
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)

def rotate_world(name, angles):
    from mathutils import Euler
    pb = rig.pose.bones[name]
    basis = pb.bone.matrix_local.to_quaternion()
    pb.rotation_quaternion = basis.inverted() @ Euler(angles).to_quaternion() @ basis

def translate_world(name, delta):
    pb = rig.pose.bones[name]
    pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector(delta)

# Cache each limb's bind lengths and foot vertices; the solver itself is generic.
leg_profiles = {}
for side in ['L', 'R']:
    upper, lower, foot = [rig.pose.bones[n+'.'+side] for n in ['Leg', 'Shin', 'Foot']]
    group_index = character.vertex_groups['Foot.'+side].index
    vertices = [v.co.copy()-foot.bone.head_local for v in character.data.vertices
                if any(g.group == group_index and g.weight > .99 for g in v.groups)]
    leg_profiles[side] = (upper, lower, foot, vertices)

def pose_leg(side, forward=0, lift=0, pitch=0):
    upper, lower, foot, vertices = leg_profiles[side]
    root = rig.pose.bones['Root']
    bpy.context.view_layer.update()
    root_transform = root.matrix @ root.bone.matrix_local.inverted()
    hip = upper.bone.head_local.copy()
    ankle = foot.bone.head_local.copy() + Vector((0, -forward, 0))
    rotation = Matrix.Rotation(pitch, 3, 'X')
    toe = Vector((0, -.24*SCALE, -.10*SCALE))
    ankle += toe - rotation @ toe
    # Roll onto heel/toe without letting the rounded sole pass through the floor.
    ankle.z = .0002 + lift - min((rotation @ v).z for v in vertices)
    pole = hip + Vector((0, -1, 0))
    knee, solved_ankle = solve_two_bone(hip, ankle, upper.bone.length, lower.bone.length, pole)
    if (solved_ankle-ankle).length > .002:
        raise ValueError('Gait exceeds fixed leg reach: '+side)
    for bone, start, end in [(upper, hip, knee), (lower, knee, solved_ankle)]:
        rest = bone.bone.tail_local - bone.bone.head_local
        rotation_delta = rest.rotation_difference(end-start)
        orientation = rotation_delta @ bone.bone.matrix_local.to_quaternion()
        bone.matrix = root_transform @ Matrix.Translation(start) @ orientation.to_matrix().to_4x4()
        bpy.context.view_layer.update()
    foot.matrix = root_transform @ Matrix.Translation(solved_ankle) @ rotation.to_4x4() @ foot.bone.matrix_local.to_quaternion().to_matrix().to_4x4()
    bpy.context.view_layer.update()

def key_pose(frame):
    for pb in rig.pose.bones:
        for channel in ('location', 'rotation_quaternion', 'scale'):
            pb.keyframe_insert(channel, frame=frame, group=pb.name)

for frame in [0,30,60,90,120]:
    reset_pose()
    t = frame / 120 * math.tau
    translate_world('Body', (0, 0, .005 * math.sin(t)))
    rotate_world('Head', (.015 * math.sin(t), 0, .025 * math.sin(t)))
    for side, sign in [('L',1),('R',-1)]:
        rotate_world('Ear.'+side, (.02 * math.sin(t), sign*.025 * math.sin(t), 0))
    for side in ['L', 'R']:
        pose_leg(side)
    key_pose(frame)
idle_action = rig.animation_data.action
idle_action.name = 'Idle'
idle_action.use_fake_user = True
rig.animation_data.action = None

# Brisk upright walk: 0.42 m stance travel / 0.4 s = 1.05 m/s.
# Stance travels linearly backward, swing returns forward with eased lift.
# Root translation stays zero for the later keyboard movement controller.
for frame in range(25):
    reset_pose()
    phase = frame / 24
    t = phase * math.tau
    bounce = .006 * (1 - math.cos(2*t))
    translate_world('Body', (.008 * math.sin(t), 0, bounce))
    rotate_world('Body', (.025, .015 * math.sin(t), .025 * math.sin(t)))
    rotate_world('Head', (-.015 + .012 * math.sin(2*t), -.010 * math.sin(t), -.018 * math.sin(t)))
    rotate_world('Bag', (.025 * math.sin(t-.4), .020 * math.sin(t), 0))
    rotate_world('Tail', (.04 * math.sin(2*t-.3), 0, .035 * math.sin(t)))
    for side, offset in [('L',0),('R',.5)]:
        p = (phase + offset) % 1
        if p < .5:
            forward = .20 - .42 * (p * 2)
            lift = 0
        else:
            u = (p-.5) * 2
            eased = u*u*(3-2*u)
            forward = -.22 + .42 * eased
            lift = .065 * math.sin(math.pi*u)**2
        # Heel contact, flat support, then a toe push before foot recovery.
        if p < .5:
            contact = p/.5
            pitch = -.10 * max(0, 1-contact/.18)**2 + .32 * max(0, (contact-.72)/.28)**2
        else:
            pitch = .32*(1-u) - .10*u
        pose_leg(side, forward, lift, pitch)
        rotate_world('Arm.'+side, (.32 * math.cos((phase+offset)*math.tau), 0, 0))
        rotate_world('Ear.'+side, (.035 * math.sin(2*t-.5), .018 * math.sin(t+offset*math.tau), 0))
    key_pose(frame)
walk_action = rig.animation_data.action
walk_action.name = 'Walk'
walk_action.use_fake_user = True
# Upright game-style run: broad opposing arm/leg swings and two flight phases.
# 0.575 m stance travel / 0.28 s contact at normal playback at normal playback.
rig.animation_data.action = None
for frame in range(25):
    reset_pose()
    phase = frame / 24
    t = phase * math.tau
    # Flight moves the whole skeleton, including feet, instead of hunching the torso.
    half_phase = phase % .5
    flight = .035 * math.sin(math.pi * (half_phase-.35)/.15)**2 if half_phase > .35 else 0
    translate_world('Root', (0, 0, flight))
    # Two soft torso rebounds per stride, with shoulder twist opposing each leg.
    # Blender Z is vertical: twist is yaw, Y is the small lateral bank.
    bounce = .018 * (1 - math.cos(2*t))
    twist = .10 * math.cos(t)
    bank = .035 * math.sin(t)
    pitch = .035 + .022 * math.sin(2*t)
    translate_world('Body', (.012 * math.sin(t), 0, bounce))
    rotate_world('Body', (pitch, bank, twist))
    # Counter-rotation keeps the face looking ahead while the shoulders move.
    rotate_world('Head', (-.02 - .014 * math.sin(2*t), -.022 * math.sin(t), -.065 * math.cos(t)))
    rotate_world('Bag', (.075 * math.sin(t-.4), .035 * math.sin(t), 0))
    rotate_world('Tail', (.09 * math.sin(2*t-.3), 0, .05 * math.sin(t)))
    for side, offset in [('L',0),('R',.5)]:
        p = (phase + offset) % 1
        if p < .35:
            forward = .275 - .575 * (p / .35)
            lift = 0
        else:
            u = (p-.35) / .65
            forward = -.30 + .575 * u*u*(3-2*u)
            lift = .14 * math.sin(math.pi*u)**2
        if p < .35:
            contact = p/.35
            pitch = -.08 * max(0, 1-contact/.15)**2 + .42 * max(0, (contact-.60)/.40)**2
        else:
            pitch = .42*(1-u) - .08*u
        pose_leg(side, forward, lift, pitch)
        rotate_world('Arm.'+side, (.65 * math.cos((phase+offset)*math.tau), 0, .06 if side == 'L' else -.06))
        rotate_world('Ear.'+side, (-.025 + .085 * math.sin(2*t-.6), .03 * math.sin(t+offset*math.tau), 0))
    key_pose(frame)
run_action = rig.animation_data.action
run_action.name = 'Run'
run_action.use_fake_user = True

# Per-frame samples use linear interpolation to avoid overshoot below the floor.
for action in (idle_action, walk_action, run_action):
    for curve in action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'BEZIER' if action == idle_action else 'LINEAR'
rig.animation_data.action = idle_action
scene.frame_start = 0
scene.frame_end = 120
scene.frame_set(0)

OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
character.select_set(True);rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'sheem-rabbit-v49.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_yup=True,export_skins=True)

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
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'sheem-rabbit-v49.blend'))
scene.render.filepath=str(SOURCE/'rabbit-preview-v49.png')
bpy.ops.render.render(write_still=True)
character.data.calc_loop_triangles()
print('RABBIT_TRIANGLES',len(character.data.loop_triangles))
print('RABBIT_HEIGHT_METERS',round(character.dimensions.z,3))

cam.location=(0,5,1.75);aim(cam,(0,0,.87))
scene.render.filepath=str(SOURCE/'rabbit-back-v49.png')
bpy.ops.render.render(write_still=True)
