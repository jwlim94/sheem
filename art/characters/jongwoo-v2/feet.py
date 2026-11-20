"""Sneakers for the hall, socks and house slippers for his room (v2 character,
build_web_glb.py).

Meshy sculpted white sneakers onto the character. At home he wears socks
and the slippers the hoodie character wore (art/characters/jongwoo-hoodie):

- Sneakers: the shoes' faces (light texels below the trouser cuffs), split
  from the body into their own mesh, as they were.
- Socks: a copy of the sneakers smoothed into a soft foot (the laces, sole
  lip and toe cap gone), shrunk toward the ankle (the cartoon shoes are
  about 17 % of his height: clown feet in slippers), its rim kept where it
  meets the cuff; white.
- Slippers: lofted around the socks as the hoodie character's were: the
  foot's own cross sections plus a margin, an opening cut by a plane rising
  from a low back toward the instep, a padded collar roll, thickness, a
  cream sole band; charcoal felt.

The page shows Sneakers in the hall and Socks with Slippers in the room.
All three are skinned with the body's weights. Coordinates are the T rest
pose's, in metres, before the scenes' 1.38x.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

SOCK_SCALE = 0.86  # the socks' footprint against the sneakers'
SLIP_MARGIN, SLIP_BACK = 0.0065, 0.045  # m: gap around the foot, back height


def _material(name, rgb, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = 0.0
    return m


def _select_only(*objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def split_sneakers(body, px):
    """Moves the shoes' faces into a new object 'Sneakers' (same material,
    groups, armature and parent) and returns it."""
    me = body.data
    H, W = px.shape[:2]
    mw = body.matrix_world
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    li = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get('vertex_index', li)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    M = np.array(mw)
    P = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
    start = np.empty(len(me.polygons), dtype=np.int64)
    me.polygons.foreach_get('loop_start', start)
    tot = np.empty(len(me.polygons), dtype=np.int64)
    me.polygons.foreach_get('loop_total', tot)
    assert (tot == 3).all()
    L = start[:, None] + np.arange(3)[None, :]
    z = P[li[L], 2].max(1)
    u = uv[L].mean(1)
    col = px[np.clip((u[:, 1] * H).astype(int), 0, H - 1), np.clip((u[:, 0] * W).astype(int), 0, W - 1), :3]
    shoe = (z < 0.24) & (col.min(1) > 0.42)
    # Dark paint enclosed by the shoe (the lace holes, seams) is shoe too:
    # of the other faces low down, those not connected to the trousers above.
    low = np.flatnonzero((z < 0.32) & ~shoe)
    key = np.round(P / 1e-5).astype(np.int64)
    _, vid = np.unique(key, axis=0, return_inverse=True)  # welded vertex ids
    vid = vid.ravel()
    tri = vid[li[L[low]]]
    parent = np.arange(len(low))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    owner = {}
    for fi, t in enumerate(tri):
        for k in range(3):
            e = (min(t[k], t[(k + 1) % 3]), max(t[k], t[(k + 1) % 3]))
            if e in owner:
                a, b = find(fi), find(owner[e])
                if a != b:
                    parent[a] = b
            else:
                owner[e] = fi
    roots = np.array([find(i) for i in range(len(low))])
    up = set(roots[z[low] > 0.26].tolist())
    enclosed = low[~np.isin(roots, list(up))]
    shoe[enclosed] = True
    print('  enclosed paint', len(enclosed), 'faces')
    print('SNEAKERS', int(shoe.sum()), 'faces')
    _select_only(body)
    before = set(bpy.data.objects)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.mesh.select_all(action='DESELECT')
    bm = bmesh.from_edit_mesh(me)
    bm.faces.ensure_lookup_table()
    for i in np.flatnonzero(shoe):
        bm.faces[int(i)].select_set(True)
    bmesh.update_edit_mesh(me)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    sneakers = next(o for o in bpy.data.objects if o not in before)
    sneakers.name = 'Sneakers'
    sneakers.data.name = 'Sneakers'
    return sneakers


def make_socks(sneakers):
    """A soft, smaller foot from the sneakers' shape (see the module notes)."""
    socks = sneakers.copy()
    socks.data = sneakers.data.copy()
    socks.name = socks.data.name = 'Socks'
    bpy.context.scene.collection.objects.link(socks)
    mw = socks.matrix_world
    inv = mw.inverted()
    bm = bmesh.new()
    bm.from_mesh(socks.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    rim = [v for v in bm.verts if v.is_boundary]
    inner = [v for v in bm.verts if not v.is_boundary]
    for _ in range(220):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # Shrink toward each ankle (the leg's axis), fading out to the rim.
    ankles = {}
    for side in (1, -1):
        foot = [q for q in (mw @ r.co for r in rim) if q.x * side > 0]
        ankles[side] = (sum(q.x for q in foot) / len(foot), sum(q.y for q in foot) / len(foot),
                        min(q.z for q in foot))
        print('  sock rim', side, len(foot), 'verts, lowest at z', round(ankles[side][2], 3))
    for v in bm.verts:
        p = mw @ v.co
        ax, ay, top = ankles[1 if p.x > 0 else -1]
        t = min(1.0, max(0.0, (p.z - 0.05) / max(top - 0.05, 1e-3)))
        k = SOCK_SCALE + (1 - SOCK_SCALE) * t * t * (3 - 2 * t)
        if v.is_boundary:
            k = 1.0
        p.x = ax + (p.x - ax) * k
        p.y = ay + (p.y - ay) * k
        v.co = inv @ p
    bm.to_mesh(socks.data)
    bm.free()
    for p in socks.data.polygons:
        p.use_smooth = True
    socks.data.materials.clear()
    socks.data.materials.append(_material('Socks', (0.8, 0.8, 0.78), 0.95))  # white
    print('SOCKS', len(socks.data.vertices), 'verts')
    return socks


def _ring_pts(tc, a, b, z0, n=24, e=2.5):
    """A cross-section: superellipse over the top, flat across the bottom."""
    pts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        c, s_ = math.cos(th), math.sin(th)
        x = tc + a * math.copysign(abs(c) ** (2 / e), c)
        z = z0 + (b * abs(s_) ** (2 / e) if s_ > 0 else 0.004 * s_)
        pts.append((x, z))
    return pts


def _slipper(side, name, rig, P, slip_mat, sole_mat):
    scene = bpy.context.scene
    bone = 'Left' if side > 0 else 'Right'
    head = rig.matrix_world @ rig.data.bones[f'mixamorig:{bone}Foot'].head_local
    toe = rig.matrix_world @ rig.data.bones[f'mixamorig:{bone}Toe_End'].tail_local
    fwd = Vector((toe.x - head.x, toe.y - head.y, 0)).normalized()
    lat = Vector((-fwd.y, fwd.x, 0))
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
                      for t, z in _ring_pts((lo + hi) / 2, a, b, z0)])
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
                    for t, z in _ring_pts((lo + hi) / 2, a * math.cos(ph) ** 0.6, b * math.cos(ph) ** 0.5, z0)]
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
        _select_only(o)
        bpy.ops.object.convert(target='MESH')
    _select_only(ob, col)
    bpy.ops.object.join()
    for poly in ob.data.polygons:
        poly.use_smooth = True
    print('SLIPPER', name, len(ob.data.vertices), 'verts, length', round(s1 - s0, 3))
    return ob


def make_slippers(socks, rig):
    slip_mat = _material('Slipper', (0.2, 0.2, 0.235), 0.95)  # soft charcoal felt
    sole_mat = _material('Slipper sole', (0.72, 0.66, 0.56), 0.9)  # cream sole
    mw = socks.matrix_world
    P = [mw @ v.co for v in socks.data.vertices]
    parts = [_slipper(s, f'Slipper {s}', rig, [p for p in P if p.x * s > 0], slip_mat, sole_mat)
             for s in (1, -1)]
    _select_only(*parts)
    bpy.ops.object.join()
    slip = parts[0]
    slip.name = slip.data.name = 'Slippers'
    return slip
