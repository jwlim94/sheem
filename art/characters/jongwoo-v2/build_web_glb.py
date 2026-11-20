"""Builds the web GLB of the Flagship hoodie character (v2) with its clips.
Run: Blender -b --python art/characters/jongwoo-v2/build_web_glb.py

Inputs (mixamo/downloads/): character-tpose.fbx (with skin) and the clips
(HappyIdle, SitToStand, Typing, Waving without skin; Idle, Mixamo's
"Breathing Idle", with skin: retargeted below), downloaded from Mixamo for
mixamo/jongwoo-v2-upload.fbx (prepare_for_mixamo.py). Textures come from
source/meshy-flagship.glb (colour and normal maps; matte constant roughness).
Output: public/models/jongwoo/jongwoo-v2.glb (or $JONGWOO_OUT): the body
(Jongwoo), Sneakers, Socks and Slippers (feet.py), and the blinking lids
LidsHalf and LidsShut (face_parts.py), all skinned to one rig.
After a rebuild, run `node scripts/build-hero-lod.mjs`: /portfolio/7 draws
his body, sneakers and socks from the simplified index buffers it writes
(public/models/jongwoo/jongwoo-v2-lod.bin), and ignores a stale file (he is
then drawn at full resolution).

Mixamo rigged its hands with thumb and index chains only (its fingers curl
together, so it found no others): every finger is sculpted, and the four
follow the index chain's weights as Mixamo painted them.

Full resolution: Mixamo rigged a 60k-triangle copy (prepare_for_mixamo.py),
but the face's detail (the eyes' outlines, the hairline) crumpled at that
count, so the source mesh (547k) is skinned instead, its weights carried
over from the rigged copy (nearest face, interpolated), and the GLB is Draco
compressed (the decoder is served from public/draco/).
"""
import os
from pathlib import Path

import bmesh
import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DL = HERE / 'mixamo/downloads'
OUT = Path(os.environ.get('JONGWOO_OUT', ROOT / 'public/models/jongwoo/jongwoo-v2.glb'))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30


def imported(fn):
    before = set(bpy.data.objects)
    fn()
    return [o for o in bpy.data.objects if o not in before]


new = imported(lambda: bpy.ops.import_scene.fbx(filepath=str(DL / 'character-tpose.fbx')))
rig = next(o for o in new if o.type == 'ARMATURE')
low = next(o for o in new if o.type == 'MESH')
rig.name = 'JongwooRig'

# The full-resolution mesh, placed as the upload was (welded, centred, feet on
# the ground), takes the rigged copy's weights in the bind (A) pose.
hi_objs = imported(lambda: bpy.ops.import_scene.gltf(filepath=str(HERE / 'source/meshy-flagship.glb')))
body = next(o for o in hi_objs if o.type == 'MESH')
for o in hi_objs:
    if o is not body:
        bpy.data.objects.remove(o, do_unlink=True)
body.parent = None
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bm = bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
xs = [v.co.x for v in bm.verts]
ys = [v.co.y for v in bm.verts]
zs = [v.co.z for v in bm.verts]
cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
for v in bm.verts:
    v.co.x -= cx
    v.co.y -= cy
    v.co.z -= z0
bm.to_mesh(body.data)
bm.free()
arm_low = next(m for m in low.modifiers if m.type == 'ARMATURE')
arm_low.show_viewport = False  # the bind pose, not the T the action poses
bpy.context.view_layer.update()
lw = [low.matrix_world @ v.co for v in low.data.vertices]
print('ALIGN low z', round(min(p.z for p in lw), 4), round(max(p.z for p in lw), 4),
      'hi z', 0.0, round(max(v.co.z for v in body.data.vertices), 4))
for vg in low.vertex_groups:
    body.vertex_groups.new(name=vg.name)
dt = body.modifiers.new('Weights', 'DATA_TRANSFER')
dt.object = low
dt.use_vert_data = True
dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'
dt.layers_vgroup_select_src = 'ALL'
dt.layers_vgroup_select_dst = 'NAME'
bpy.context.view_layer.objects.active = body
bpy.ops.object.modifier_apply(modifier=dt.name)
bpy.data.objects.remove(low, do_unlink=True)
body.parent = rig
body.matrix_parent_inverse = rig.matrix_world.inverted()
body.modifiers.new('Armature', 'ARMATURE').object = rig
body.name = 'Jongwoo'
print('HI-RES', len(body.data.vertices), 'verts', len(body.data.polygons), 'faces')

# His white backpack as he wears it (worn_backpack.py: the bag and straps off
# Meshy's model of him wearing it, fitted to him), skinned from his weights.
import sys
sys.path.insert(0, str(HERE))
import worn_backpack
worn_bag = worn_backpack.build(ROOT / 'art/portfolio-room/backpack-v2/worn-reference.glb', body, rig, (cx, cy, z0))

# Meshy sculpted a narrow, deep crease into the back of each hand where the
# thumb parts from the index; folded in the clips it opened into a dark gash.
# Narrow concave slits on the hands (a vertex sunk well below its ring of
# neighbours, along its normal) and two rings around them are relaxed.
gi = {vg.index: vg.name for vg in body.vertex_groups}
bm = bmesh.new()
bm.from_mesh(body.data)
bm.verts.ensure_lookup_table()
bm.normal_update()
dv = bm.verts.layers.deform.active


def on_hand(v):
    d = v[dv]
    return bool(d) and 'Hand' in gi[max(d.items(), key=lambda kv: kv[1])[0]]


hand = [v for v in bm.verts if on_hand(v)]
crease = set()
for v in hand:
    nb = [e.other_vert(v) for e in v.link_edges]
    if len(nb) < 3:
        continue
    avg = sum((n.co for n in nb), v.co * 0) / len(nb)
    span = sum((n.co - v.co).length for n in nb) / len(nb)
    if span > 0 and (avg - v.co).dot(v.normal) / span > 0.45:
        crease.add(v)
region = set(crease)
for _ in range(2):
    region |= {e.other_vert(v) for v in list(region) for e in v.link_edges}
# (Relaxing everything within 3 cm of the thumb's root as well left the back
# of the hand lumpy, glinting in the lamp's light: dropped. The crease there
# is the normal map's, flattened below.)
region = [v for v in region if on_hand(v)]
for _ in range(10):
    bmesh.ops.smooth_vert(bm, verts=region, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(body.data)
bm.free()
print('HAND CREASES', len(crease), 'slit verts,', len(region), 'relaxed')

# Where the thumb's and the index's weights meet on the back of the hand,
# Mixamo's weights change abruptly, and the skin kinked into a small fold
# there whenever the thumb moved. The hands' weights are smoothed (selected
# hand vertices, all groups), so the bend spreads over the web.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
for v in body.data.vertices:
    v.select = bool(v.groups) and 'Hand' in gi[max(v.groups, key=lambda g: g.weight).group]
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
body.data.use_paint_mask_vertex = True
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=12, expand=0.0)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
body.data.use_paint_mask_vertex = False
bpy.ops.object.mode_set(mode='OBJECT')
print('HAND WEIGHTS smoothed on', sum(1 for v in body.data.vertices if v.select), 'verts')

# Mixamo's T-pose download keeps the uploaded A-pose as the bind pose and poses
# the T in a one-frame action, while every clip is keyed against a T rest: bake
# the T into the mesh and make it the rest pose (as for the hoodie character).
scene.frame_set(1)
for ob in (body, worn_bag):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        if m.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=m.name)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
body.modifiers.new('Armature', 'ARMATURE').object = rig
worn_bag.modifiers.new('Armature', 'ARMATURE').object = rig
rig.animation_data_clear()
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

rig.animation_data_create()
clips = []
for fbx in sorted(DL.glob('*.fbx')):
    if fbx.stem == 'character-tpose':
        continue
    before = set(bpy.data.actions)
    objs = imported(lambda: bpy.ops.import_scene.fbx(filepath=str(fbx)))
    action = next(a for a in bpy.data.actions if a not in before)
    if any(o.type == 'MESH' for o in objs):
        # Downloaded with skin: Mixamo keys it against the uploaded A-pose
        # rest, not the T rest the others (and our rig) use. Retarget: our rig
        # copies the imported rig's bones in world space, frame by frame, and
        # the result is baked (visual keying) into a new action.
        src = next(o for o in objs if o.type == 'ARMATURE')
        src.animation_data.action = action
        rig.animation_data.action = None
        for pb in rig.pose.bones:
            if pb.name in src.pose.bones:
                c = pb.constraints.new('COPY_TRANSFORMS')
                c.target, c.subtarget = src, pb.name
        mods = [m for m in body.modifiers if m.type == 'ARMATURE']
        for m in mods:
            m.show_viewport = False  # the heavy mesh needn't follow the bake
        bpy.ops.object.select_all(action='DESELECT')
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode='POSE')
        bpy.ops.pose.select_all(action='SELECT')
        f0, f1 = (int(round(f)) for f in action.frame_range)
        bpy.ops.nla.bake(frame_start=f0, frame_end=f1, only_selected=False, visual_keying=True,
                         clear_constraints=True, use_current_action=False, bake_types={'POSE'})
        bpy.ops.object.mode_set(mode='OBJECT')
        for m in mods:
            m.show_viewport = True
        baked = rig.animation_data.action
        rig.animation_data.action = None
        bpy.data.actions.remove(action)
        action = baked
        print('RETARGETED', fbx.stem, 'from its A-pose rest,', f0, '-', f1)
    action.name = fbx.stem
    action.use_fake_user = True
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    track = rig.animation_data.nla_tracks.new()
    track.name = fbx.stem
    track.strips.new(fbx.stem, int(action.frame_range[0]), action)
    track.mute = True
    clips.append((fbx.stem, tuple(round(f) for f in action.frame_range)))
# Video mocap (mocap_retarget.py): his own picking up of his backpack and
# slinging it on, filmed by the user and run through DeepMotion Animate 3D
# (2026-10-15: assembled from Mixamo clips and IK, it looked staged).
import sys as _sys
_sys.path.insert(0, str(HERE))
from mocap_retarget import retarget  # noqa: E402
for fbx, name in ((HERE / 'mocap/backpack-tpose.fbx', 'Backpack'),):
    if not fbx.exists():
        continue
    action = retarget(rig, fbx, name)
    action.use_fake_user = True
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(action.frame_range[0]), action)
    track.mute = True
    clips.append((name, tuple(round(f) for f in action.frame_range)))
rig.animation_data.action = None
print('CLIPS', clips)

# The thumbs rest tucked a little closer to the index (12°, about each
# Thumb1's local X, mirrored left to right): left as Mixamo posed them, the
# narrow gap between thumb and index read as a dark gash on the relaxed hands.
import math
from mathutils import Quaternion, Vector


def _fcurves(action):
    if len(getattr(action, 'fcurves', [])):
        return action.fcurves
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                return bag.fcurves
    return action.fcurves


for action in bpy.data.actions:
    fcs = _fcurves(action)
    for side, sgn in (('Left', -1), ('Right', 1)):
        path = f'pose.bones["mixamorig:{side}HandThumb1"].rotation_quaternion'
        ch = [fcs.find(path, index=i) for i in range(4)]
        if not all(ch) or len({len(c.keyframe_points) for c in ch}) != 1:
            continue
        off = Quaternion(Vector((sgn, 0, 0)), math.radians(12))
        for k in range(len(ch[0].keyframe_points)):
            q = Quaternion([c.keyframe_points[k].co[1] for c in ch]) @ off
            for i, c in enumerate(ch):
                c.keyframe_points[k].co[1] = q[i]
                c.keyframe_points[k].handle_left[1] = q[i]
                c.keyframe_points[k].handle_right[1] = q[i]
        for c in ch:
            c.update()
print('THUMBS tucked in', len(bpy.data.actions), 'clips')

# Walking (chapter 3, across the stage) was downloaded with its root motion
# (about 1.55 m forward a cycle, 1-32): its hips' drift is taken out (each
# location channel less the straight line from its first key to its last),
# leaving the bob and sway, so it walks in place; the page moves him along
# and scrubs the clip by the distance (RoomScene WALK_CYCLE).
for clip in ('Walking',):
    action = bpy.data.actions.get(clip)
    if not action:
        continue
    fcs = _fcurves(action)
    for i in range(3):
        c = fcs.find('pose.bones["mixamorig:Hips"].location', index=i)
        if not c or len(c.keyframe_points) < 2:
            continue
        k0, k1 = c.keyframe_points[0].co, c.keyframe_points[-1].co
        f0, v0, f1, v1 = k0[0], k0[1], k1[0], k1[1]
        for k in c.keyframe_points:
            drift = v0 + (v1 - v0) * (k.co[0] - f0) / max(1e-6, f1 - f0) - v0
            k.co[1] -= drift
            k.handle_left[1] -= drift
            k.handle_right[1] -= drift
        c.update()
    print('IN PLACE', clip)

# Talking (chapter 2, explaining his approach to the engineers) tosses its
# head about as it talks, and holds it tilted to one side; it read as
# arguing. Its neck and head are held upright (the rig's rest) and its upper
# spine keeps half its sway, so he talks it over steadily, the gestures in
# his arms (2026-10-13, the user's request; first damped about the clip's
# average pose, the tilt stayed; then to 30%, the head still swung).
# (Since replaced by "Head Nod Yes", which keeps its head: the nod is the
# point. Kept for clips that need steadying.)
KEEP = {'Talking': {'Neck': 0.0, 'Head': 0.0, 'Spine1': 0.5, 'Spine2': 0.5}}
for clip, bones in KEEP.items():
    action = bpy.data.actions.get(clip)
    if not action:
        continue
    fcs = _fcurves(action)
    for bone, keep in bones.items():
        path = f'pose.bones["mixamorig:{bone}"].rotation_quaternion'
        ch = [fcs.find(path, index=i) for i in range(4)]
        if not all(ch) or len({len(c.keyframe_points) for c in ch}) != 1:
            continue
        qs = [Quaternion([c.keyframe_points[k].co[1] for c in ch])
              for k in range(len(ch[0].keyframe_points))]
        upright = Quaternion()
        for k, q in enumerate(qs):
            d = upright.slerp(q if q.w >= 0 else -q, keep)
            for i, c in enumerate(ch):
                p = c.keyframe_points[k]
                p.co[1] = p.handle_left[1] = p.handle_right[1] = d[i]
        for c in ch:
            c.update()
    print('STEADIED', clip, bones)

# v2's hands type about 5 cm lower than v1's (7 cm at the scenes' 1.38x),
# under the room's keyboard and through the hall's laptop, both placed for
# v1. In Typing, each elbow bends a further 9°, which lifts the hands back
# onto the keys. The bending axis is found on the rig itself: at a frame of
# the clip, the forearm's local axis (and sign) that raises the index tip most.
RAISE = math.radians(9)
typing = bpy.data.actions.get('Typing')
if typing:
    rig.animation_data.action = typing
    scene.frame_set(150)
    pose = {pb.name: pb.rotation_quaternion.copy() for pb in rig.pose.bones}
    fcs = _fcurves(typing)
    for side in ('Left', 'Right'):
        fore = rig.pose.bones[f'mixamorig:{side}ForeArm']
        tip_bone = rig.pose.bones[f'mixamorig:{side}HandIndex4']
        rig.animation_data.action = None
        best = None
        for axis in ((1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1), (0, 1, 0), (0, -1, 0)):
            for pb in rig.pose.bones:
                pb.rotation_quaternion = pose[pb.name].copy()
            bpy.context.view_layer.update()
            p0 = rig.matrix_world @ tip_bone.head
            fore.rotation_quaternion = pose[fore.name] @ Quaternion(Vector(axis), RAISE)
            bpy.context.view_layer.update()
            d = rig.matrix_world @ tip_bone.head - p0
            out = d.x if side == 'Left' else -d.x  # + is away from the body's middle
            print('  axis', axis, 'dz %+.3f out %+.3f back %+.3f' % (d.z, out, d.y))
            if best is None or d.z > best[0]:
                best = (d.z, axis)
        for pb in rig.pose.bones:
            pb.rotation_quaternion = pose[pb.name].copy()
        off = Quaternion(Vector(best[1]), RAISE)
        path = f'pose.bones["mixamorig:{side}ForeArm"].rotation_quaternion'
        ch = [fcs.find(path, index=i) for i in range(4)]
        if all(ch) and len({len(c.keyframe_points) for c in ch}) == 1:
            for k in range(len(ch[0].keyframe_points)):
                q = Quaternion([c.keyframe_points[k].co[1] for c in ch]) @ off
                for i, c in enumerate(ch):
                    c.keyframe_points[k].co[1] = q[i]
                    c.keyframe_points[k].handle_left[1] = q[i]
                    c.keyframe_points[k].handle_right[1] = q[i]
            for c in ch:
                c.update()
        print('TYPING', side, 'elbow axis', best[1], 'lifts the tip', round(best[0], 3))
        rig.animation_data.action = typing
    rig.animation_data.action = None

# Material: the Flagship colour and normal maps, matte (constant roughness, no
# metal: Meshy's guesses there catch the lights as glossy bands).
src = imported(lambda: bpy.ops.import_scene.gltf(filepath=str(HERE / 'source/meshy-flagship.glb')))
mat = next(o for o in src if o.type == 'MESH').data.materials[0]
mat.name = 'JongwooV2'
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
for name, value in (('Metallic', 0.0), ('Roughness', 0.78)):
    for link in list(bsdf.inputs[name].links):
        mat.node_tree.links.remove(link)
    bsdf.inputs[name].default_value = value
body.data.materials.clear()
body.data.materials.append(mat)
for o in src:
    bpy.data.objects.remove(o, do_unlink=True)

# The hoodie's green bled into the hair texture at the back of the head (a
# grey-green patch seen as the camera passes behind him). On the head's faces,
# greenish texels that aren't skin are repainted the hair's own colour,
# keeping their shading.
import numpy as np
img = bsdf.inputs['Base Color'].links[0].from_node.image
W_, H_ = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(H_, W_, 4)
gi = {vg.index: vg.name for vg in body.vertex_groups}
uvl = body.data.uv_layers.active.data
head_mask = np.zeros((H_, W_), dtype=bool)
for poly in body.data.polygons:
    vs = [body.data.vertices[i] for i in poly.vertices]
    if not all(v.groups and 'Head' in gi[max(v.groups, key=lambda g: g.weight).group] for v in vs):
        continue
    pts = np.array([uvl[li].uv[:] for li in poly.loop_indices]) * [W_, H_]
    x0, y0 = np.floor(pts.min(0)).astype(int)
    x1, y1 = np.ceil(pts.max(0)).astype(int)
    x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W_ - 1), min(y1, H_ - 1)
    if x1 < x0 or y1 < y0 or len(pts) != 3:
        continue
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    a, b_, c = pts
    d = (b_[1] - c[1]) * (a[0] - c[0]) + (c[0] - b_[0]) * (a[1] - c[1])
    if abs(d) < 1e-9:
        continue
    l1 = ((b_[1] - c[1]) * (gx - c[0]) + (c[0] - b_[0]) * (gy - c[1])) / d
    l2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / d
    head_mask[y0:y1 + 1, x0:x1 + 1] |= (l1 >= -0.05) & (l2 >= -0.05) & (1 - l1 - l2 >= -0.05)
for _ in range(3):  # grow over island edges
    g2 = head_mask.copy()
    g2[1:] |= head_mask[:-1]; g2[:-1] |= head_mask[1:]
    g2[:, 1:] |= head_mask[:, :-1]; g2[:, :-1] |= head_mask[:, 1:]
    head_mask = g2
r, g, b = px[..., 0], px[..., 1], px[..., 2]
skin = r > g * 1.12
greenish = head_mask & ~skin & (g > r * 1.03) & (g > b * 1.03) & (g > 0.06)
hair = head_mask & ~skin & ~greenish & (np.maximum(np.maximum(r, g), b) < 0.25)
hair_rgb = np.median(px[hair][:, :3], axis=0) if hair.any() else np.array([0.03, 0.025, 0.025])
lum = (0.3 * r + 0.59 * g + 0.11 * b)[greenish]
scale = np.clip(lum / max(float(lum.mean()), 1e-4), 0.7, 1.3)[:, None] if lum.size else 1
px[greenish, :3] = hair_rgb * scale
img.pixels.foreach_set(px.ravel())
img.pack()
print('HAIR_FIX texels', int(greenish.sum()), 'hair colour', np.round(hair_rgb, 3))

# The normal map still carries the hand creases smoothed out of the mesh
# above, which then glinted as pale strokes: on the hands' faces it is
# flattened (the full-resolution mesh carries the hands' shape by itself).
nimg = None
for link in bsdf.inputs['Normal'].links:
    nm_node = link.from_node
    for l2 in nm_node.inputs['Color'].links:
        nimg = l2.from_node.image
if nimg is not None:
    NW, NH = nimg.size
    npx = np.array(nimg.pixels[:], dtype=np.float32).reshape(NH, NW, 4)
    hand_mask = np.zeros((NH, NW), dtype=bool)
    for poly in body.data.polygons:
        vs = [body.data.vertices[i] for i in poly.vertices]
        if not all(v.groups and 'Hand' in gi[max(v.groups, key=lambda g: g.weight).group] for v in vs):
            continue
        pts = np.array([uvl[li].uv[:] for li in poly.loop_indices]) * [NW, NH]
        if len(pts) != 3:
            continue
        x0, y0 = np.floor(pts.min(0)).astype(int)
        x1, y1 = np.ceil(pts.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, NW - 1), min(y1, NH - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        a, b_, c = pts
        d = (b_[1] - c[1]) * (a[0] - c[0]) + (c[0] - b_[0]) * (a[1] - c[1])
        if abs(d) < 1e-9:
            continue
        l1 = ((b_[1] - c[1]) * (gx - c[0]) + (c[0] - b_[0]) * (gy - c[1])) / d
        l2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / d
        hand_mask[y0:y1 + 1, x0:x1 + 1] |= (l1 >= -0.05) & (l2 >= -0.05) & (1 - l1 - l2 >= -0.05)
    for _ in range(3):
        g2 = hand_mask.copy()
        g2[1:] |= hand_mask[:-1]; g2[:-1] |= hand_mask[1:]
        g2[:, 1:] |= hand_mask[:, :-1]; g2[:, :-1] |= hand_mask[:, 1:]
        hand_mask = g2
    npx[hand_mask, 0] = 0.5
    npx[hand_mask, 1] = 0.5
    npx[hand_mask, 2] = 1.0
    nimg.pixels.foreach_set(npx.ravel())
    nimg.pack()
    print('HAND_NORMALS flattened texels', int(hand_mask.sum()))

# Seated, the thighs rose straight up through the hoodie's front hem (Mixamo
# weighted the hem to the hips and spine only). The front of the hem now
# follows the thighs a little (up to 55 % at the hem, fading out 12 cm up),
# so sitting lifts it onto them; standing, the thighs hang straight and
# nothing changes. Hoodie vertices are told by their texture colour.
mw = body.matrix_world
def texel(v_index):
    return None
loop_uv = {}
for poly in body.data.polygons:
    for li in poly.loop_indices:
        loop_uv.setdefault(body.data.loops[li].vertex_index, uvl[li].uv[:])
def colour_at(vi):
    u, v_ = loop_uv.get(vi, (0, 0))
    return px[min(int(v_ * H_), H_ - 1), min(int(u * W_), W_ - 1), :3]
core = [v for v in body.data.vertices if v.groups and gi[max(v.groups, key=lambda g: g.weight).group].endswith(('Spine', 'Spine1'))]
hood = np.median([colour_at(v.index) for v in core], axis=0)
torso = []
for v in body.data.vertices:
    if not v.groups:
        continue
    g = gi[max(v.groups, key=lambda g: g.weight).group]
    if not g.endswith(('Hips', 'Spine', 'Spine1')):
        continue
    p = mw @ v.co
    if abs(p.x) > 0.3 or np.abs(colour_at(v.index) - hood).max() > 0.12:
        continue
    torso.append((v, p))
z_hem = min(p.z for _, p in torso)
y_mid = float(np.median([p.y for _, p in torso]))
legs = {s: body.vertex_groups.get(f'mixamorig:{s}UpLeg') for s in ('Left', 'Right')}
moved = 0
for v, p in torso:
    if p.y > y_mid:  # the back stays on the hips
        continue
    t = 1 - (p.z - z_hem) / 0.12
    if t <= 0:
        continue
    w = 0.55 * t ** 1.5
    left = min(1.0, max(0.0, 0.5 + p.x / 0.06))  # +X is his left; blend across the middle
    for g in v.groups:
        g.weight *= 1 - w
    legs['Left'].add([v.index], w * left, 'ADD')
    legs['Right'].add([v.index], w * (1 - left), 'ADD')
    moved += 1
print('HEM onto the thighs:', moved, 'verts, hem at z', round(z_hem, 3))

# Blinking lids: decals over his painted eyes (face_parts.py). In the room he wears socks and slippers, in the hall the
# sneakers Meshy gave him (feet.py); the page shows one or the other.
import sys
sys.path.insert(0, str(HERE))
import face_parts
import feet
decals = face_parts.build(body, px)
for o in decals:
    face_parts.skin(o, body, rig)
sneakers = feet.split_sneakers(body, px)
socks = feet.make_socks(sneakers)
slippers = feet.make_slippers(socks, rig)
face_parts.skin(slippers, socks, rig)

# Weld vertices split along UV seams (they would shade as creases).
for ob in (body, sneakers):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    print('WELD', ob.name, n0, '->', len(bm.verts))
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = True

OUT.parent.mkdir(parents=True, exist_ok=True)
if os.environ.get('SAVE_BLEND'):  # for checking renders
    bpy.ops.wm.save_as_mainfile(filepath=os.environ['SAVE_BLEND'], copy=True)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for ob in (body, sneakers, socks, slippers, worn_bag, *decals):
    ob.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=str(OUT), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_skins=True, export_yup=True, export_image_format='WEBP',
    export_image_quality=88,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
    export_draco_generic_quantization=12,
)
print('WEB_GLB', OUT, OUT.stat().st_size)
