"""Combines the Mixamo-rigged hoodie character with its clips into one web GLB.
Run: Blender -b --python art/characters/jongwoo-hoodie/build_web_glb.py
Inputs (mixamo/downloads/): character-tpose.fbx (with skin) and one FBX per clip
(without skin), named <ClipName>.fbx. Original PBR textures come from
source/meshy-lite.glb with the cleaned base colour (feet painted as socks).
House slippers are modelled here around each foot and skinned to the rig.
hands.py can replace the mitten hands (REAL_HANDS, off for now).
Output: public/models/jongwoo/jongwoo-hoodie.glb
"""
import bpy
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DL = HERE / 'mixamo/downloads'
import os
OUT = Path(os.environ.get('JONGWOO_OUT', ROOT / 'public/models/jongwoo/jongwoo-hoodie.glb'))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30


def imported(fn):
    before = set(bpy.data.objects)
    fn()
    return [o for o in bpy.data.objects if o not in before]


new = imported(lambda: bpy.ops.import_scene.fbx(filepath=str(DL / 'character-tpose.fbx')))
rig = next(o for o in new if o.type == 'ARMATURE')
body = next(o for o in new if o.type == 'MESH')
rig.name, body.name = 'JongwooRig', 'Jongwoo'

# Mixamo's "T-pose" character keeps the uploaded A-pose as its bind/rest pose and
# only poses the T in a one-frame action, while every clip is keyed against a
# T-pose rest. Bake the T into the mesh and make it the rest pose so clip
# rotations land on the same reference; otherwise arms drop 45° into the body.
scene.frame_set(1)
bpy.context.view_layer.objects.active = body
for m in body.modifiers:
    if m.type == 'ARMATURE':
        bpy.ops.object.modifier_apply(modifier=m.name)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
skin = body.modifiers.new('Armature', 'ARMATURE')
skin.object = rig
arm_dir = (rig.data.bones['mixamorig:LeftArm'].tail_local
           - rig.data.bones['mixamorig:LeftArm'].head_local).normalized()
print('REST_LEFT_ARM', tuple(round(v, 2) for v in arm_dir))

rig.animation_data_clear()
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# Clips: every other FBX in downloads, action renamed after its file.
rig.animation_data_create()
clips = []
for fbx in sorted(DL.glob('*.fbx')):
    if fbx.stem == 'character-tpose':
        continue
    before = set(bpy.data.actions)
    objs = imported(lambda: bpy.ops.import_scene.fbx(filepath=str(fbx)))
    action = next(a for a in bpy.data.actions if a not in before)
    action.name = fbx.stem
    action.use_fake_user = True
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    track = rig.animation_data.nla_tracks.new()
    track.name = fbx.stem
    track.strips.new(fbx.stem, int(action.frame_range[0]), action)
    track.mute = True
    clips.append((fbx.stem, tuple(round(f) for f in action.frame_range)))
rig.animation_data.action = None
print('CLIPS', clips)

# Material: Meshy PBR textures, cleaned base colour.
src = imported(lambda: bpy.ops.import_scene.gltf(filepath=str(HERE / 'source/meshy-lite.glb')))
mat = next(o for o in src if o.type == 'MESH').data.materials[0]
base = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'
            and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links))
base.image = bpy.data.images.load(str(HERE / 'source/basecolor-fixed.png'))
mat.name = 'JongwooHoodie'
# Meshy guessed metallic/glossy values for areas hidden from the front image
# (under the chin), which mirror the lights as a white band. The style is matte,
# so drop those maps and use constant values.
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
for name, value in (('Metallic', 0.0), ('Roughness', 0.8)):
    for link in list(bsdf.inputs[name].links):
        mat.node_tree.links.remove(link)
    bsdf.inputs[name].default_value = value
body.data.materials.clear()
body.data.materials.append(mat)
for o in src:
    bpy.data.objects.remove(o, do_unlink=True)

# Meshy splits vertices along every UV seam, so each side shades with its own
# normal and seams show as thin creases (temples, jaw). Weld co-located vertices;
# UVs live on loops and are kept, skin weights of welded twins are identical.
import bmesh
bm = bmesh.new()
bm.from_mesh(body.data)
before = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
after = len(bm.verts)
bm.to_mesh(body.data)
bm.free()
for poly in body.data.polygons:
    poly.use_smooth = True
print('WELD verts', before, '->', after)

# Meshy's cartoon sneakers made the feet oversized (about 18 % of height); in
# slippers that reads as clown feet. Shrink each foot horizontally toward its
# ankle (the leg axis), fading out up the ankle so the trousers stay put.
FOOT_SCALE = 0.84
mw_b = body.matrix_world
inv_b = mw_b.inverted()
for v in body.data.vertices:
    p = mw_b @ v.co
    if p.z > 0.2:
        continue
    side = 'Left' if p.x > 0 else 'Right'
    ank = rig.matrix_world @ rig.data.bones[f'mixamorig:{side}Foot'].head_local
    t = min(1.0, max(0.0, (p.z - 0.09) / 0.11))
    k = FOOT_SCALE + (1 - FOOT_SCALE) * t * t * (3 - 2 * t)
    p.x = ank.x + (p.x - ank.x) * k
    p.y = ank.y + (p.y - ank.y) * k
    v.co = inv_b @ p

# House slippers: a separate smooth mesh around each (sock-painted) foot. Each
# slipper is lofted from the foot's own cross-sections plus a margin, cut by a
# plane that rises from a low back toward the instep (a clean oval opening),
# given a padded collar roll and some thickness, smoothed, then skinned with
# the foot's own weights so it follows every clip.
import math
import numpy as np
from mathutils import Vector
SLIP_MARGIN, SLIP_BACK = 0.0065, 0.045  # metres: gap around the foot, back height
slip_mat = bpy.data.materials.new('Slipper')
slip_mat.use_nodes = True
sbsdf = next(n for n in slip_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
sbsdf.inputs['Base Color'].default_value = (0.2, 0.2, 0.235, 1)  # soft charcoal felt
sole_mat = bpy.data.materials.new('Slipper sole')
sole_mat.use_nodes = True
sole_b = next(n for n in sole_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
sole_b.inputs['Base Color'].default_value = (0.72, 0.66, 0.56, 1)  # cream sole
sole_b.inputs['Roughness'].default_value = 0.9
sbsdf.inputs['Roughness'].default_value = 0.95
tex = np.array(base.image.pixels[:], dtype=np.float32).reshape(base.image.size[1], base.image.size[0], 4)
TH, TW = tex.shape[:2]
mw = body.matrix_world
uvd = body.data.uv_layers.active.data


def sock_verts(side):
    """World positions of the foot's sock-painted (light) vertices on one side."""
    light = set()
    for poly in body.data.polygons:
        for li in poly.loop_indices:
            u, v = uvd[li].uv
            if tex[min(int(v * TH), TH - 1), min(int(u * TW), TW - 1), :3].min() > 0.5:
                light.add(body.data.loops[li].vertex_index)
    out = []
    for i in light:
        p = mw @ body.data.vertices[i].co
        if p.z < 0.2 and p.x * side > 0:
            out.append(p)
    return out


def ring_pts(tc, a, b, z0, n=24, e=2.5):
    """A cross-section: superellipse over the top, flat across the bottom."""
    pts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        c, s_ = math.cos(th), math.sin(th)
        x = tc + a * math.copysign(abs(c) ** (2 / e), c)
        z = z0 + (b * abs(s_) ** (2 / e) if s_ > 0 else 0.004 * s_)
        pts.append((x, z))
    return pts


def slipper(side, name):
    bone = 'Left' if side > 0 else 'Right'
    head = rig.matrix_world @ rig.data.bones[f'mixamorig:{bone}Foot'].head_local
    toe = rig.matrix_world @ rig.data.bones[f'mixamorig:{bone}Toe_End'].tail_local
    fwd = Vector((toe.x - head.x, toe.y - head.y, 0)).normalized()
    lat = Vector((-fwd.y, fwd.x, 0))
    P = sock_verts(side)
    z0 = min(p.z for p in P)
    S = np.array([[(p - head).dot(fwd), (p - head).dot(lat), p.z] for p in P])
    s0, s1 = S[:, 0].min(), S[:, 0].max()
    N = 22
    st = np.linspace(s0, s1, N)
    win = (s1 - s0) / (N - 1) * 1.2
    prof = []
    for x in st:
        m = np.abs(S[:, 0] - x) < win
        if m.sum() < 3:
            prof.append(None)
            continue
        prof.append((S[m, 1].min(), S[m, 1].max(), S[m, 2].max()))
    # Fill gaps and smooth the profiles along the foot.
    for i in range(N):
        if prof[i] is None:
            j = min((k for k in range(N) if prof[k] is not None), key=lambda k: abs(k - i))
            prof[i] = prof[j]
    pr = np.array(prof)
    # A puffy, rounded toe box: keep some height all the way to the tip.
    pr[:, 2] = np.maximum(pr[:, 2], z0 + 0.062)
    for _ in range(3):
        pr[1:-1] = 0.25 * pr[:-2] + 0.5 * pr[1:-1] + 0.25 * pr[2:]
    bm2 = bmesh.new()
    rings = []
    for i, x in enumerate(st):
        lo, hi, top = pr[i]
        a, b = (hi - lo) / 2 + SLIP_MARGIN, top - z0 + SLIP_MARGIN
        rings.append([bm2.verts.new(head + fwd * x + lat * t + Vector((0, 0, z - head.z)))
                      for t, z in ring_pts((lo + hi) / 2, a, b, z0)])
    n = len(rings[0])
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(n):
            bm2.faces.new((r0[i], r0[(i + 1) % n], r1[(i + 1) % n], r1[i]))
    # Rounded heel and toe: a few shrinking rings past each end, then a point.
    for end, sgn in ((0, -1), (N - 1, 1)):
        lo, hi, top = pr[end]
        a, b = (hi - lo) / 2 + SLIP_MARGIN, top - z0 + SLIP_MARGIN
        last = rings[end]
        for ph in (0.45, 0.8, 1.15):
            ring = [bm2.verts.new(head + fwd * (st[end] + sgn * 0.02 * math.sin(ph)) + lat * t + Vector((0, 0, z - head.z)))
                    for t, z in ring_pts((lo + hi) / 2, a * math.cos(ph) ** 0.6, b * math.cos(ph) ** 0.5, z0)]
            pair = (last, ring) if sgn > 0 else (ring, last)
            for i in range(n):
                bm2.faces.new((pair[0][i], pair[0][(i + 1) % n], pair[1][(i + 1) % n], pair[1][i]))
            last = ring
        c = sum((v.co for v in last), Vector()) / n
        tip = bm2.verts.new(head + fwd * (st[end] + sgn * 0.022) + Vector((0, 0, c.z - head.z)) + lat * (c - head).dot(lat))
        for i in range(n):
            bm2.faces.new((last[i], last[(i + 1) % n], tip))
    bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
    # The opening: a plane from the low back, leaving the top of the foot at
    # about two thirds of its length (the vamp covers the toes).
    k_front = int(N * 0.62)
    zb = z0 + SLIP_BACK
    slope = (pr[k_front][2] - 0.004 - zb) / (st[k_front] - s0)
    print('SLIP profile tops', [round(float(t) - z0, 3) for t in pr[:, 2]], 'front', k_front)
    nrm = Vector((-slope * fwd.x, -slope * fwd.y, 1)).normalized()
    co = head + fwd * s0 + Vector((0, 0, zb - head.z))
    bmesh.ops.bisect_plane(bm2, geom=bm2.verts[:] + bm2.edges[:] + bm2.faces[:], dist=1e-6,
                           plane_co=co, plane_no=nrm, clear_outer=True)
    rim = [e for e in bm2.edges if e.is_boundary]
    adj = {}
    for e in rim:
        u, v = e.verts
        adj.setdefault(u, []).append(v)
        adj.setdefault(v, []).append(u)
    loop, prev, cur = [rim[0].verts[0]], None, rim[0].verts[0]
    while True:
        nxt = [v for v in adj[cur] if v is not prev]
        if not nxt or nxt[0] is loop[0]:
            break
        prev, cur = cur, nxt[0]
        loop.append(cur)
    # The collar sits just outside the rim (pushed out from the slipper's axis).
    rim_pts = []
    for v in loop:
        d = v.co - head
        out = lat * (d.dot(lat) - float(np.interp(d.dot(fwd), st, (pr[:, 0] + pr[:, 1]) / 2)))
        rim_pts.append(v.co + (out.normalized() * 0.0035 if out.length > 1e-6 else Vector()))
    # A clean sole line: cut an edge loop and give the band below the sole colour.
    sole_top = z0 + 0.012
    bmesh.ops.bisect_plane(bm2, geom=bm2.verts[:] + bm2.edges[:] + bm2.faces[:], dist=1e-6,
                           plane_co=(0, 0, sole_top), plane_no=(0, 0, 1))
    for f in bm2.faces:
        if f.calc_center_median().z < sole_top:
            f.material_index = 1
    me2 = bpy.data.meshes.new(name)
    bm2.to_mesh(me2)
    bm2.free()
    ob = bpy.data.objects.new(name, me2)
    scene.collection.objects.link(ob)
    me2.materials.append(slip_mat)
    me2.materials.append(sole_mat)
    sol = ob.modifiers.new('Thickness', 'SOLIDIFY')
    sol.thickness, sol.offset = 0.004, 0.0
    ob.modifiers.new('Smooth', 'SUBSURF').levels = 1
    # Padded collar roll along the rim.
    cu = bpy.data.curves.new(name + ' collar', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth, cu.bevel_resolution = 0.0055, 3
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(rim_pts) - 1)
    for bp, p in zip(sp.bezier_points, rim_pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    sp.use_cyclic_u = True
    cu.resolution_u = 3
    col = bpy.data.objects.new(name + ' collar', cu)
    scene.collection.objects.link(col)
    cu.materials.append(slip_mat)
    for o in (ob, col):
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target='MESH')
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    col.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    for poly in ob.data.polygons:
        poly.use_smooth = True
    print('SLIPPER', name, len(ob.data.vertices), 'verts, rim', len(rim_pts), 'length', round(s1 - s0, 3))
    return ob


slippers = [slipper(1, 'Slipper L'), slipper(-1, 'Slipper R')]
bpy.ops.object.select_all(action='DESELECT')
for o in slippers:
    o.select_set(True)
bpy.context.view_layer.objects.active = slippers[0]
bpy.ops.object.join()
slip = slippers[0]
slip.name = 'Slippers'
# Skin: copy the body's weights from the nearest foot surface, then bind.
dt = slip.modifiers.new('Weights', 'DATA_TRANSFER')
dt.object = body
dt.use_vert_data = True
dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'
bpy.ops.object.datalayout_transfer(modifier=dt.name)
bpy.ops.object.modifier_apply(modifier=dt.name)
slip.parent = rig
slip.matrix_parent_inverse = rig.matrix_world.inverted()
slip.modifiers.new('Armature', 'ARMATURE').object = rig

# Real hands in place of Meshy's mittens: five jointed fingers, their bones
# and weights, the clips extended to them (hands.py).
# Fingers carved into the mittens: grooves between them, notches between the
# tips, creases at the joints, the grooves shaded (mitten_fingers.py).
CARVE_FINGERS = os.environ.get('CARVE_FINGERS') == '1'  # off: it crumpled the curled mitten
import sys
sys.path.insert(0, str(HERE))
if CARVE_FINGERS:
    from mitten_fingers import carve
    carve(body, rig)

# Off: the first try (separate thin fingers) read as skeletal; the mittens
# stay until a better hand is approved. Set REAL_HANDS = True to build them.
REAL_HANDS = os.environ.get('REAL_HANDS') == '1'
hands = None
if REAL_HANDS:
    import sys
    sys.path.insert(0, str(HERE))
    from hands import rebuild as rebuild_hands
    hands = rebuild_hands(body, rig, base.image)

OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
body.select_set(True)
slip.select_set(True)
if hands:
    hands.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=str(OUT), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_skins=True, export_yup=True, export_image_format='WEBP',
    export_vertex_color='ACTIVE',
    export_image_quality=88,
)
print('WEB_GLB', OUT, OUT.stat().st_size)
