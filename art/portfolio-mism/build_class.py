"""Chapter 3's classroom for /portfolio/7 (BYU, the MISM, 2024-2025).
Run: Blender -b --factory-startup --python art/portfolio-mism/build_class.py
Writes public/models/portfolio-mism/class.glb.

A case-discussion room in the business school, after the user's photo
(2026-10-15): four tiers of curved maple desks in a horseshoe round the front
floor, each desk a continuous curved top over a maple modesty panel with a dark
reveal under its lip; grey shell chairs on chrome sleds; stairs at the tiers'
ends; a walkway along the back. The front wall: two pull-down projection
screens either side of a whiteboard (the slides are projected live in
MismScene.tsx), black speakers, a maple lectern by the right-hand screen, two
projectors hung from the ceiling. Beige walls with a maple rail and rows of
grey and tan fabric acoustic panels; a white grid ceiling with flat LED
panels and diffusers; a striped grey carpet. His seat (third row, left of the
middle): his laptop (the screen and keys drawn live), his blue tumbler, his
white backpack on the floor beside him.
Layout numbers mirror src/portfolio/room/mism.ts. Three.js axes in the
comments (+X to the front wall, +Z to a seated student's right); Blender's are
(x, -z, y).
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/portfolio-mism/class.glb'
sys.path.insert(0, str(ROOT / 'art/portfolio-room'))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# Mirrors src/portfolio/room/mism.ts.
TIERS, PITCH, RISE, R0, SPAN, SEAT_W = 4, 1.7, 0.4, 4.2, 1.15, 1.0
FRONT_X, BACK_X, HALF_W, CEIL = 4.9, -11.0, 10.6, 4.9
DESK_TOP, DESK_IN, DESK_D, SEAT_TOP = 0.72, 0.36, 0.75, 0.37
RS = [R0 + PITCH * k for k in range(TIERS)]
HERO_ROW, HERO_K = 2, 7
SCREENS = [(-3.75, 2.55, 4.0, 2.5), (3.75, 2.55, 4.0, 2.5)]  # z, centre y, w, h
LECTERN = (FRONT_X - 1.5, 0.0, 1.9)


def tier_y(k):
    return RISE * k


def seats():
    out = []
    for row in range(TIERS):
        r = RS[row]
        n = int((2 * SPAN * r) // SEAT_W)
        for k in range(n):
            a = -SPAN + (k + 0.5) * 2 * SPAN / n
            out.append((row, k, -r * math.cos(a), tier_y(row), r * math.sin(a), a))
    return out


def B(x, y, z):
    """three.js to Blender."""
    return Vector((x, -z, y))


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


_mats = {}


def material(name, hexcolor, rough=0.75, metal=0.0, emit=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*srgb(hexcolor), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = (*srgb(hexcolor), 1)
        p.inputs['Emission Strength'].default_value = emit
    _mats[name] = m
    return m


def box(name, size, pos, mat, radius=0.0, yaw=0.0, tilt=0.0):
    """A (rounded) box from three.js size (x, y, z) and centre; `yaw` about
    three's y, `tilt` about its z (top toward -x)."""
    sx, sy, sz = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=B(*pos))
    o = bpy.context.object
    o.name = name
    o.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius:
        b = o.modifiers.new('Rounded', 'BEVEL')
        b.width, b.segments, b.limit_method = radius, 3, 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=b.name)
    o.rotation_euler = (0.0, -tilt, yaw)
    o.data.materials.append(mat)
    return o


def cyl(name, r, h, pos, mat, verts=16, axis='y'):
    """A cylinder centred at pos (three.js), along three's y (or x / z)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=B(*pos))
    o = bpy.context.object
    o.name = name
    if axis == 'x':
        o.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'z':
        o.rotation_euler = (math.pi / 2, 0, 0)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def tube(name, pts, r, mat):
    """A round tube through three.js points."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth, cu.bevel_resolution = r, 2
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p_, q in zip(sp.points, pts):
        p_.co = (*B(*q), 1)
    o = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def arc_solid(name, r0, r1, a0, a1, y0, y1, mat, seg=96):
    """A solid annular sector round the horseshoe's centre: radii r0..r1,
    angles a0..a1 (from -X, toward +Z), heights y0..y1."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        c, s = math.cos(a), math.sin(a)
        rings.append([bm.verts.new(B(-r * c, y, r * s)) for r, y in ((r0, y0), (r0, y1), (r1, y1), (r1, y0))])
    for i in range(seg):
        A, Bq = rings[i], rings[i + 1]
        for j in range(4):
            bm.faces.new((A[j], A[(j + 1) % 4], Bq[(j + 1) % 4], Bq[j]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def world_uv(o, size=1.0):
    """UVs in metres / size, projected per face along its main axis."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        ax = max(range(3), key=lambda i: abs(f.normal[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        for lp in f.loops:
            co = o.matrix_world @ lp.vert.co
            lp[uv].uv = (co[a] / size, co[b] / size)
    bm.to_mesh(o.data)
    bm.free()
    return o


def textured(name, img, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = img
    nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = rough
    return m


def image(name, px):
    h, w = px.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = px
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    return img


rng = np.random.default_rng(3)


def carpet_tex():
    """The photo's carpet: mid grey with a fine tweed, and broken charcoal
    stripes running across it (2 m a tile)."""
    n = 512
    lin = lambda c: np.array(srgb(c), np.float32)  # noqa: E731
    base, dark, light = lin('#6a6d72'), lin('#383b40'), lin('#8a8d92')
    px = np.tile(base, (n, n, 1))
    px *= (0.9 + 0.2 * rng.random((n, n, 1))).astype(np.float32)
    for _ in range(26):
        y = rng.integers(0, n)
        x0 = rng.integers(0, n)
        L = rng.integers(60, 260)
        w = rng.integers(2, 5)
        col = dark if rng.random() < 0.7 else light
        xs = (np.arange(x0, x0 + L) % n)
        px[y:y + w, xs] = col * (0.92 + 0.12 * rng.random((min(w, n - y), L, 1)))
    return image('Carpet', px)


def ceiling_tex():
    """2 x 4 ft tiles in a white T-bar grid, each a touch different."""
    n = 256
    lin = lambda c: np.array(srgb(c), np.float32)  # noqa: E731
    px = np.tile(lin('#efeeea'), (n, n, 1))
    px *= (0.96 + 0.05 * rng.random((n, n, 1))).astype(np.float32)
    grid = lin('#d9d8d3')
    px[:3, :] = grid
    px[:, :3] = grid
    px[n // 2 - 1:n // 2 + 2, :] = grid
    return image('Ceiling tiles', px)


# Palette, after the photo.
maple = material('Maple', '#d8b98d', 0.5)
maple_end = material('Maple edge', '#c9a676', 0.5)
reveal = material('Desk reveal', '#3b3329', 0.7)
plaster = material('Wall', '#dccfb5', 0.9)
grey_panel = material('Panel grey', '#9d9f9b', 0.95)
tan_panel = material('Panel tan', '#cfc1a2', 0.95)
shell = material('Chair shell', '#a7aaae', 0.55)
chrome = material('Chrome', '#cfd2d6', 0.25, metal=1.0)
screen_m = material('Screen', '#f2f3f5', 0.85)
casing = material('Screen casing', '#2e3034', 0.5)
board = material('Whiteboard', '#f7f7f4', 0.25)
alu = material('Aluminium', '#c4c7cb', 0.35, metal=0.6)
black = material('Black', '#1d1e21', 0.5)
led = material('LED panel', '#ffffff', 0.4, emit=2.2)
diffuser = material('Diffuser', '#e2e2de', 0.6)
projector_m = material('Projector', '#ececea', 0.45)
door_m = material('Door', '#c49a68', 0.55)
red = material('Fire alarm', '#b8282b', 0.5)
exit_m = material('Exit sign', '#3fbf6f', 0.4, emit=1.5)
carpet = textured('Carpet', carpet_tex(), 0.95)
ceiling_m = textured('Ceiling', ceiling_tex(), 0.9)

# ------------------------------------------------------------------ floor
floor = box('Floor', (FRONT_X - BACK_X, 0.02, 2 * HALF_W), ((FRONT_X + BACK_X) / 2, -0.01, 0.0), carpet)

# ------------------------------------------------------------------ tiers
# Each tier a solid sector from just in front of its desks out far, cut at
# the back and side walls; the higher tier covers the lower (their tops show
# only where not covered). Beyond the desks' ends they run on to the side
# walls as landings, half steps between them: the tiers' stairs.
def desk_front(k):
    return RS[k] - DESK_IN - DESK_D


ARC = 1.52  # the tiers' half angle (to nearly square with the side walls)
for k in range(1, TIERS):
    t = arc_solid(f'Tier {k}', desk_front(k) - 0.06, 16.0, -ARC, ARC, 0.0, tier_y(k), carpet, seg=128)
    bm = bmesh.new()
    bm.from_mesh(t.data)
    for co, no in ((B(BACK_X, 0, 0), B(1, 0, 0) - B(0, 0, 0)),
                   (B(0, 0, HALF_W), B(0, 0, -1) - B(0, 0, 0)),
                   (B(0, 0, -HALF_W), B(0, 0, 1) - B(0, 0, 0))):
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co,
                                     plane_no=no, clear_outer=False, clear_inner=True)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges)
    bm.to_mesh(t.data)
    bm.free()
    world_uv(t, 2.0)
    # The half steps up to it at both ends, beyond the desks.
    for side in (-1, 1):
        a0, a1 = sorted((side * (SPAN + 0.1), side * (SPAN + 0.34)))
        st = arc_solid(f'Step {k} {side}', desk_front(k) - 0.06 - 0.42, desk_front(k) - 0.06, a0, a1,
                       0.0, tier_y(k) - RISE / 2, carpet, seg=12)
        world_uv(st, 2.0)
world_uv(floor, 2.0)

# ------------------------------------------------------------------ desks
# A continuous curved maple top per row, its front edge rounded over a dark
# reveal, the modesty panel down to the tier's floor; maple end panels.
for k in range(TIERS):
    y = tier_y(k)
    r_in, r_out = desk_front(k), RS[k] - DESK_IN
    arc_solid(f'Desk top {k}', r_in, r_out, -SPAN, SPAN, y + DESK_TOP - 0.035, y + DESK_TOP, maple, seg=160)
    arc_solid(f'Desk lip {k}', r_in - 0.015, r_in + 0.02, -SPAN, SPAN, y + DESK_TOP - 0.05, y + DESK_TOP - 0.035,
              maple_end, seg=160)
    arc_solid(f'Desk reveal {k}', r_in + 0.02, r_in + 0.05, -SPAN, SPAN, y + DESK_TOP - 0.1, y + DESK_TOP - 0.035,
              reveal, seg=160)
    arc_solid(f'Modesty {k}', r_in + 0.02, r_in + 0.05, -SPAN, SPAN, y, y + DESK_TOP - 0.1, maple, seg=160)
    for side in (-1, 1):
        a = side * SPAN
        a0, a1 = sorted((a, a - side * 0.006))
        arc_solid(f'Desk end {k} {side}', r_in, r_out, a0, a1, y, y + DESK_TOP - 0.035, maple_end, seg=1)

# ------------------------------------------------------------------ chairs
def chair(name, x, y, z, yaw):
    """A grey plastic shell chair on a chrome sled (seat top SEAT_TOP), facing
    +X turned by yaw, at (x, y, z)."""
    parts = []
    st = SEAT_TOP
    seat = box(f'{name} seat', (0.56, 0.05, 0.58), (0.02, st - 0.025, 0), shell, radius=0.03)
    back = box(f'{name} back', (0.05, 0.5, 0.56), (-0.3, st + 0.33, 0), shell, radius=0.025,
               tilt=math.radians(12))
    parts += [seat, back]
    for s in (-1, 1):
        parts.append(tube(f'{name} sled {s}', [(0.28, st - 0.06, 0.25 * s), (0.3, 0.02, 0.27 * s),
                                               (-0.3, 0.02, 0.27 * s), (-0.28, st - 0.06, 0.25 * s),
                                               (-0.33, st + 0.12, 0.25 * s)], 0.012, chrome))
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.context.view_layer.objects.active = parts[0]
    for o in parts:
        o.select_set(True)
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.transform(Matrix.Rotation(yaw, 4, 'Z'))
    o.data.transform(Matrix.Translation(B(x, y, z)))
    return o


chair_proto = chair('Chair proto', 0, 0, 0, 0)
chairs = []
hero = None
for row, k, x, y, z, a in seats():
    jitter = (rng.random() - 0.5) * 0.12
    me = chair_proto.data.copy()
    o = bpy.data.objects.new(f'Chair {row} {k}', me)
    scene.collection.objects.link(o)
    me.transform(Matrix.Rotation(a + jitter * (0 if (row, k) == (HERO_ROW, HERO_K) else 1), 4, 'Z'))
    me.transform(Matrix.Translation(B(x, y, z)))
    chairs.append(o)
    if (row, k) == (HERO_ROW, HERO_K):
        hero = (x, y, z, a)
bpy.data.objects.remove(chair_proto, do_unlink=True)

# ------------------------------------------------------------------ his place
hx, hy, hz, ha = hero
fwd = Vector((math.cos(ha), 0, -math.sin(ha)))  # three.js
right = Vector((math.sin(ha), 0, math.cos(ha)))


def along(p, f, r, up=0.0):
    return (p[0] + fwd.x * f + right.x * r, p[1] + up, p[2] + fwd.z * f + right.z * r)


seat_pt = (hx, hy, hz)
root = along(seat_pt, -0.15, 0, -0.17)
desk_y = root[1] + 0.89
LAP_W, LAP_D, LAP_BASE = 0.525, 0.36, 0.02
hinge = along(root, 0.9, -0.09)
base_c = along(hinge, -LAP_D / 2, 0, 0)
lid_t = math.radians(14)
lid_c = along(hinge, math.sin(lid_t) * LAP_D / 2, 0)
box('Laptop base', (LAP_D, LAP_BASE, LAP_W), (base_c[0], desk_y + LAP_BASE / 2, base_c[2]), alu, radius=0.008,
    yaw=ha)
box('Laptop lid', (0.012, LAP_D, LAP_W), (lid_c[0], desk_y + LAP_BASE + math.cos(lid_t) * LAP_D / 2, lid_c[2]),
    alu, radius=0.006, yaw=ha, tilt=-lid_t)
from tumbler import build_tumbler  # noqa: E402
tp = along(root, 0.78, 0.42)
build_tumbler('Tumbler', B(tp[0], desk_y, tp[2]))
# His backpack on the floor at his right, against the next chair's side.
from backpack import build_v2_backpack  # noqa: E402
bag = build_v2_backpack(ROOT / 'art/portfolio-room/backpack-v2/source.glb', 'Backpack', height=0.7, slump=0.05,
                        show_side=1, contact=False)
bp = along(seat_pt, 0.05, 0.52)
bag.location = B(bp[0], hy, bp[2])
bag.rotation_euler = (0.0, 0.0, ha + math.pi / 2)  # its front to his right, its back to his chair

# ------------------------------------------------------------------ walls
WALL_T = 0.2
box('Back wall', (WALL_T, CEIL, 2 * HALF_W + 2 * WALL_T), (BACK_X - WALL_T / 2, CEIL / 2, 0), plaster)
box('Front wall', (WALL_T, CEIL, 2 * HALF_W + 2 * WALL_T), (FRONT_X + WALL_T / 2, CEIL / 2, 0), plaster)
for s in (-1, 1):
    box(f'Side wall {s}', (FRONT_X - BACK_X, CEIL, WALL_T), ((FRONT_X + BACK_X) / 2, CEIL / 2, s * (HALF_W + WALL_T / 2)),
        plaster)
back_y = tier_y(TIERS - 1)
# A maple rail round the back and sides (a metre over the back walkway).
rail_y = back_y + 1.0
box('Rail back', (0.04, 0.12, 2 * HALF_W), (BACK_X + 0.02, rail_y, 0), maple)
for s in (-1, 1):
    box(f'Rail side {s}', (FRONT_X - BACK_X - 0.4, 0.12, 0.04), ((FRONT_X + BACK_X) / 2, rail_y, s * (HALF_W - 0.02)),
        maple)
# Fabric acoustic panels in two rows, grey and tan in turn (as in the photo).
def panels(name, along_axis, fixed, a0, a1, y0, h, w=1.95, gap=0.12):
    n = int((a1 - a0 + gap) // (w + gap))
    start = (a0 + a1) / 2 - (n * (w + gap) - gap) / 2
    for i in range(n):
        c = start + i * (w + gap) + w / 2
        for row_ in range(2):
            mat = grey_panel if (i + row_) % 2 == 0 else tan_panel
            y = y0 + row_ * (h + gap) + h / 2
            if along_axis == 'z':
                box(f'{name} {i} {row_}', (0.05, h, w), (fixed, y, c), mat, radius=0.012)
            else:
                box(f'{name} {i} {row_}', (w, h, 0.05), (c, y, fixed), mat, radius=0.012)


panels('Panel back', 'z', BACK_X + 0.03, -HALF_W + 0.6, HALF_W - 0.6, rail_y + 0.25, 1.05)
for s in (-1, 1):
    panels(f'Panel side {s}', 'x', s * (HALF_W - 0.03), BACK_X + 0.6, -2.0, rail_y + 0.25, 1.05)
# A door near the front of the left wall, an exit sign over it; a fire alarm.
door_x = 0.5
box('Door frame', (1.25, 2.55, 0.06), (door_x, 1.275, -HALF_W + 0.03), alu)
box('Door', (1.1, 2.45, 0.05), (door_x, 1.225, -HALF_W + 0.05), door_m, radius=0.006)
box('Door handle', (0.18, 0.03, 0.04), (door_x + 0.38, 1.2, -HALF_W + 0.09), alu, radius=0.01)
box('Exit sign', (0.4, 0.18, 0.05), (door_x, 2.8, -HALF_W + 0.05), exit_m)
box('Fire alarm', (0.14, 0.2, 0.06), (door_x - 1.3, 1.85, -HALF_W + 0.05), red, radius=0.01)

# ------------------------------------------------------------------ front wall
# The whiteboard between the screens, its tray; the screens pulled down from
# casings under the ceiling (their fabric, the slides drawn on it live).
box('Whiteboard', (0.03, 1.5, 2.6), (FRONT_X - 0.02, 1.85, 0.0), board)
box('Whiteboard frame', (0.025, 1.56, 2.66), (FRONT_X - 0.008, 1.85, 0.0), alu)
box('Whiteboard tray', (0.07, 0.03, 2.4), (FRONT_X - 0.05, 1.08, 0.0), alu)
for i, (z, y, w, h) in enumerate(SCREENS):
    box(f'Screen {i}', (0.012, h + 0.3, w + 0.2), (FRONT_X - 0.06, y + 0.12, z), screen_m)
    box(f'Screen border {i}', (0.01, h + 0.36, w + 0.26), (FRONT_X - 0.05, y + 0.12, z), black)
    box(f'Screen casing {i}', (0.16, 0.16, w + 0.5), (FRONT_X - 0.1, y + h / 2 + 0.38, z), casing, radius=0.02)
    box(f'Screen bar {i}', (0.03, 0.03, w + 0.2), (FRONT_X - 0.06, y - h / 2 - 0.05, z), black)
for s in (-1, 1):
    box(f'Speaker {s}', (0.22, 0.4, 0.26), (FRONT_X - 0.13, 3.55, s * 6.6), black, radius=0.02)
# The lectern: maple, a sloped top, a monitor on it.
lx, ly, lz = LECTERN
box('Lectern', (0.62, 1.05, 0.95), (lx, 0.525, lz), maple, radius=0.01)
box('Lectern top', (0.7, 0.04, 1.03), (lx - 0.02, 1.08, lz), maple_end, radius=0.01, tilt=math.radians(-8))
box('Lectern monitor', (0.04, 0.32, 0.48), (lx + 0.12, 1.35, lz), black, radius=0.01, tilt=math.radians(10))

# ------------------------------------------------------------------ ceiling
box('Ceiling', (FRONT_X - BACK_X, 0.04, 2 * HALF_W), ((FRONT_X + BACK_X) / 2, CEIL + 0.02, 0), ceiling_m)
world_uv(bpy.data.objects['Ceiling'], 1.6)
for x in np.arange(BACK_X + 1.6, FRONT_X - 0.8, 2.6):
    for z in np.arange(-HALF_W + 1.8, HALF_W - 1.0, 3.2):
        box('LED panel', (1.2, 0.03, 0.6), (x, CEIL - 0.005, z), led)
for x, z in ((-6.0, -6.0), (-6.0, 6.0), (-1.0, 0.0), (2.5, -7.0), (2.5, 7.0)):
    box('Diffuser', (0.6, 0.02, 0.6), (x, CEIL - 0.01, z), diffuser)
# The projectors, hung over the front floor, aimed at the screens.
for i, (z, y, w, h) in enumerate(SCREENS):
    px_, py_ = -0.8, CEIL - 0.55
    box(f'Projector {i}', (0.42, 0.14, 0.36), (px_, py_, z * 0.55), projector_m, radius=0.02)
    cyl(f'Projector lens {i}', 0.04, 0.03, (px_ + 0.22, py_, z * 0.55), black, axis='x')
    cyl(f'Projector pole {i}', 0.025, CEIL - py_ - 0.07, (px_, (CEIL + py_) / 2, z * 0.55), alu)

# ------------------------------------------------------------------ export
for o in scene.objects:
    if o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = p.use_smooth or False
bpy.ops.object.select_all(action='DESELECT')
meshes = [o for o in scene.objects if o.type == 'MESH']
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
bpy.context.object.name = 'Classroom'
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_yup=True, export_apply=True,
                          export_lights=False, export_cameras=False, export_image_format='WEBP',
                          export_image_quality=85, export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6)
print('MISM_DONE', OUT.stat().st_size, 'seats', len(chairs))
