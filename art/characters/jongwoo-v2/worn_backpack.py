"""His white backpack as he wears it, skinned to his rig (build_web_glb.py).

From Meshy's "Backpack Buddy" (art/portfolio-room/backpack-v2/worn-reference.glb,
2026-10-15): the same character generated wearing the bag, from images of him
and of it. Its body matches his (Meshy A-pose, same height and width; it
stands 10 cm further forward), so the bag and its straps come off it fitted to
him: over each shoulder, down the outside of his chest to the buckle, the
black webbing under his arm and back to the bag's base. They are told apart
from its body by how far they stand off his own surface and by their texture
(the bag's and straps' white and grey, the webbing's black; not the hoodie's
green, skin or hair), then specks are dropped. (Remodelled straps swept
through points had floated off the hoodie as flat bands.)

Skinned: the bag rigid on his upper spine (Spine2); the straps take his
body's weights where they lie, without his arms' (under his arm they would
stretch with it), drawn toward Spine2 near the bag so they stay on it.
"""
import bmesh
import bpy
import mathutils
import mathutils.kdtree
import numpy as np
from mathutils.bvhtree import BVHTree

# The reference's body against the hero source's (m, Blender axes).
REF_SHIFT = (0.0, 0.1, 0.0)
FACES = 30000  # after decimation
CLEAR = 0.005  # off his surface (m)
TUCK = 0.006  # its cut edges, under it
KEEP_GROUPS = ('Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder')
BAG_BONE = 'mixamorig:Spine2'


def _islands(bm):
    bm.faces.ensure_lookup_table()
    seen, out = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, comp = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        out.append(comp)
    out.sort(key=len, reverse=True)
    return out


def build(path, body, rig, offset):
    """The worn bag and straps, in `body`'s frame (`offset`: the hero source's
    centring, subtracted from it), skinned to `rig` from `body`'s weights."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    ref = next(o for o in new if o.type == 'MESH')
    for o in new:
        if o is not ref:
            bpy.data.objects.remove(o, do_unlink=True)
    ref.parent = None
    bpy.ops.object.select_all(action='DESELECT')
    ref.select_set(True)
    bpy.context.view_layer.objects.active = ref
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = ref.data
    shift = np.array(REF_SHIFT) - np.array(offset)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    me.vertices.foreach_set('co', (co.reshape(-1, 3) + shift).ravel())
    me.update()

    # How far each vertex stands off his surface (outside +).
    bm_b = bmesh.new()
    bm_b.from_mesh(body.data)
    tree = BVHTree.FromBMesh(bm_b)
    bm_b.free()
    mat = me.materials[0]
    img = next(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'
               and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links))
    W, H = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    off = {}
    for v in bm.verts:
        loc, n, _, dist = tree.find_nearest(v.co)
        off[v.index] = dist if (v.co - loc).dot(n) >= 0 else -dist
    kill = []
    for f in bm.faces:
        # (The tests below are in the source's own frame.)
        c = f.calc_center_median() + mathutils.Vector(offset)
        u = sum(l[uv].uv.x for l in f.loops) / len(f.loops)
        w = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
        r, g, b, _ = px[min(H - 1, max(0, int(w * H))), min(W - 1, max(0, int(u * W)))]
        mx, mn = max(r, g, b), min(r, g, b)
        # White and grey bag and straps, black webbing; behind him, the
        # bag's grey zips too.
        gear = (mn > 0.55 and mx - mn < 0.12) or mx < 0.22 or (c.y > 0.12 and mx - mn < 0.08)
        green = g > r + 0.03 and g > b + 0.03
        # Above his shoulders only hair and hood; out past them, his arms.
        # Below the bag's base only his trousers (black, like the webbing,
        # and standing off his own in places: they came along as shards
        # round his ankles); in front, below his chest, the same.
        ok = (min(off[v.index] for v in f.verts) > 0.002 and gear and not green
              and -0.25 < c.z < 0.52 and abs(c.x) < 0.3
              and not (mx < 0.22 and c.y < 0.05 and c.z < -0.02))
        if not ok:
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    isl = _islands(bm)
    bmesh.ops.delete(bm, geom=[f for c in isl if len(c) < 400 for f in c], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(me)
    bm.free()
    ref.name = 'Backpack worn'
    for p in me.polygons:
        p.use_smooth = True
    # Lighter: decimated (its UV seams kept), matte like his body.
    dec = ref.modifiers.new('Lighter', 'DECIMATE')
    dec.ratio = min(1.0, FACES / max(1, len(me.polygons)))
    bpy.ops.object.select_all(action='DESELECT')
    ref.select_set(True)
    bpy.context.view_layer.objects.active = ref
    bpy.ops.object.modifier_apply(modifier=dec.name)
    # Kept just off his surface: where the straps run under the hood's edge
    # and over his shoulders they sank into it and flecked through.
    # Its cut edges (where it was taken off the reference's body, ragged)
    # are tucked under the hoodie instead, so they don't show.
    bm = bmesh.new()
    bm.from_mesh(me)
    edge = {v.index for v in bm.verts if any(e.is_boundary for e in v.link_edges)}
    bm.free()
    pushed = tucked = 0
    for v in me.vertices:
        loc, n, _, dist = tree.find_nearest(v.co)
        if dist > 0.03:
            continue
        d = dist if (v.co - loc).dot(n) >= 0 else -dist
        if v.index in edge:
            if d > -TUCK:
                v.co = loc - n * TUCK
                tucked += 1
        elif -0.02 < d < CLEAR:
            v.co = loc + n * CLEAR
            pushed += 1
    me.update()
    print('WORN_BAG pushed off his surface', pushed, 'edges tucked', tucked)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for link in list(mat.node_tree.links):
        if link.to_node == bsdf and link.to_socket.name in ('Metallic', 'Roughness'):
            mat.node_tree.links.remove(link)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.8
    mat.name = 'Backpack worn'
    # The black zip line across the front pocket: his real bag has none
    # (2026-10-15, the user). Dark texels on the bag's outer face (facing
    # away from his back) are painted the bag's white; the black webbing
    # under his arms and at its base, facing sideways or down, is kept.
    _clear_pocket_line(me, img, px)
    print('WORN_BAG kept', len(me.polygons), 'faces')

    # Skinned. The bag (its biggest island: everything behind his back) on
    # Spine2; the straps from his body's weights, his arms' left out, drawn
    # onto Spine2 within 8 cm of the bag.
    import face_parts
    face_parts.skin(ref, body, rig)
    bm = bmesh.new()
    bm.from_mesh(me)
    bag = {v.index for v in _islands_verts(bm)}
    bm.verts.ensure_lookup_table()
    bag_pts = np.array([bm.verts[i].co[:] for i in sorted(bag)]) if bag else np.zeros((1, 3))
    bm.free()
    tree_bag = mathutils.kdtree.KDTree(len(bag_pts))
    for i, p in enumerate(bag_pts):
        tree_bag.insert(p, i)
    tree_bag.balance()
    gi = {vg.index: vg.name for vg in ref.vertex_groups}
    spine2 = ref.vertex_groups[BAG_BONE]
    for v in me.vertices:
        if v.index in bag:
            pull = 1.0
        else:
            _, _, d = tree_bag.find(v.co)
            pull = max(0.0, 1 - d / 0.08) ** 2
        keep = {g.group: g.weight for g in v.groups
                if gi[g.group].replace('mixamorig:', '') in KEEP_GROUPS}
        total = sum(keep.values())
        for gidx in [g.group for g in v.groups]:
            ref.vertex_groups[gidx].remove([v.index])
        if total <= 1e-6:
            keep, total, pull = {}, 1.0, 1.0
        for gidx, w in keep.items():
            ref.vertex_groups[gidx].add([v.index], (1 - pull) * w / total, 'REPLACE')
        if pull > 0:
            spine2.add([v.index], pull, 'ADD')
    return ref


def _islands_verts(bm):
    """The bag body's vertices: the biggest island once its straps are cut
    off where they leave its back (at its back panel's plane)."""
    isl = _islands(bm)
    if not isl:
        return []
    return {v for f in isl[0] for v in f.verts}


def _clear_pocket_line(me, img, px):
    H, W = px.shape[:2]
    uvl = me.uv_layers.active.data
    ys = [v.co.y for v in me.vertices]
    y_out = max(ys)
    light = []
    mask = np.zeros((H, W), bool)
    for poly in me.polygons:
        c = poly.center
        if poly.normal.y < 0.45 or c.y < y_out - 0.12 or abs(c.x) > 0.2:
            continue
        pts = np.array([uvl[li].uv[:] for li in poly.loop_indices]) * [W, H]
        x0, y0 = np.floor(pts.min(0)).astype(int) - 1
        x1, y1 = np.ceil(pts.max(0)).astype(int) + 1
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
        if x1 < x0 or y1 < y0:
            continue
        mask[y0:y1 + 1, x0:x1 + 1] = True
    region = px[mask, :3]
    if not len(region):
        return
    lum = region.max(1)
    white = np.median(region[lum > 0.6], axis=0) if (lum > 0.6).any() else np.array([0.85, 0.85, 0.85])
    dark = mask & (px[:, :, :3].max(2) < 0.45)
    # A little wider than the line itself (its soft edge).
    grown = dark.copy()
    for _ in range(2):
        g = grown.copy()
        g[1:] |= grown[:-1]; g[:-1] |= grown[1:]
        g[:, 1:] |= grown[:, :-1]; g[:, :-1] |= grown[:, 1:]
        grown = g & mask
    px[grown, :3] = white
    img.pixels.foreach_set(px.ravel())
    img.pack()
    print('WORN_BAG pocket line cleared texels', int(grown.sum()))
