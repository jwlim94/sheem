"""Real hands for the hoodie character (imported by build_web_glb.py).

Meshy generated mitten hands: the four fingers one paddle, a thumb apart, no
knuckles. Mixamo rigged them so (thumb and index bones only, the index
running down the middle of the paddle). This replaces them, on the rig's
T-pose rest (palms down, thumbs forward, -Y):

- The mitten's skin is cut away (faces weighted wholly to the hand's bones
  and textured as skin: the ribbed cuff is the hand bone's too, and stays);
  the new wrist fills the cuff's opening from inside, so the cut never
  shows.
- A new hand is built per side: a palm of overlapping ellipsoids (heel,
  knuckle ridge, the thumb's mound) and five fingers swept as tubes through
  their joints, each joint a touch fuller than the shaft between (they read
  as segments), the fingers fanned slightly and resting with a little curl,
  small bumps over the knuckles on the back. They are fused into one surface
  (voxel remesh), smoothed and decimated, in a skin tone sampled from the
  mitten's texture.
- Bones: the index and thumb bones move to the new joints, keeping their
  orientation (so the clips' rotations mean the same); middle, ring and
  little-finger bones are added as copies of the index's, at their joints.
- Weights: bone heat (Blender's automatic weights) from the hand and finger
  bones and the forearm only. Weights set by hand from each vertex's nearest
  finger pulled parts of the palm with the thumb and crumpled the back of the
  hand when typing.
- Clips: they only animate the thumb and index, so the other fingers take
  the index's rotations, the ring and little finger curling a little more.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Quaternion, Vector

FINGERS = (
    # name, lateral offset (finger spacings, toward the thumb), length,
    # knuckle shift along the hand (m), fan (deg, + toward the little finger),
    # thickness, clip curl factor
    # Fanned just enough that the fused fingers part toward the tips; every
    # finger takes the index's curl exactly (fused roots would tear otherwise).
    ('Index', 1.5, 0.94, -0.002, -4.0, 1.0, 1.0),
    ('Middle', 0.5, 1.0, 0.004, -0.5, 1.03, 1.0),
    ('Ring', -0.5, 0.95, 0.0, 3.5, 0.98, 1.0),
    ('Pinky', -1.5, 0.8, -0.009, 7.5, 0.88, 1.0),
)
# Chunky, as the character is: the fingers about as long as the palm (the
# rig's index chain, made for the mitten, is half as long again), thick,
# a little space between them.
LENGTH = 0.74
SPACING = 0.0215  # m between finger centres: thick fingers overlap at the root
R_FINGER = (0.0138, 0.0131, 0.0124)  # proximal, middle, distal shaft radius
CURL = math.radians(13)  # rest curl per joint (relaxed, as the mitten was)
# The clips bent the mitten's single "index" a long way (the whole paddle);
# on real fingers that closed them into a fist. Their finger rotations are
# scaled down: typing to a loose curve over the keys, the rest a little.
CLIP_FINGERS = {'Typing': 0.7}
CLIP_FINGERS_DEFAULT = 0.85
VOXEL = 0.0011


def _srgb_to_linear(c):
    return [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]


def _rot(v, axis, ang):
    return Quaternion(axis, ang) @ v


def _ellipsoid(name, centre, axes, half):
    """A UV sphere scaled to half-extents `half` along the frame `axes`."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=18, radius=1.0)
    ax = [a.normalized() for a in axes]
    for v in bm.verts:
        x, y, z = v.co
        v.co = centre + ax[0] * (x * half[0]) + ax[1] * (y * half[1]) + ax[2] * (z * half[2])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def _tube(name, pts, radii):
    """A smooth tube through `pts` (skin modifier), rounded at both ends."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in pts], [(i, i + 1) for i in range(len(pts) - 1)], [])
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.modifiers.new('Skin', 'SKIN')
    for sv, r in zip(me.skin_vertices[0].data, radii):
        sv.radius = (r, r)
    me.skin_vertices[0].data[0].use_root = True
    o.modifiers.new('Sub', 'SUBSURF').levels = 2
    return o


def _apply_all(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')


def _seg_param(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return t, (a + ab * t - p).length


def skin_colour(body, image):
    """Median colour of the mitten's texels (sRGB), excluding the cuff."""
    W, H = image.size
    px = np.array(image.pixels[:], dtype=np.float32).reshape(H, W, 4)
    gi = {vg.index: vg.name for vg in body.vertex_groups}
    uv = body.data.uv_layers.active.data
    cols = []
    for poly in body.data.polygons:
        vs = [body.data.vertices[i] for i in poly.vertices]
        if all(v.groups and 'Hand' in gi[max(v.groups, key=lambda g: g.weight).group] for v in vs):
            for li in poly.loop_indices:
                u, v = uv[li].uv
                cols.append(px[min(int(v * H), H - 1), min(int(u * W), W - 1), :3])
    c = np.median(np.array(cols), axis=0)
    return tuple(float(x) for x in c)


def cut_mittens(body, rig, image, skin):
    """Cuts the mitten: faces all of whose vertices belong to the hand's
    bones, except the ribbed cuff (weighted to the hand bone too; told by its
    sleeve colour): cut by weights alone it went too, and the sleeve ended
    ragged. Cutting only skin-coloured faces left the mitten's painted creases
    floating by the hands. Returns, per side, the cuff
    opening left behind: its radius and where it is along the arm (from the
    wrist), for the new wrist to fill."""
    gi = {vg.index: vg.name for vg in body.vertex_groups}
    W_, H_ = image.size
    px = np.array(image.pixels[:], dtype=np.float32).reshape(H_, W_, 4)
    skin = np.array(skin)
    M = rig.matrix_world
    wrists = {}
    for side in ('Left', 'Right'):
        w = M @ rig.data.bones[f'mixamorig:{side}Hand'].head_local
        e = M @ rig.data.bones[f'mixamorig:{side}ForeArm'].head_local
        wrists[side] = (w, (w - e).normalized())
    bm = bmesh.new()
    bm.from_mesh(body.data)
    dv = bm.verts.layers.deform.active
    uvl = bm.loops.layers.uv.active
    mw = body.matrix_world

    def in_hand(v):
        d = v[dv]
        if not d:
            return False
        g = max(d.items(), key=lambda kv: kv[1])[0]
        return 'Hand' in gi[g]

    def colour(f):
        cols = [px[min(int(l[uvl].uv[1] * H_), H_ - 1), min(int(l[uvl].uv[0] * W_), W_ - 1), :3] for l in f.loops]
        return np.mean(cols, axis=0)

    def on_forearm(f):
        g = [max(v[dv].items(), key=lambda kv: kv[1])[0] for v in f.verts if v[dv]]
        return g and all(gi[x].endswith('ForeArm') for x in g)
    sleeve = np.median([colour(f) for f in bm.faces if on_forearm(f)], axis=0)
    cut = [f for f in bm.faces if all(in_hand(v) for v in f.verts)
           and np.abs(colour(f) - sleeve).max() > 0.12]
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # Any small island left near a hand (bits of the mitten under no rule).
    seen, crumbs = set(), []
    for f0 in bm.faces:
        if f0 in seen:
            continue
        isle, stack = [], [f0]
        seen.add(f0)
        while stack:
            f = stack.pop()
            isle.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g not in seen:
                        seen.add(g)
                        stack.append(g)
        c = mw @ isle[0].calc_center_median()
        if len(isle) < 30 and any((c - w).length < 0.25 for w, _ in wrists.values()):
            crumbs += isle
    bmesh.ops.delete(bm, geom=crumbs, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    print('HANDS crumbs removed', len(crumbs))
    # The cuff's hem, now an open edge stepped along face boundaries: relaxed
    # into a smooth ring along itself, and turned in a little toward the arm.
    inv = mw.inverted()
    for side, (w, ax) in wrists.items():
        rim = [v for v in bm.verts if v.is_boundary and (mw @ v.co - w).length < 0.08]
        nbr = {v: [e.other_vert(v) for e in v.link_edges if e.is_boundary] for v in rim}
        for _ in range(8):
            new = {}
            for v in rim:
                if len(nbr[v]) == 2:
                    new[v] = (v.co * 2 + nbr[v][0].co + nbr[v][1].co) / 4
            for v, co in new.items():
                v.co = co
        for v in rim:
            p = mw @ v.co
            s_ = (p - w).dot(ax)
            on = w + ax * s_
            v.co = inv @ (on + (p - on) * 0.94)
    openings = {}
    for side, (w, ax) in wrists.items():
        rim = [mw @ v.co for v in bm.verts if v.is_boundary and (mw @ v.co - w).length < 0.08]
        ss = [(p - w).dot(ax) for p in rim]
        rr = [((p - w) - ax * s_).length for p, s_ in zip(rim, ss)]
        openings[side] = (float(np.median(rr)), float(np.median(ss)))
    bm.to_mesh(body.data)
    bm.free()
    print('HANDS cut mitten faces', len(cut), 'openings', {k: tuple(round(x, 4) for x in v) for k, v in openings.items()})
    return openings


def build_hand(rig, side, opening):
    """The new hand's mesh (world space), its joints and its finger frames."""
    M = rig.matrix_world
    bones = rig.data.bones
    head = lambda n: M @ bones[f'mixamorig:{side}{n}'].head_local  # noqa: E731
    W = head('Hand')
    I = [head(f'HandIndex{j}') for j in (1, 2, 3, 4)]
    T = [head(f'HandThumb{j}') for j in (1, 2, 3, 4)]
    f = (I[0] - W).normalized()  # forward, along the hand
    u = Vector((0, 0, 1))  # back of the hand (palms down in the T-pose)
    t = u.cross(f).normalized()
    if t.dot(T[1] - W) < 0:  # thumb side
        t = -t
    seg = [(I[1] - I[0]).length, (I[2] - I[1]).length, (I[3] - I[2]).length + 0.004]
    parts, joints = [], {}
    for name, lat, length, shift, fan, thick, _ in FINGERS:
        mcp = I[0] + t * (lat * SPACING) + f * shift - u * 0.001
        # Fanned in the hand's plane, + toward the little finger (-t).
        d = _rot(f, u, -math.radians(fan) * (1 if u.cross(f).dot(t) > 0 else -1))
        lat_ax = d.cross(u).normalized()
        pts, js = [mcp], [mcp]
        p, dj = mcp, d
        for k in range(3):
            dj = _rot(dj, lat_ax, -CURL * (0.6 if k == 0 else 1.0))
            p = p + dj * seg[k] * length * LENGTH
            js.append(p)
        # Shaft samples between joints: joints a touch fuller (segments read).
        rr = [r * thick for r in R_FINGER]
        tube_pts, tube_r = [], []
        for k in range(3):
            a, b = js[k], js[k + 1]
            tube_pts += [a, a.lerp(b, 0.5)]
            tube_r += [rr[k] * (1.02 if k == 0 else 1.0), rr[k] * 0.99]
        tip = js[3] - dj * rr[2] * 0.55
        tube_pts.append(tip)
        tube_r.append(rr[2] * 0.95)
        js[3] = tip + dj * rr[2] * 0.9  # the very tip (end bone)
        parts.append(_tube(f'{side} {name}', tube_pts, tube_r))
        # A soft knuckle on the back of the hand, at the finger's root.
        c = js[0] + u * (rr[0] * 0.66)
        parts.append(_ellipsoid(f'{side} {name} knuckle', c, (f, t, u), (0.0058, 0.0046, 0.0036)))
        joints[name] = js
    # Thumb: along its own bones, from the mound in the palm to its tip.
    # Shortened about its second joint, like the fingers, and thick.
    Ts = [T[0], T[1]] + [T[1] + (p - T[1]) * 0.92 for p in T[2:]]
    td = (Ts[3] - Ts[2]).normalized()
    tjs = [Ts[0], Ts[1], Ts[2], Ts[3], Ts[3] + td * 0.011]
    parts.append(_tube(f'{side} Thumb', tjs[1:], [0.0152, 0.0142, 0.0132, 0.0122]))
    joints['Thumb'] = tjs
    # Palm: heel, knuckle ridge, the thumb's mound; the wrist into the cuff.
    pc = W + f * 0.043 - u * 0.001
    parts.append(_ellipsoid(f'{side} palm', pc, (f, t, u), (0.047, 0.05, 0.0175)))
    parts.append(_ellipsoid(f'{side} ridge', I[0] + f * 0.008 - u * 0.0008, (f, t, u), (0.022, 0.056, 0.0165)))
    mound_c = T[0].lerp(T[1], 0.45) - u * 0.002
    parts.append(_ellipsoid(f'{side} mound', mound_c, (T[1] - T[0], t, u), (0.03, 0.019, 0.017)))
    # The wrist fills the cuff's opening, from just inside it.
    open_r, open_s = opening
    wr = open_r * 0.96
    parts.append(_tube(f'{side} wrist', [W + f * (open_s - 0.03), W + f * (open_s + 0.004), W + f * 0.02],
                       [wr * 0.96, wr, wr * 0.86]))
    for o in parts:
        _apply_all(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    hand = bpy.context.object
    hand.name = f'{side}HandMesh'
    rem = hand.modifiers.new('Fuse', 'REMESH')
    rem.mode, rem.voxel_size, rem.use_smooth_shade = 'VOXEL', VOXEL, True
    sm = hand.modifiers.new('Soften', 'LAPLACIANSMOOTH')
    sm.iterations, sm.lambda_factor = 10, 0.6
    dec = hand.modifiers.new('Lighter', 'DECIMATE')
    dec.ratio = 0.12
    _apply_all(hand)
    for p in hand.data.polygons:
        p.use_smooth = True
    print('HANDS', side, len(hand.data.vertices), 'verts, wrist r', round(wr, 4))
    return hand, joints, (W, f, t, u)


def rebone(rig, side, joints):
    """Index and thumb bones to the new joints (orientation kept); middle, ring
    and little-finger bones added as copies of the index's."""
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    Minv = rig.matrix_world.inverted()
    pre = f'mixamorig:{side}Hand'
    index = [eb[f'{pre}Index{j}'] for j in (1, 2, 3, 4)]
    vecs = [b.tail - b.head for b in index]
    rolls = [b.roll for b in index]

    def place(b, world_head, vec, roll):
        b.use_connect = False
        b.head = Minv @ world_head
        b.tail = b.head + vec
        b.roll = roll
    for j in range(4):
        place(index[j], joints['Index'][j], vecs[j], rolls[j])
    for j in range(4):
        b = eb[f'{pre}Thumb{j + 1}']
        place(b, joints['Thumb'][j], b.tail - b.head, b.roll)
    for name in ('Middle', 'Ring', 'Pinky'):
        parent = eb[pre]
        for j in range(4):
            b = eb.new(f'{pre}{name}{j + 1}')
            b.head = Minv @ joints[name][j]
            b.tail = b.head + vecs[j]
            b.roll = rolls[j]
            b.parent = parent
            b.use_connect = False
            b.use_deform = j < 3
            parent = b
    bpy.ops.object.mode_set(mode='OBJECT')


def weigh(hand, rig, side, joints, frame):
    """Vertex groups for the new hand from its own construction."""
    W, f, t, u = frame
    pre = f'mixamorig:{side}'
    groups = {}

    def g(name):
        if name not in groups:
            groups[name] = hand.vertex_groups.new(name=name)
        return groups[name]
    names = [n[0] for n in FINGERS] + ['Thumb']
    for v in hand.data.vertices:
        p = v.co
        # Nearest finger (or thumb) centreline, and where along it.
        best = None
        for n in names:
            js = joints[n]
            for k in range(len(js) - 1):
                s_, d = _seg_param(p, js[k], js[k + 1])
                if best is None or d < best[0]:
                    best = (d, n, k, s_)
        d, n, k, s_ = best
        along = (p - W).dot(f)
        w = {}
        if n == 'Thumb':
            # Segments: the mound (Thumb1, easing in from the hand bone), then
            # Thumb2 and Thumb3 (which also carries the tip).
            bone = min(k + 1, 3)
            if k == 0:
                a = s_ ** 1.5
                w[f'{pre}HandThumb1'] = a
                w[f'{pre}Hand'] = 1 - a
            elif k < 3 and s_ < 0.25:
                a = 0.5 + 2 * s_
                w[f'{pre}HandThumb{bone}'] = a
                w[f'{pre}HandThumb{bone - 1}'] = 1 - a
            else:
                w[f'{pre}HandThumb{bone}'] = 1.0
        else:
            js = joints[n]
            knuckle = (js[0] - W).dot(f)
            if along < knuckle - 0.004 or d > 0.022:
                # Palm: the hand bone, into the forearm at the wrist.
                fa = min(1.0, max(0.0, (0.012 - along) / 0.03))
                w[f'{pre}Hand'] = 1 - fa
                if fa > 0:
                    w[f'{pre}ForeArm'] = fa
            else:
                # Along the finger, blended over each joint.
                seg_len = (js[k + 1] - js[k]).length
                pos = s_ * seg_len
                cur = f'{pre}Hand{n}{k + 1}'
                prev = f'{pre}Hand{n}{k}' if k > 0 else f'{pre}Hand'
                span = 0.006 if k > 0 else 0.009
                if pos < span:
                    a = 0.5 + 0.5 * pos / span
                    w[cur] = a
                    w[prev] = 1 - a
                elif k < 2 and pos > seg_len - span:
                    nxt = f'{pre}Hand{n}{k + 2}'
                    a = 0.5 * (pos - (seg_len - span)) / span
                    w[cur] = 1 - a
                    w[nxt] = a
                else:
                    w[cur] = 1.0
        for name, val in w.items():
            if val > 1e-4:
                g(name).add([v.index], val, 'REPLACE')


def weigh_auto(hands, rig):
    """Bone-heat weights from the hands' own bones (and the forearms, for the
    wrists): every other bone is set not to deform while they're computed."""
    keep = lambda n: 'Hand' in n or 'ForeArm' in n  # noqa: E731
    saved = {b.name: b.use_deform for b in rig.data.bones}
    for b in rig.data.bones:
        b.use_deform = saved[b.name] and keep(b.name)
    bpy.ops.object.select_all(action='DESELECT')
    hands.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for b in rig.data.bones:
        b.use_deform = saved[b.name]
    print('HANDS weights', len(hands.vertex_groups), 'groups,',
          sum(1 for v in hands.data.vertices if not v.groups), 'unweighted verts')


def _fcurves(action):
    if hasattr(action, 'fcurves') and len(action.fcurves):
        return action.fcurves
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                return bag.fcurves
    return action.fcurves


def copy_clips(side):
    """The index's rotations, scaled per clip (CLIP_FINGERS), and the middle,
    ring and little fingers given the same."""
    pre = f'mixamorig:{side}Hand'
    for action in bpy.data.actions:
        fcs = _fcurves(action)
        amount = CLIP_FINGERS.get(action.name, CLIP_FINGERS_DEFAULT)
        for j in (1, 2, 3):
            src = f'pose.bones["{pre}Index{j}"].rotation_quaternion'
            ch = [fcs.find(src, index=i) for i in range(4)]
            if not all(ch):
                continue
            n = len(ch[0].keyframe_points)
            if any(len(c.keyframe_points) != n for c in ch):
                continue
            frames = [kp.co[0] for kp in ch[0].keyframe_points]
            vals = [[kp.co[1] for kp in c.keyframe_points] for c in ch]
            for name, *_rest, k in FINGERS:
                bone = f'{pre}{name}{j}'
                path = f'pose.bones["{bone}"].rotation_quaternion'
                qs = []
                for m in range(n):
                    axis, ang = Quaternion([vals[i][m] for i in range(4)]).to_axis_angle()
                    qs.append(Quaternion(axis, ang * k * amount))
                for i in range(4):
                    old = fcs.find(path, index=i)
                    if old:
                        fcs.remove(old)
                    fc = fcs.new(path, index=i, action_group=bone)
                    fc.keyframe_points.add(n)
                    co = np.empty(2 * n, dtype=np.float32)
                    co[0::2] = frames
                    co[1::2] = [q[i] for q in qs]
                    fc.keyframe_points.foreach_set('co', co)
                    for kp in fc.keyframe_points:
                        kp.interpolation = 'LINEAR'
                    fc.update()
        print('HANDS clip', action.name, side)


def rebuild(body, rig, image):
    """Replaces both mitten hands; returns the new skinned hand object."""
    sRGB = skin_colour(body, image)
    mat = bpy.data.materials.new('Skin')
    mat.use_nodes = True
    b = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*_srgb_to_linear(sRGB), 1)
    b.inputs['Roughness'].default_value = 0.72
    print('HANDS skin sRGB', [round(c, 3) for c in sRGB])
    openings = cut_mittens(body, rig, image, sRGB)
    made = []
    for side in ('Left', 'Right'):
        hand, joints, frame = build_hand(rig, side, openings[side])
        rebone(rig, side, joints)
        copy_clips(side)
        made.append(hand)
    bpy.ops.object.select_all(action='DESELECT')
    for o in made:
        o.select_set(True)
    bpy.context.view_layer.objects.active = made[0]
    bpy.ops.object.join()
    hands = bpy.context.object
    hands.name = 'Hands'
    hands.data.materials.clear()
    hands.data.materials.append(mat)
    weigh_auto(hands, rig)
    return hands
