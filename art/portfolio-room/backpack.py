"""A soft white backpack, modelled in Blender from code (shared by the room and
the lecture hall builders; import with sys.path set to this folder).

Built like the hero's slippers: the body is lofted from superellipse
cross-sections (flat-ish base, puffy sides, a domed top) and smoothed by
subdivision, so it reads as padded fabric, not boxes. A soft front pocket, a
flat side pocket, piping along the side seams, a zip over the dome and across
the pocket with pulls, a grab loop and a darker base. The shoulder straps are
not worn: flat padded ribbons that slump off both sides onto the floor.

Blender axes: front +X, width along Y, up +Z, base at z = 0; `height` in
metres. Returns one joined object.
"""
import math
import bmesh
import bpy
from mathutils import Vector

_mats = {}


def _srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def _mat(name, hexcolor, rough=0.9, glow=0.0):
    key = (name, hexcolor)
    if key not in _mats:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = (*_srgb(hexcolor), 1)
        b.inputs['Roughness'].default_value = rough
        if glow:
            b.inputs['Emission Color'].default_value = (*_srgb(hexcolor), 1)
            b.inputs['Emission Strength'].default_value = glow
        _mats[key] = m
    return _mats[key]


# Body proportions (height 1): half-depth along X, half-width along Y.
D, W, TOP_START = 0.17, 0.33, 0.6


def half_width(z):
    """Puffy sides, a slight belly, then a domed top (front view)."""
    if z <= TOP_START:
        return W * (0.96 + 0.04 * math.sin(math.pi * z / TOP_START))
    t = (z - TOP_START) / (1 - TOP_START)
    return W * math.sqrt(max(0.0, 1 - t ** 2.2))


def half_depth(z):
    """A little thicker low down (where things sit), rounding over the top."""
    base = D * (1.06 - 0.12 * z)
    if z <= 0.8:
        return base
    t = (z - 0.8) / 0.2
    return base * math.sqrt(max(0.0, 1 - t ** 2.4))


def _ring(z, n, e=2.8, xo=0.0):
    a, b = half_depth(z), half_width(z)
    out = []
    for i in range(n):
        th = 2 * math.pi * i / n
        c, s = math.cos(th), math.sin(th)
        x = math.copysign(abs(c) ** (2 / e), c) * a + xo
        y = math.copysign(abs(s) ** (2 / e), s) * b
        out.append((x, y, z))
    return out


def _loft(name, rings, mats, cap_bottom=True, cap_top=True):
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in r] for r in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap_bottom:
        bm.faces.new(list(reversed(vs[0])))
    if cap_top:
        bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def _finish(o, level=2):
    sub = o.modifiers.new('Soft', 'SUBSURF')
    sub.levels = sub.render_levels = level
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier=sub.name)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def _cushion(name, size, loc, mat, bevel):
    """A soft padded slab (pockets, the base): a bevelled box, subdivided."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    b = o.modifiers.new('Round', 'BEVEL')
    b.width, b.segments, b.limit_method = bevel, 3, 'NONE'
    bpy.ops.object.modifier_apply(modifier=b.name)
    o.data.materials.append(mat)
    return _finish(o, 2)


def _tube(name, pts, radius, mat, ribbon=0.0, tilt=0.0):
    """A round tube, or a flat padded ribbon (`ribbon` = half its width)
    through the points, smooth (auto-handled Bezier)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth, cu.bevel_resolution = radius, 3
    cu.extrude = ribbon
    cu.resolution_u = 8
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
        bp.tilt = tilt
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def _strap(name, pts, out_fn, half_w, half_t, mat, samples=48, taper=None):
    """A padded strap: a rounded-rectangle section swept along a smooth path
    (Catmull-Rom through `pts`), its flat face turned toward out_fn(point) —
    so it lies flat against the bag or the floor like real webbing. `taper`
    (u0, u1) narrows it from padding to thin webbing between those fractions
    of its length."""
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]

    def cr(i, t):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        t2, t3 = t * t, t * t * t
        return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    path = []
    segs = len(pts) - 1
    for k in range(samples + 1):
        u = k / samples * segs
        i = min(int(u), segs - 1)
        path.append(cr(i + 1, u - i))
    # Cross-section: a flat oval (rounded rectangle), 12 points.
    sec = []
    for j in range(12):
        a = 2 * math.pi * j / 12
        c, sn = math.cos(a), math.sin(a)
        sec.append((math.copysign(abs(c) ** 0.45, c) * half_w, math.copysign(abs(sn) ** 0.9, sn) * half_t))
    bm = bmesh.new()
    rings = []
    for k, p in enumerate(path):
        t = (path[min(k + 1, len(path) - 1)] - path[max(k - 1, 0)]).normalized()
        n = Vector(out_fn(p))
        n = (n - t * n.dot(t)).normalized()
        b = t.cross(n).normalized()
        sw = st = 1.0
        if taper:
            f = min(1.0, max(0.0, (k / samples - taper[0]) / (taper[1] - taper[0])))
            f = f * f * (3 - 2 * f)
            sw, st = 1 - 0.55 * f, 1 - 0.7 * f
        rings.append([bm.verts.new(p + b * x * sw + n * y * st) for x, y in sec])
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(12):
            bm.faces.new((r0[j], r0[(j + 1) % 12], r1[(j + 1) % 12], r1[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return _finish(o, 1)


def build_backpack(name='Backpack', height=0.72, strap_side=(1, 1)):
    fabric = _mat('Backpack fabric', '#efede8', 0.92, glow=0.08)
    panel = _mat('Backpack panel', '#e3e0d8', 0.92, glow=0.06)
    base_m = _mat('Backpack base', '#3a3c41', 0.85)
    trim = _mat('Backpack trim', '#202226', 0.6)
    strap_m = _mat('Backpack strap', '#1e1f23', 0.8)
    zip_m = _mat('Backpack zip', '#c9c6be', 0.6, glow=0.05)

    # Body: rings up the height, finer near the base and over the dome.
    zs = [0.0, 0.015, 0.04] + [0.08 + 0.52 * i / 10 for i in range(11)] + \
         [0.6 + 0.4 * (1 - math.cos(math.pi / 2 * i / 10)) for i in range(1, 11)]
    rings = [_ring(min(z, 0.995), 40) for z in zs]
    # Round the base edge in: the bottom two rings tuck under.
    rings[0] = [(x * 0.82, y * 0.9, z) for x, y, z in rings[0]]
    rings[1] = [(x * 0.95, y * 0.97, z) for x, y, z in rings[1]]
    parts = [_finish(_loft(f'{name} body', rings, [fabric]), 1)]

    # A darker base, wrapping the bottom.
    parts.append(_cushion(f'{name} base', (2 * D * 1.02, 2 * W * 0.98, 0.05), (0, 0, 0.022), base_m, 0.022))
    # Front pocket: a soft rounded panel standing proud of the front.
    fx = half_depth(0.3)
    parts.append(_cushion(f'{name} pocket', (0.11, W * 1.5, 0.38), (fx + 0.02, 0, 0.27), fabric, 0.05))
    # Flat stretch side pockets, sewn flush to both sides.
    for s in (-1, 1):
        parts.append(_cushion(f'{name} side pocket {s}', (2 * D * 0.86, 0.035, 0.24),
                              (0.0, s * (half_width(0.15) + 0.004), 0.15), panel, 0.014))
        parts.append(_tube(f'{name} side band {s}', [(-D * 0.8, s * (half_width(0.27) + 0.02), 0.27),
                                                     (0, s * (half_width(0.27) + 0.024), 0.265),
                                                     (D * 0.8, s * (half_width(0.27) + 0.02), 0.27)],
                           0.007, trim))

    # Piping along the side seams (front and back gusset edges), base to top.
    for xs in (1, -1):
        pts = []
        for i in range(-12, 13):
            th = math.pi / 2 * i / 12
            z = 0.06 + (0.93 - 0.06) * math.cos(th) if abs(i) < 12 else 0.06
            zc = min(z, 0.96)
            y = math.copysign(half_width(zc) * 0.995, th) if i else 0.0
            x = xs * half_depth(zc) * 0.62
            pts.append((x, y, zc))
        parts.append(_tube(f'{name} piping {xs}', pts, 0.006, panel))

    # Main zip over the dome on the front side, with two pulls.
    zp = []
    for i in range(-10, 11):
        z = 0.5 + 0.47 * math.cos(math.pi / 2 * i / 10)
        y = math.copysign(half_width(min(z, 0.97)) * 0.98, i) if i else 0.0
        zp.append((half_depth(min(z, 0.97)) * 0.42 + 0.012, y, min(z, 0.975)))
    parts.append(_tube(f'{name} zip', zp, 0.0065, zip_m))  # tape matching the fabric; the pulls are dark
    for yp in (-0.08, 0.09):
        parts.append(_cushion(f'{name} pull {yp}', (0.012, 0.024, 0.07), (half_depth(0.9) * 0.5 + 0.03, yp, 0.92),
                              trim, 0.005))
    # Pocket zip across its top, with a pull.
    parts.append(_tube(f'{name} pocket zip', [(fx + 0.078, -W * 0.7, 0.44), (fx + 0.082, 0, 0.445),
                                              (fx + 0.078, W * 0.7, 0.44)], 0.0055, zip_m))
    parts.append(_cushion(f'{name} pocket pull', (0.012, 0.022, 0.065), (fx + 0.088, W * 0.45, 0.41), trim, 0.005))
    # Grab loop on top, toward the back.
    parts.append(_tube(f'{name} loop', [(-0.07, -0.06, 0.985), (-0.08, -0.04, 1.05), (-0.085, 0.0, 1.075),
                                        (-0.08, 0.04, 1.05), (-0.07, 0.06, 0.985)], 0.012, trim, ribbon=0.008))

    # Shoulder straps, not worn: from the top of the back they fall over the
    # bag's shoulders, slump down its sides and spill a loose loop onto the
    # floor, then return to the bottom corners. Flat padded ribbons.
    bx = -half_depth(0.9)
    for s in (-1, 1):
        k = strap_side[0 if s < 0 else 1]
        top = (bx - 0.005, s * 0.11, 0.9)
        pts = [top,
               (bx - 0.03, s * (half_width(0.78) + 0.01), 0.76),
               (bx * 0.4, s * (half_width(0.5) + 0.05), 0.45),
               (bx * 0.1 + 0.03 * k, s * (half_width(0.2) + 0.17 * k), 0.12),
               (bx * 0.3, s * (half_width(0.1) + 0.24 * k), 0.025),
               (bx * 0.85, s * (half_width(0.1) + 0.12 * k), 0.02),
               (bx * 1.02, s * (W * 0.75), 0.06)]
        parts.append(_tube(f'{name} strap {s}', pts, 0.014, strap_m, ribbon=0.03, tilt=s * 0.4))
    # The padded back panel the straps hang from.
    parts.append(_cushion(f'{name} back panel', (0.03, W * 1.45, 0.62), (bx - 0.004, 0, 0.5), panel, 0.012))

    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    for v in o.data.vertices:
        v.co *= height
    return o


SOURCE = None  # set by the caller: path to the Meshy backpack GLB


def _contact_shadow(name, H):
    """A soft dark decal on the floor under the bag (an ellipse fading out,
    darkest under the base), so it sits on the floor with some weight: the
    scenes' shadow maps are too coarse to darken where it touches."""
    import numpy as np
    n = 128
    if name not in bpy.data.images:
        u = (np.arange(n) + 0.5) / n * 2 - 1
        xx, yy = np.meshgrid(u, u)
        r = np.sqrt(xx ** 2 + yy ** 2)
        a = np.clip(1 - r, 0, 1) ** 1.6 * 0.7 + np.clip(1 - r / 0.6, 0, 1) ** 2 * 0.25
        img = bpy.data.images.new(name, n, n, alpha=True)
        px = np.zeros((n, n, 4), dtype=np.float32)
        px[..., 3] = np.clip(a, 0, 1)
        img.pixels[:] = px.ravel()
        img.pack()
    img = bpy.data.images[name]
    m = bpy.data.materials.new('Contact shadow')
    m.use_nodes = True
    nt = m.node_tree
    b = next(n_ for n_ in nt.nodes if n_.type == 'BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value = 1.0
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = img
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    if hasattr(m, 'surface_render_method'):
        m.surface_render_method = 'BLENDED'
    else:
        m.blend_method = 'BLEND'
    # Under the body and its front pocket (x -0.17..0.46 H, |y| < 0.36 H).
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.145 * H, 0.0, 0.003))
    o = bpy.context.object
    o.name = name
    o.scale = (0.63 * H, 0.72 * H, 1)
    o.data.materials.append(m)
    return o


def build_real_backpack(source, name='Backpack', height=0.72, strap_side=(1, 1), lean=0.0, slump=0.0,
                        wall_x=None, wall_top=None, show_side=0, slump_axis=(-1.0, 0.0), contact=True,
                        straps=True):
    """The most realistic version: the Meshy AI backpack's sculpted body
    (CC BY 4.0; seams, piping, padded panels and stitching are real geometry)
    with its problems removed and re-dressed:
    - its worn-shape shoulder straps (everything behind the back panel) are
      cut away and replaced by slack padded straps that slump to the floor;
    - its UV-seam splits welded, then decimated to half (about 70k
      triangles) and smooth-shaded, so the fabric folds survive unbroken;
    - its colour texture keeps the stitching but its baked dirt/creases are
      lifted, the normal/metal maps dropped, and the fabric gets a matte
      roughness with a soft sheen (glTF KHR_materials_sheen), like canvas.
    `lean` (degrees) is the tip the caller will give it toward -X, so the
    straps' ends still land on the floor. `slump` (m) bends a soft bag against
    a wall behind it instead: the base stays flat on the floor, the body sags
    back progressively with height, and anything past `wall_x` (local) is
    pressed flat against the wall, as a padded bag squashes where it leans. Front +X, width along Y, up +Z,
    base at z = 0. `contact` lays a soft contact-shadow decal under it (its
    material, 'Contact shadow', must not cast shadows in the scene). `straps`
    False leaves the shoulder straps and buckles off (the page draws them,
    worn)."""
    import numpy as np
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    new = [o for o in bpy.context.scene.objects if o not in before]
    o = next(x for x in new if x.type == 'MESH')
    for x in new:
        if x is not o:
            bpy.data.objects.remove(x, do_unlink=True)
    o.parent = None
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Cut the worn straps: faces behind the back panel (source front is -Y).
    bm = bmesh.new()
    bm.from_mesh(o.data)
    cut = [f for f in bm.faces if f.calc_center_median().y > 0.185]
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # Weld the vertices Meshy splits along every UV seam: otherwise the
    # decimation pulls the two sides apart and the shading cracks there.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(o.data)
    bm.free()
    dec = o.modifiers.new('Lighter', 'DECIMATE')
    dec.ratio = 0.5
    dec.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=dec.name)
    zs = [v.co.z for v in o.data.vertices]
    z0, h = min(zs), max(zs) - min(zs)
    k = height / h
    for v in o.data.vertices:  # base to 0, scale, front (-Y) to +X
        x, y, z = v.co
        v.co = Vector((-y * k, x * k, (z - z0) * k))
    # Set down, the grab handle lies forward on the top instead of standing
    # up: the sculpted loop (rising to 1.0 H from the back rim, which tops out
    # at 0.94 H, |y| < 0.07 H) is cut away above the rim and a soft flat one
    # is laid over the rim and forward on the top (folding the original tore
    # its thin faces; cutting lower took the rim with it, leaving torn flaps).
    bm = bmesh.new()
    bm.from_mesh(o.data)
    cut = [f for f in bm.faces
           if f.calc_center_median().z > 0.95 * height and abs(f.calc_center_median().y) < 0.08 * height
           and f.calc_center_median().x < 0.01 * height]
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    # Cutting the worn straps also took the back panel's back face, leaving its
    # top (behind the dome's crest, above 0.82 H) a thin single sheet with a
    # zigzag edge that showed as torn flaps: cut it away. The bag's back
    # always faces the desk or seat, and the straps' roots cover the edge.
    bm = bmesh.new()
    bm.from_mesh(o.data)
    cut = [f for f in bm.faces
           if f.calc_center_median().z > 0.82 * height and f.calc_center_median().x < -0.035 * height]
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    # Then trim the fringe along the top's open edges: triangles hanging by
    # one edge (two or more of theirs open), a few passes.
    for _ in range(4):
        ears = [f for f in bm.faces if f.calc_center_median().z > 0.7 * height
                and sum(e.is_boundary for e in f.edges) >= 2]
        if not ears:
            break
        bmesh.ops.delete(bm, geom=ears, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    # Cutting the worn straps also took the back panel's back face, so its top
    # (0.94 H, up to 1.0 H at the handle's roots) stood above the dome (0.885
    # H) as a thin, ragged sheet: press it down onto the top, easing in from
    # the crest backward.
    cap = 0.885 * height
    for v in o.data.vertices:
        if v.co.z > cap:
            # Fully over the handle's roots (|y| < 0.085 H), easing in from
            # the crest backward elsewhere.
            w = 1.0 if abs(v.co.y) < 0.085 * height and v.co.x < 0.02 * height else \
                min(1.0, max(0.0, -v.co.x / (0.04 * height)))
            v.co.z = cap + (v.co.z - cap) * (1 - 0.97 * w)
        # Its thin top edge also stood out behind the dome: tuck it in.
        if v.co.z > 0.76 * height:
            t = min(1.0, (v.co.z / height - 0.76) / 0.1)
            x_min = height * (-0.1 + 0.06 * t * t * (3 - 2 * t))
            if v.co.x < x_min:
                v.co.x = x_min + (v.co.x - x_min) * 0.1
    for p in o.data.polygons:
        p.use_smooth = True
    # Material: lifted texture, matte with sheen.
    m = o.data.materials[0]
    m.name = 'Backpack fabric'
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for nm in ('Metallic', 'Roughness', 'Normal'):
        for l in list(b.inputs[nm].links):
            nt.links.remove(l)
    b.inputs['Metallic'].default_value = 0.0
    b.inputs['Roughness'].default_value = 0.78
    for key in ('Sheen Weight', 'Sheen'):
        if key in b.inputs:
            b.inputs[key].default_value = 0.6
            break
    if 'Sheen Roughness' in b.inputs:
        b.inputs['Sheen Roughness'].default_value = 0.5
    tex = b.inputs['Base Color'].links[0].from_node
    img = tex.image
    if img.size[0] > 1024:
        img.scale(1024, 1024)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    rgb = px[:, :3]
    lum = rgb @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
    cream = np.array([0.86, 0.84, 0.79], dtype=np.float32)
    # Keep a fifth of the texture's shading (stitches, seams) and lift the
    # rest, everywhere: the dark gutters between UV islands bled into the
    # seams as thin dark lines at a distance (mipmaps).
    rgb[:] = cream * (0.82 + 0.18 * np.clip(lum / 0.8, 0, 1.15))[:, None]
    px[:, :3] = rgb
    img.pixels[:] = px.ravel()
    img.pack()
    nt.links.new(tex.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.08
    o.name = f'{name} body'

    # Shoulder straps, set down: both run flat down the back panel from their
    # roots at the top centre to the bottom corners where they are sewn on,
    # padded (0.12 H wide, 0.024 H thick, as on a real pack) and narrowing to
    # webbing for the last stretch. Leaning back-first, the bag rests on them:
    # its back stands off the wall by their thickness, so from the side they
    # show as a dark padded edge between bag and wall, and the camera side's
    # slack spills out of the bottom corner onto the floor in a short crumple
    # and back in. (A strap slipped round the side face read as staged.)
    # Charcoal, not black: against the cream body a near-black strap read as
    # a line drawn on it. A soft sheen, like nylon webbing.
    strap_m = _mat('Backpack strap', '#4a4b52', 0.82)
    sb = next(n for n in strap_m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for key in ('Sheen Weight', 'Sheen'):
        if key in sb.inputs:
            sb.inputs[key].default_value = 0.35
            break
    metal = _mat('Backpack buckle', '#5c5d63', 0.45)
    parts = [o]
    H = height
    tl = math.radians(lean)
    handle_m = _mat('Backpack handle', '#d6d2c8', 0.85, glow=0.06)
    # From the back edge, forward along the top.
    handle = [(x * H, y * H, z * H) for x, y, z in (
        (-0.085, -0.05, 0.897), (-0.045, -0.05, 0.899), (0.0, -0.046, 0.897), (0.05, -0.036, 0.892),
        (0.08, 0.0, 0.888), (0.05, 0.036, 0.892), (0.0, 0.046, 0.897), (-0.045, 0.05, 0.899),
        (-0.085, 0.05, 0.897))]

    def floor_z(x):
        """Local z (in H) that lands on the floor once tipped by `lean`."""
        return (0.012 - x * math.sin(tl)) / math.cos(tl)

    parts.append(_strap(f'{name} handle', handle, lambda p: (0, 0, 1), 0.016 * H, 0.004 * H, handle_m, 24))

    SW, ST = 0.06, 0.012  # padded half width and half thickness (H)
    ax, ay = slump_axis
    limit = None if wall_x is None else -wall_x  # the wall's reach along the axis

    def sag(p):
        """The slump below, applied to a strap's path: its centre line stops
        half a strap short of the wall, so the strap keeps its thickness."""
        x, y, z = p
        if slump:
            d = slump * max(0.0, z / H) ** 1.7
            x, y = x + ax * d, y + ay * d
            if limit is not None and (wall_top is None or z < wall_top):
                over = x * ax + y * ay - (limit - ST * H)
                if over > 0:
                    x, y = x - ax * over, y - ay * over
        return (x, y, z)

    # The back panel's surface (x in H) by height, measured on the body.
    BACK = ((0.1, -0.1), (0.2, -0.1), (0.3, -0.079), (0.4, -0.062), (0.5, -0.05), (0.6, -0.041),
            (0.7, -0.037), (0.8, -0.029), (0.86, -0.04))

    def back_x(z):
        if z <= BACK[0][0]:
            return BACK[0][1]
        for (z0, x0), (z1, x1) in zip(BACK, BACK[1:]):
            if z <= z1:
                return x0 + (x1 - x0) * (z - z0) / (z1 - z0)
        return BACK[-1][1]

    for s in ((-1, 1) if straps else ()):
        P = lambda x, y, z: sag((x * H, s * y * H, z * H))  # noqa: E731
        F = lambda x, y: P(x, y, floor_z(x) + 0.004)  # noqa: E731
        B = lambda y, z: P(back_x(z) - ST - 0.004, y, z)  # noqa: E731  (on the back panel)
        shown = s == show_side
        down = [B(0.07, 0.84), B(0.1, 0.72), B(0.14, 0.58), B(0.18, 0.44), B(0.215, 0.3), B(0.245, 0.18)]
        if shown:
            pts = down + [P(-0.115, 0.29, 0.07), F(-0.06, 0.36), F(0.02, 0.395), F(0.065, 0.36), F(0.01, 0.325),
                          P(-0.06, 0.29, 0.03), P(-0.095, 0.255, 0.07)]
            taper = (0.36, 0.46)
        else:
            pts = down + [P(-0.115, 0.27, 0.08), P(-0.095, 0.25, 0.07)]
            taper = (0.62, 0.75)

        def out(p):
            # Flat against the back panel, then up once it lies on the floor.
            w = min(1.0, max(0.0, (p.z / H - floor_z(p.x / H) - 0.015) / 0.05))
            return tuple(Vector((-ax, -ay, 0.0)) * w + Vector((0, 0, 1)) * (1 - w))
        parts.append(_strap(f'{name} strap {s}', pts, out, SW * H, ST * H, strap_m, 64, taper))
        # The ladder-lock buckle where the padding ends and the webbing starts.
        bxp = B(0.205, 0.33)
        bpy.ops.mesh.primitive_cube_add(size=1, location=bxp)
        bk = bpy.context.object
        bk.scale = (0.012 * H, 0.06 * H, 0.03 * H)
        bk.rotation_euler = (math.atan2(0.04, 0.14) * -s, 0.0, 0.0)
        bk.data.materials.append(metal)
        parts.append(bk)
    if contact:
        parts.append(_contact_shadow(f'{name} contact shadow', H))
    bpy.ops.object.select_all(action='DESELECT')
    for p_ in parts:
        p_.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    # The import leaves quaternion rotation; callers set rotation_euler.
    o.rotation_mode = 'XYZ'
    if slump:
        # Sag toward slump_axis (a unit direction in the XY plane: (-1, 0) is
        # back, (0, 1) the +Y side); `wall_x` is the wall's distance along it
        # (negative: on the far side). The straps were placed already sagged
        # (sag()); the body stops a strap's thickness short of the wall, so
        # it rests on them, and is pressed flat where it would pass.
        skip = {o.data.materials.find('Backpack strap'), o.data.materials.find('Backpack buckle')}
        fixed = {i for p_ in o.data.polygons if p_.material_index in skip for i in p_.vertices}
        body_limit = None if limit is None else limit - 2 * ST * H - 0.002
        for i, v in enumerate(o.data.vertices):
            if i in fixed:
                continue
            t = max(0.0, v.co.z / H)
            d = slump * t ** 1.7
            v.co.x += ax * d
            v.co.y += ay * d
            if body_limit is not None and (wall_top is None or v.co.z < wall_top):
                reach = v.co.x * ax + v.co.y * ay  # how far along the axis
                if reach > body_limit:
                    push = (reach - body_limit) * 0.96
                    v.co.x -= ax * push
                    v.co.y -= ay * push
    return o


# The back panel's surface (x, in H) by height, measured on the v2 bag's
# middle (backpack-v2/source.glb, normalised: front +X, base 0, height 1).
BACK_V2 = ((0.05, -0.07), (0.15, -0.077), (0.25, -0.075), (0.35, -0.067), (0.5, -0.068), (0.65, -0.065),
           (0.8, -0.063), (0.85, -0.072), (0.9, -0.103), (0.95, -0.11))


def _interp(table, z):
    if z <= table[0][0]:
        return table[0][1]
    for (z0, x0), (z1, x1) in zip(table, table[1:]):
        if z <= z1:
            return x0 + (x1 - x0) * (z - z0) / (z1 - z0)
    return table[-1][1]


def build_v2_backpack(source, name='Backpack', height=0.72, lean=0.0, slump=0.0, wall_x=None, wall_top=None,
                      show_side=0, slump_axis=(-1.0, 0.0), contact=True, straps=True, faces=45000):
    """His white backpack, set down, in the design he wears (2026-10-15): Meshy's
    "minimal white backpack" (backpack-v2/source.glb: closed back panel, a grab
    loop, white padded shoulder straps ending in black webbing through a black
    ladder-lock buckle; the same bag Meshy put on him for the worn one,
    jongwoo-v2/worn_backpack.py). Its straps are modelled worn, arched out
    behind it: they are cut away (everything a few centimetres behind the back
    panel) and replaced by slack ones in the same design, running down the
    back panel from their roots at the top to the bottom corners: white
    padding, the black buckle, black webbing; on the `show_side` the slack
    spills out of the corner onto the floor. `lean`, `slump`, `wall_x`,
    `wall_top`, `slump_axis`, `contact` as build_real_backpack. Front +X,
    width along Y, up +Z, base at z = 0."""
    import numpy as np
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    new = [o for o in bpy.context.scene.objects if o not in before]
    o = next(x for x in new if x.type == 'MESH')
    for x in new:
        if x is not o:
            bpy.data.objects.remove(x, do_unlink=True)
    o.parent = None
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    zs = [v.co.z for v in o.data.vertices]
    z0, h = min(zs), max(zs) - min(zs)
    k = height / h
    H = height
    for v in o.data.vertices:  # base to 0, scale, front (-Y) to +X
        x, y, z = v.co
        v.co = Vector((-y * k, x * k, (z - z0) * k))
    # Cut its worn straps: faces more than 3 cm (in H) behind the back panel.
    bm = bmesh.new()
    bm.from_mesh(o.data)
    def worn_strap(f):
        c = f.calc_center_median()
        back = _interp(BACK_V2, c.z / H) * H
        # Arched out behind it.
        # (The dome closes by 0.9 H: above it beside the loop, only roots.)
        # Their roots' stubs over the top's back edge, beside the grab loop
        # (|y| under 0.066 H, kept): a tangle of white tabs once the rest was
        # gone, and the new straps' starts over them made it worse.
        if c.z > 0.83 * H and 0.066 * H < abs(c.y) < 0.27 * H and c.x < -0.02 * H:
            return True
        # Slivers of them left
        # facing into the back panel showed through as dark flecks.
        if c.x < back + 0.005 * H and f.normal.x > 0.3 and 0.1 * H < c.z < 0.83 * H:
            return True
        return c.x < back - 0.03 * H
    cut = [f for f in bm.faces if worn_strap(f)]
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6 * H)
    # Specks the cut left (bits of strap hanging by nothing).
    bm.faces.ensure_lookup_table()
    seen, isl = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, comp = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            comp.append(g)
            for e in g.edges:
                for q in e.link_faces:
                    if q.index not in seen:
                        seen.add(q.index)
                        stack.append(q)
        isl.append(comp)
    isl.sort(key=len, reverse=True)
    bmesh.ops.delete(bm, geom=[f for c in isl[1:] if len(c) < 2000 for f in c], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # The cut left pinholes in the back panel where the straps came close:
    # small holes are filled.
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=80)
    bm.to_mesh(o.data)
    bm.free()
    dec = o.modifiers.new('Lighter', 'DECIMATE')
    dec.ratio = min(1.0, faces / max(1, len(o.data.polygons)))
    dec.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for p in o.data.polygons:
        p.use_smooth = True
    # Material: its own colour, matte (Meshy's metal and roughness guesses
    # glint), a soft sheen like canvas.
    m = o.data.materials[0]
    m.name = 'Backpack fabric'
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for nm in ('Metallic', 'Roughness'):
        for l in list(b.inputs[nm].links):
            nt.links.remove(l)
    b.inputs['Metallic'].default_value = 0.0
    b.inputs['Roughness'].default_value = 0.8
    for key in ('Sheen Weight', 'Sheen'):
        if key in b.inputs:
            b.inputs[key].default_value = 0.5
            break
    tex = b.inputs['Base Color'].links[0].from_node
    if tex.image.size[0] > 1024:  # (small on screen)
        tex.image.scale(1024, 1024)
    o.name = f'{name} body'

    # The slack straps, in its design: white padding from the root, the black
    # ladder-lock buckle a third of the way up, black webbing on down.
    pad_m = _mat('Backpack strap pad', '#ecebe6', 0.85)
    web_m = _mat('Backpack webbing', '#1d1e22', 0.7)
    for key in ('Sheen Weight', 'Sheen'):
        bw = next(n for n in web_m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        if key in bw.inputs:
            bw.inputs[key].default_value = 0.4
            break
    buckle_m = _mat('Backpack buckle', '#24252a', 0.45)
    parts = [o]
    tl = math.radians(lean)

    def floor_z(x):
        return (0.012 - x * math.sin(tl)) / math.cos(tl)

    SW, ST = 0.066, 0.016  # padding's half width and half thickness (H)
    WW, WT = 0.03, 0.004  # webbing's
    ax, ay = slump_axis
    limit = None if wall_x is None else -wall_x

    def sag(p):
        x, y, z = p
        if slump:
            d = slump * max(0.0, z / H) ** 1.7
            x, y = x + ax * d, y + ay * d
            if limit is not None and (wall_top is None or z < wall_top):
                over = x * ax + y * ay - (limit - ST * H)
                if over > 0:
                    x, y = x - ax * over, y - ay * over
        return (x, y, z)

    for s in ((-1, 1) if straps else ()):
        P = lambda x, y, z: sag((x * H, s * y * H, z * H))  # noqa: E731
        F = lambda x, y: P(x, y, floor_z(x) + 0.004)  # noqa: E731
        B = lambda y, z, t=ST: P(_interp(BACK_V2, z) - t - 0.004, y, z)  # noqa: E731
        pad = [B(0.12, 0.85), B(0.13, 0.81), B(0.14, 0.76), B(0.175, 0.66), B(0.2, 0.52), B(0.215, 0.4), B(0.225, 0.33)]
        web = [B(0.225, 0.33, WT), B(0.235, 0.24, WT), B(0.245, 0.15, WT)]
        if s == show_side:
            web += [P(-0.11, 0.27, 0.07), F(-0.06, 0.33), F(0.02, 0.365), F(0.06, 0.33), F(0.01, 0.3),
                    P(-0.06, 0.28, 0.03), P(-0.09, 0.26, 0.07)]
        else:
            web += [P(-0.1, 0.26, 0.08), P(-0.085, 0.25, 0.06)]

        def out(p):
            w = min(1.0, max(0.0, (p.z / H - floor_z(p.x / H) - 0.015) / 0.05))
            return tuple(Vector((-ax, -ay, 0.0)) * w + Vector((0, 0, 1)) * (1 - w))
        parts.append(_strap(f'{name} strap {s}', pad, out, SW * H, ST * H, pad_m, 48))
        parts.append(_strap(f'{name} webbing {s}', web, out, WW * H, WT * H, web_m, 48))
        bpy.ops.mesh.primitive_cube_add(size=1, location=B(0.225, 0.33, 0.006))
        bk = bpy.context.object
        bk.scale = (0.012 * H, 0.075 * H, 0.032 * H)
        bk.data.materials.append(buckle_m)
        parts.append(bk)
    if contact:
        parts.append(_contact_shadow(f'{name} contact shadow', H))
    bpy.ops.object.select_all(action='DESELECT')
    for p_ in parts:
        p_.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.rotation_mode = 'XYZ'
    if slump:
        skip = {o.data.materials.find(n) for n in ('Backpack strap pad', 'Backpack webbing', 'Backpack buckle')}
        fixed = {i for p_ in o.data.polygons if p_.material_index in skip for i in p_.vertices}
        body_limit = None if limit is None else limit - 2 * ST * H - 0.002
        for i, v in enumerate(o.data.vertices):
            if i in fixed:
                continue
            t = max(0.0, v.co.z / H)
            d = slump * t ** 1.7
            v.co.x += ax * d
            v.co.y += ay * d
            if body_limit is not None and (wall_top is None or v.co.z < wall_top):
                reach = v.co.x * ax + v.co.y * ay
                if reach > body_limit:
                    push = (reach - body_limit) * 0.96
                    v.co.x -= ax * push
                    v.co.y -= ay * push
    return o
