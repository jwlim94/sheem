"""Bridge's office for /portfolio/7, chapter 4 (Lehi, May 2025 -), after the
user's floor plan (2026-11-22). Run:
Blender -b --factory-startup --python art/portfolio-bridge/build_bridge.py
Writes public/models/portfolio-bridge/bridge.glb (Draco-compressed).

- A square room off two corridors. Glass from floor to ceiling onto the
  corridor on its north and west sides, three big panes a side in black
  aluminium frames (the user's call: it had been eight), a frosted band at
  eye height; the door in the west glass toward its south end, standing
  open into the room; a white cabinet against the glass north of it. Its south and east walls painted concrete grey, the
  whiteboard on the east (its writing is live, BridgeScene.tsx).
- Five desks, white tops on grey steel legs: three along the north glass
  (the left one kept free, a monitor on it, off; the developer's double
  monitors and laptop in the middle; the COO's laptop and monitor on the
  right), two along the south wall (his, set out live on the page; the
  CEO's east of it). The developer's: a low riser at its back, a wooden top
  on black legs as wide as the desk, the monitor on it, the laptop on its
  stand at its left (his double screen), a keyboard and a mouse. The COO's
  and the CEO's: only their laptops (drawn live on the page: the COO's
  financial statements, the CEO's mail), a keyboard and a trackpad. The desks stand against the walls and everyone faces
  theirs: the north row the glass, the south row the concrete (the user's
  correction). Black task chairs (the Neighbor office's:
  art/portfolio-office/build_office.py).
- Carpet tiles; ceiling tiles with LED panels. (No plant: the user's
  call.)
- Past the glass, the corridors (downlights), their far side: a white
  wall with wooden doors to the west; to the north the frosted glass of
  another company's office, lit, and a corridor running on north.
Glass is exported as its own objects ('Bridge glass', 'Bridge frosted');
the page makes them transparent. The door's leaf too ('Bridge door' and its
glass and frosted band): the flight's window leaves it out. Layout numbers mirror
src/portfolio/room/bridge.ts (three.js axes, at the hero's 1.38x scale).
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/portfolio-bridge/bridge.glb'

# Mirrors src/portfolio/room/bridge.ts.
HX, HZ, H = 4.4, 4.4, 3.8
CORR = 2.6
DESK_W, DESK_D, DESK_TOP = 2.0, 1.04, 1.0
# The places: desk middle x, which way its sitter faces (-1: -z, the north
# row at the glass; 1: +z, the south row at the wall), whose.
PLACES = [(-2.65, -1, 'free'), (0.0, -1, 'developer'), (2.65, -1, 'coo'), (0.59, 1, 'him'), (3.23, 1, 'ceo')]
# From the room's middle along z: a desk's middle (0.08 off its wall), its
# chair's (the sitter 0.57 behind the desk's front edge, the chair 0.12
# behind him).
DESK_Z = HZ - 0.08 - DESK_D / 2
CHAIR_Z = DESK_Z - DESK_D / 2 - 0.57 - 0.12
BOARD = dict(x=HX - 0.045, y0=1.2, y1=2.75, z0=-1.33, z1=1.33)
DOOR = dict(z0=1.0, z1=2.3, h=2.9)
CABINET = dict(z0=-0.73, z1=0.73, d=0.62, h=1.45)
PROP = 1.3  # chairs: 1.3x real, for the 1.38x hero
SEAT_H = 0.56
T = 0.15  # wall thickness

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


materials = {}


def material(name, hexcolor, rough=0.75, emit=0.0, metal=0.0):
    key = (name, hexcolor, emit)
    if key in materials:
        return materials[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*srgb(hexcolor), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = (*srgb(hexcolor), 1)
        p.inputs['Emission Strength'].default_value = emit
    materials[key] = m
    return m


def textured(name, rgb, rough=0.8, emit=0.0):
    """A material from an (n, n, 3) array (rows from the top), packed."""
    n0, n1 = rgb.shape[:2]
    rgba = np.concatenate([rgb.clip(0, 1), np.ones((n0, n1, 1))], -1)[::-1].astype(np.float32)
    img = bpy.data.images.new(f'{name} tex', n1, n0)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
    t = m.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = img
    m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if emit:
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = emit
    b.inputs['Roughness'].default_value = rough
    return m


def smooth(o):
    for poly in o.data.polygons:
        poly.use_smooth = True
    return o


def box(name, size, pos, color='#ffffff', rough=0.75, radius=0.0, mat=None, tilt_z=0.0, yaw=0.0, tilt_x=0.0):
    """A (rounded) box from three.js size (x, y, z) and centre (x, y, z)."""
    sx, sy, sz = size
    x, y, z = pos
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    o = bpy.context.object
    o.name = name
    o.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius:
        b = o.modifiers.new('Rounded', 'BEVEL')
        b.width, b.segments, b.limit_method = radius, 3, 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=b.name)
    smooth(o)
    o.rotation_mode = 'XYZ'
    o.rotation_euler = (tilt_x, -tilt_z, yaw)
    o.data.materials.append(mat or material(name, color, rough))
    return o


def cyl(name, r, y0, y1, x, z, mat, verts=24):
    """A vertical cylinder (three.js axes) from y0 to y1."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=y1 - y0, location=(x, -z, (y0 + y1) / 2))
    o = smooth(bpy.context.object)
    o.name = name
    o.data.materials.append(mat)
    return o


def tube(name, pts, radius, mat, res=3):
    """A tube through three.js points."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth, cu.bevel_resolution = radius, res
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p_, (x, y, z) in zip(sp.points, pts):
        p_.co = (x, -z, y, 1)
    o = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = smooth(bpy.context.object)
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def soft(name, size, pos, mat, radius, level=2, **kw):
    """A padded volume: a bevelled box smoothed by subdivision."""
    o = box(name, size, pos, mat=mat, radius=radius, **kw)
    sub = o.modifiers.new('Soft', 'SUBSURF')
    sub.levels = sub.render_levels = level
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=sub.name)
    return smooth(o)


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


def band_uv(o):
    """UVs for a frosted band: v from its bottom (0) to its top (1), u along
    it in metres, so the page's pinstripes run along it."""
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    z0, z1 = min(zs), max(zs)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for lp in f.loops:
            co = o.matrix_world @ lp.vert.co
            lp[uv].uv = (co.x + co.y, (co.z - z0) / max(1e-6, z1 - z0))
    bm.to_mesh(o.data)
    bm.free()
    return o


def group(objs, name, location=(0, 0, 0), yaw=0.0, scale=1.0):
    """Joins parts built at the origin and places them (three.js x, y, z, yaw)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    # Each part's own turn into its mesh first: the joined object keeps the
    # first part's, which the yaw below then replaced (2026-11-22: the
    # developer's laptop, its first part the tilted stand plate, came out
    # untilted and 0.35 back, under his riser).
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    x, y, z = location
    o.rotation_euler = (0, 0, yaw)
    o.scale = (scale,) * 3
    o.location = (x, -z, y)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


rng = np.random.default_rng(7)

rng = np.random.default_rng(7)


def carpet_tex():
    """Carpet tiles, 0.66 m, laid quarter-turned: a fine loop-pile rib,
    charcoal blue-grey with a faint heather (one 1.32 m tile)."""
    n = 512
    yy, xx = np.mgrid[0:n, 0:n] / n * 1.32
    tx, ty = np.floor(xx / 0.66), np.floor(yy / 0.66)
    turned = (tx + ty) % 2
    rib = np.where(turned > 0, np.sin(xx * 2 * np.pi / 0.011), np.sin(yy * 2 * np.pi / 0.011))
    heather = rng.normal(0, 1, (n, n)) * 0.03 + np.kron(rng.normal(0, 1, (32, 32)), np.ones((16, 16))) * 0.015
    dx, dy = xx % 0.66, yy % 0.66
    seam = np.clip(1 - np.minimum(np.minimum(dx, 0.66 - dx), np.minimum(dy, 0.66 - dy)) / 0.002, 0, 1)
    v = 0.36 + 0.025 * rib + heather - 0.05 * seam + 0.012 * (turned - 0.5)
    return np.stack([v * 0.96, v * 1.0, v * 1.09], -1)


def ceiling_tex():
    """Acoustic ceiling tiles (0.8 m) in a grey T-bar grid, each tile a touch
    different, their faces pitted with fine fissures and speckle, a soft
    shadow along the bars (2026-10-15: the user found the ceiling too smooth
    to be real: the grid and fissures were too faint to read)."""
    n = 1024
    yy, xx = np.mgrid[0:n, 0:n] / n * 1.6
    dx, dy = xx % 0.8, yy % 0.8
    edge = np.minimum(np.minimum(dx, 0.8 - dx), np.minimum(dy, 0.8 - dy))
    bar = edge < 0.011
    tile = np.floor(xx / 0.8) + 2 * np.floor(yy / 0.8)
    per = np.array([0.0, 0.012, -0.01, 0.006])[tile.astype(int) % 4]
    fiss = (rng.random((n, n)) < 0.08) * -np.abs(rng.normal(0, 0.09, (n, n)))
    blot = np.kron(rng.normal(0, 1, (64, 64)), np.ones((16, 16))) * 0.008
    v = 0.9 + per + fiss + blot - 0.025 * (rng.random((n, n)) < 0.25) - 0.05 * np.clip(1 - (edge - 0.011) / 0.02, 0, 1)
    rgb = np.stack([v, v * 0.995, v * 0.98], -1)
    rgb[bar] = [0.78, 0.79, 0.8]
    return rgb


def wall_tex():
    """Painted drywall (1.5 m): faint orange-peel speckle, roller marks
    running down it, broad soft mottling; warm off-white, not pure white
    (2026-10-15: the walls read flat and too white from afar)."""
    n = 512
    peel = rng.normal(0, 1, (n, n)) * 0.012
    roll = np.repeat(rng.normal(0, 1, (1, n // 4)), 4, axis=1) * 0.008
    blot = np.kron(rng.normal(0, 1, (16, 16)), np.ones((32, 32)))
    # (soften the blotches)
    for _ in range(2):
        blot = (blot + np.roll(blot, 8, 0) + np.roll(blot, -8, 0) + np.roll(blot, 8, 1) + np.roll(blot, -8, 1)) / 5
    v = 0.885 + peel + roll + blot * 0.012
    return np.stack([v, v * 0.99, v * 0.965], -1)


def keys_tex():
    """A Magic Keyboard-style top (the room's: silver deck, white keys in
    its layout, function row at the back, the top of the image), for the
    open office's keyboards (drawn, not modelled: there are many)."""
    U = 32  # px a key unit
    rows = [(0.5, [1.5] + [1] * 12 + [1]), (1, [1] * 13 + [1.5]), (1, [1.5] + [1] * 12 + [1]),
            (1, [1.75] + [1] * 11 + [1.75]), (1, [2.25] + [1] * 10 + [2.25]),
            (1, [1, 1, 1, 1.25, 5, 1.25, 1, 1, 1, 1])]
    w, h = int(15.3 * U), int(6.3 * U)
    img = np.ones((h, w, 3)) * np.array([0.78, 0.785, 0.795])
    y = int(0.4 * U)
    for depth, widths in rows:
        x = int(0.4 * U)
        for kw in widths:
            x0, x1, y0, y1 = x + 2, int(x + kw * U) - 2, y + 2, int(y + depth * U) - 2
            img[y0:y1, x0:x1] = [0.965, 0.965, 0.955]
            img[y1 - 2:y1, x0:x1] = [0.88, 0.88, 0.875]  # a little shade at each key's front
            x = int(x + kw * U)
        y = int(y + depth * U)
    return img



# ----------------------------------------------------------- office chairs
mesh_n = 256
yy_, xx_ = np.mgrid[0:mesh_n, 0:mesh_n]
weave = (np.sin(xx_ * np.pi / 3) * np.sin(yy_ * np.pi / 3) > 0.2).astype(float)
mesh_back = textured('Chair mesh', np.stack([0.16 + 0.09 * weave, 0.17 + 0.09 * weave, 0.19 + 0.09 * weave], -1), 0.85)


def back_panel(sh, nu=12, nv=10):
    """The chair's back: a mesh panel leaning back a little, its sides
    wrapping forward around the sitter, its top a touch narrower; and the
    ring of points around its edge (for its frame)."""
    bm = bmesh.new()
    grid = []
    for j in range(nv + 1):
        t = j / nv
        y = sh + 0.19 + 0.5 * t
        row = []
        for i in range(nu + 1):
            zz = (-0.23 + 0.46 * i / nu) * (1 - 0.12 * t ** 2)
            # Leaning back; the small of the back pushed forward (lumbar);
            # the sides wrapping round.
            xx = -0.29 - (y - sh - 0.19) * 0.2 + 0.03 * math.sin(math.pi * min(1, t * 1.6)) + 0.9 * zz * zz
            row.append((xx, y, zz))
        grid.append(row)
    vs = [[bm.verts.new((x_, -z_, y_)) for (x_, y_, z_) in row] for row in grid]
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    me = bpy.data.meshes.new('Back mesh')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('Back mesh', me)
    scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    so = o.modifiers.new('Thick', 'SOLIDIFY')
    so.thickness = 0.012
    bpy.ops.object.modifier_apply(modifier=so.name)
    smooth(o)
    world_uv(o, 0.25)
    o.data.materials.append(mesh_back)
    ring = grid[0] + [r[-1] for r in grid[1:]] + grid[-1][::-1][1:] + [r[0] for r in grid[::-1][1:]]
    ring = [(x_ - 0.006, y_, z_) for (x_, y_, z_) in ring]
    return o, ring + [ring[0]]


def chair(name, x, z, yaw, far=False, seat=SEAT_H):
    """A task chair, built facing +x at real size, each part joined to the
    next: a five-star base on casters (each on a stem from its leg), the gas
    lift in its shroud, the tilt mechanism under a seat pan and padded seat;
    a spine from the mechanism back and up behind the curved mesh back in
    its frame; T-arms on L-brackets from under the seat. Then scaled by PROP
    so its seat is at SEAT_H. (2026-10-13: the first one's back, spine and
    arms floated apart, and the user found it ugly.) Far: lighter (the open
    office's, seen through the glass), no wheels, coarser curves."""
    sh = seat / PROP
    res = 0 if far else 2
    parts = [cyl('Hub', 0.055, 0.075, 0.14, 0, 0, black_plastic)]
    for k in range(5):
        a = k * 2 * math.pi / 5 + 0.3
        ca, sa = math.cos(a), math.sin(a)
        ex, ez = ca * 0.31, sa * 0.31
        parts.append(tube('Star leg', [(ca * 0.04, 0.115, sa * 0.04), (ex * 0.6, 0.1, ez * 0.6), (ex, 0.085, ez)],
                          0.02, black_plastic, res))
        if far:
            parts.append(box('Caster', (0.05, 0.07, 0.05), (ex, 0.035, ez), mat=black_plastic, yaw=a))
            continue
        parts.append(cyl('Caster stem', 0.01, 0.055, 0.09, ex, ez, alu, 10))
        parts.append(box('Caster', (0.055, 0.03, 0.05), (ex, 0.05, ez), radius=0.01, mat=black_plastic, yaw=a))
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.029, depth=0.046, location=(ex, -ez, 0.029),
                                            rotation=(math.pi / 2, 0, a + math.pi / 2))
        w = smooth(bpy.context.object)
        w.data.materials.append(black_plastic)
        parts.append(w)
    parts.append(cyl('Lift shroud', 0.036, 0.13, 0.27, 0, 0, black_plastic))
    parts.append(cyl('Gas lift', 0.023, 0.26, sh - 0.1, 0, 0, alu))
    parts.append(box('Mechanism', (0.24, 0.06, 0.22), (0, sh - 0.1, 0), radius=0.012, mat=black_plastic))
    parts.append(box('Seat pan', (0.46, 0.024, 0.46), (0.01, sh - 0.064, 0), radius=0.01, mat=black_plastic))
    parts.append(soft('Seat', (0.5, 0.075, 0.49), (0.02, sh - 0.02, 0), fabric, 0.032, 1 if far else 2))
    # The spine: out of the mechanism's back, round and up behind the back.
    parts.append(tube('Spine', [(-0.06, sh - 0.1, 0), (-0.2, sh - 0.1, 0), (-0.28, sh - 0.03, 0),
                                (-0.3, sh + 0.19, 0), (-0.32, sh + 0.4, 0)], 0.022, black_plastic, res))
    back, ring = back_panel(sh, *((6, 5) if far else (12, 10)))
    parts.append(back)
    parts.append(tube('Back frame', ring, 0.014, black_plastic, 0 if far else 1))
    for s_ in (-1, 1):
        parts.append(tube('Arm bracket', [(-0.03, sh - 0.085, s_ * 0.08), (-0.03, sh - 0.085, s_ * 0.255),
                                          (-0.03, sh - 0.045, s_ * 0.272), (-0.03, sh + 0.175, s_ * 0.272)],
                          0.017, black_plastic, res))
        parts.append(box('Arm pad', (0.25, 0.03, 0.075), (0.0, sh + 0.19, s_ * 0.272), radius=0.012, mat=black_plastic))
    return group(parts, name, (x, 0, z), yaw, PROP)



def mac_keyboard(x, z, fx, fz, pad):
    """The room's keyboard (a silver deck, its keys drawn on its top) at
    (x, z), for someone facing (fx, fz), its function row toward the
    monitor; and, if `pad`, a white trackpad at its right. (On the desk
    top's surface, 1.0 m up.)"""
    ang = math.atan2(-fx, -fz)  # Blender: local +x to their right, +y ahead
    base = box('Keyboard', (KB_W, 0.008, KB_D), (x, 1.004, z), mat=kb_silver)
    base.rotation_euler = (0, 0, ang)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, -z, 1.0115))  # 3.5 mm over the deck (0.5 mm flickered)
    top = bpy.context.object
    top.scale = (KB_W - 0.012, KB_D - 0.012, 1)
    top.rotation_euler = (0, 0, ang)
    top.data.materials.append(mac_keys)
    if pad:
        rx, rz = -fz, fx  # their right (three.js)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x + rx * 0.45, -(z + rz * 0.45), 1.006))
        p_ = bpy.context.object
        p_.scale = (0.2, 0.24, 0.012)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bev = p_.modifiers.new('Round', 'BEVEL')
        bev.width, bev.segments, bev.limit_method = 0.016, 4, 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=bev.name)
        p_.rotation_euler = (0, 0, ang)
        p_.data.materials.append(trackpad_mat)



def image_material(name, path, rough=0.3, emit=0.0):
    """A material from an image file (packed into the GLB)."""
    img = bpy.data.images.load(str(path))
    img.pack()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
    t = m.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = img
    m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if emit:
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = emit
    b.inputs['Roughness'].default_value = rough
    return m



def screen_plane(cx, cy, cz, nx, nz, w, h, tile):
    """A screen's face (three.js centre, facing (nx, 0, nz)), showing atlas
    tile `tile` (0..7), or dark glass if None."""
    rx, rz = nz, -nx  # the viewer's right
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    bm = bmesh.new()
    vs = [bm.verts.new((cx + rx * a * w / 2, -(cz + rz * a * w / 2), cy + b * h / 2)) for a, b in corners]
    f = bm.faces.new(vs)
    if tile is not None:
        uv = bm.loops.layers.uv.verify()
        u0, v0 = (tile % 4) / 4, 0.5 if tile < 4 else 0.0
        for lp, (a, b) in zip(f.loops, corners):
            lp[uv].uv = (u0 + (a + 1) / 2 * 0.25, v0 + (b + 1) / 2 * 0.5)
    me = bpy.data.meshes.new('Screen')
    bm.to_mesh(me)
    bm.free()
    if me.uv_layers:  # the name the joined mesh keeps (another was dropped)
        me.uv_layers[0].name = 'UVMap'
    o = bpy.data.objects.new('Screen', me)
    scene.collection.objects.link(o)
    o.data.materials.append(screens_mat if tile is not None else screen_dark)
    return o


def monitor(mx, mz, nx, nz, on=True, tile=None, lift=0.0):
    """A desk monitor on a stand, its screen facing (nx, nz): a thin black
    body, a neck behind it down to a flat foot on the desk (2026-10-15: they
    had stood on a post plugged into the desk), its screen lit with one of
    the work screens, or off (`on`)."""
    along_z = abs(nx) > abs(nz)
    body = (0.025, 0.38, 0.62) if along_z else (0.62, 0.38, 0.025)
    box('Monitor', body, (mx, 1.36 + lift, mz), radius=0.004, mat=monitor_mat)
    if tile is None:
        tile = int(bench_rng.integers(0, 8))
    # (6 mm proud of the body's face: 1 mm, far off, the two flickered.)
    screen_plane(mx + nx * 0.0185, 1.36 + lift, mz + nz * 0.0185, nx, nz, 0.58, 0.34,
                 tile if on else None)
    neck = (0.03, 0.3, 0.06) if along_z else (0.06, 0.3, 0.03)
    box('Monitor neck', neck, (mx - nx * 0.035, 1.15 + lift, mz - nz * 0.035), mat=stand_mat)
    foot = (0.18, 0.012, 0.22) if along_z else (0.22, 0.012, 0.18)
    box('Monitor foot', foot, (mx - nx * 0.03, 1.006 + lift, mz - nz * 0.03), radius=0.004, mat=stand_mat)




def concrete_tex():
    """Concrete-grey paint over block (2 m): a soft broad mottle, a fine
    speckle, the faint lines of the blocks' joints under the paint; a cool
    light grey, a shade under white (the user's: concrete-coloured)."""
    n = 512
    yy, xx = np.mgrid[0:n, 0:n] / n * 2.0
    speck = rng.normal(0, 1, (n, n)) * 0.01
    blot = np.kron(rng.normal(0, 1, (16, 16)), np.ones((32, 32)))
    for _ in range(3):
        blot = (blot + np.roll(blot, 8, 0) + np.roll(blot, -8, 0) + np.roll(blot, 8, 1) + np.roll(blot, -8, 1)) / 5
    bx = (xx + 0.2 * (np.floor(yy / 0.25) % 2)) % 0.5
    by = yy % 0.25
    joint = np.clip(1 - np.minimum(np.minimum(bx, 0.5 - bx), np.minimum(by, 0.25 - by)) / 0.004, 0, 1)
    v = 0.71 + speck * 0.8 + blot * 0.011 - 0.016 * joint
    return np.stack([v * 0.985, v * 0.99, v], -1)


def quad(name, corners, mat, tile=None):
    """A flat quad through four three.js corners (bottom-left, bottom-right,
    top-right, top-left as seen from its front), showing atlas tile `tile`
    of the work screens (or plain)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, -z, y)) for (x, y, z) in corners]
    f = bm.faces.new(vs)
    if tile is not None:
        uv = bm.loops.layers.uv.verify()
        u0, v0 = (tile % 4) / 4, 0.5 if tile < 4 else 0.0
        for lp, (a, b) in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            lp[uv].uv = (u0 + a * 0.25, v0 + b * 0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if me.uv_layers:
        me.uv_layers[0].name = 'UVMap'
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


# ---------------------------------------------------------------- materials
alu = material('Aluminium', '#b8bcc1', 0.35, metal=0.6)
frame_mat = material('Glass frame', '#2a2d31', 0.4, metal=0.5)
black_plastic = material('Black plastic', '#202226', 0.45)
fabric = material('Chair fabric', '#3d424a', 0.95)
glass = material('Glass', '#dfe9ec', 0.05)
frosted = material('Frosted glass', '#f3f5f5', 0.6)
cove = material('Cove base', '#6b6f75', 0.6)
desk_top = material('Desk top', '#f4f4f2', 0.42)
desk_leg = material('Desk leg', '#8d9096', 0.38, metal=0.55)
monitor_mat = material('Monitor', '#18191c', 0.3)
stand_mat = material('Monitor stand', '#2a2d32', 0.4)
laptop_mat = material('Laptop', '#c5c7ca', 0.32, metal=0.55)
trackpad_mat = material('Trackpad', '#ecebe7', 0.32)
kb_silver = material('Keyboard silver', '#c7c8ca', 0.35)
KB_W, KB_D = 0.6, 0.247
cabinet_mat = material('Cabinet', '#efefed', 0.5)
handle_mat = material('Handle', '#9aa0a6', 0.35, metal=0.6)
door_wood = material('Corridor door', '#8a6b4e', 0.55)
riser_wood = material('Riser wood', '#b98a5a', 0.5)
mouse_mat = material('Mouse', '#2b2d31', 0.4)
led = material('LED panel', '#fbfbf8', 0.3, emit=4.0)
downlight = material('Downlight', '#fffaf0', 0.3, emit=5.0)
board_white = material('Board', '#f7f8f8', 0.25)
marker_mats = {c: material(f'Marker {c}', c, 0.45) for c in ('#25282e', '#1d4fb0', '#c8322c')}
eraser_mat = material('Eraser', '#2d3036', 0.7)
carpet = textured('Carpet', carpet_tex(), 0.97)
ceiling = textured('Ceiling tiles', ceiling_tex(), 0.95)
mac_keys = textured('Mac keys', keys_tex(), 0.45)
wall_white = textured('Corridor wall', wall_tex(), 0.9)
concrete = textured('Concrete wall', concrete_tex(), 0.88)
screens_mat = image_material('Office screens', ROOT / 'art/portfolio-office/screens.png', 0.3, 1.0)
screen_dark = material('Screen off', '#0b0c0e', 0.15)
laptop_keys = material('Laptop keys', '#17181b', 0.55)
trackpad_mat = material('Trackpad', '#b6b9be', 0.2, metal=0.35)
bench_rng = np.random.default_rng(31)

glass_objs, frosted_objs = [], []

# ------------------------------------------------------------ floor, ceiling
# One floor and one ceiling under the room and its corridors, and the
# corridors' far sides.
X0, X1 = -HX - CORR - T, HX + 7.0
Z0, Z1 = -HZ - CORR - 6.6, HZ + T
world_uv(box('Floor', (X1 - X0, 0.1, Z1 - Z0), ((X0 + X1) / 2, -0.05, (Z0 + Z1) / 2), mat=carpet), 1.32)
world_uv(box('Ceiling', (X1 - X0, 0.08, Z1 - Z0), ((X0 + X1) / 2, H + 0.04, (Z0 + Z1) / 2), mat=ceiling), 1.6)
# The room's LED panels, two rows of two; the corridors' downlights.
for x in (-HX / 2, HX / 2):
    for z in (-HZ / 2, HZ / 2):
        box(f'LED panel {x} {z}', (1.0, 0.03, 1.0), (x, H - 0.012, z), mat=led)
        box(f'LED trim {x} {z}', (1.04, 0.025, 1.04), (x, H - 0.006, z), mat=alu)
for k in range(8):
    cyl('Downlight', 0.13, H - 0.012, H, -HX - CORR / 2 + 2.4 * k, -HZ - CORR / 2, downlight, 20)
for k in range(4):
    cyl('Downlight', 0.13, H - 0.012, H, -HX - CORR / 2, -HZ + 2.4 * k + 0.6, downlight, 20)

# ----------------------------------------------------------- solid walls
# South and east: painted concrete grey, a dark cove base. The south wall
# runs on west to close the west corridor's end.
south = box('South wall', (HX + T - X0, H, T), ((X0 + HX + T) / 2, H / 2, HZ + T / 2), mat=concrete)
east = box('East wall', (T, H, 2 * HZ + 2 * T), (HX + T / 2, H / 2, 0), mat=concrete)
for o in (south, east):
    world_uv(o, 2.0)
box('South cove', (2 * HX, 0.1, 0.012), (0, 0.05, HZ - 0.006), mat=cove)
box('East cove', (0.012, 0.1, 2 * HZ), (HX - 0.006, 0.05, 0), mat=cove)
# Past the room to the east, the north corridor's south side: white.
world_uv(box('Corridor wall NE', (X1 - HX - T, H, T), ((HX + T + X1) / 2, H / 2, -HZ - T / 2), mat=wall_white), 1.5)

# ------------------------------------------------------------ the glass
# North and west: glass from floor to ceiling in black aluminium frames,
# a head track, a frosted band at eye height (so the glass reads); the door
# in the west glass, standing open into the room.
FT = 0.06  # a frame's face


def glass_run(name, a0, a1, axis, at, skip=None, panes=3):
    """Glass along x (axis 'x', at z) or z (axis 'z', at x), from a0 to a1,
    in `panes` big panes (shared out either side of `skip`, an (a0, a1)
    left open: the door)."""
    def place(a, y, w_along, h, thick):
        if axis == 'x':
            return (w_along, h, thick), (a, y, at)
        return (thick, h, w_along), (at, y, a)
    spans = [(a0, a1)] if skip is None else [(a0, skip[0]), (skip[1], a1)]
    total = sum(s1 - s0 for s0, s1 in spans)
    for s0, s1 in spans:
        n = max(1, round((s1 - s0) / total * panes))
        posts = [s0 + (s1 - s0) * k / n for k in range(n + 1)]
        for a in posts:
            size, pos = place(a, H / 2, FT, H, 0.1)
            box(f'{name} post', size, pos, mat=frame_mat)
        for k in range(n):
            m0, m1 = posts[k] + FT / 2, posts[k + 1] - FT / 2
            size, pos = place((m0 + m1) / 2, H / 2, m1 - m0, H, 0.012)
            glass_objs.append(box(f'{name} pane', size, pos, mat=glass))
            size, pos = place((m0 + m1) / 2, 1.52, m1 - m0, 0.13, 0.016)
            frosted_objs.append(box(f'{name} band', size, pos, mat=frosted))
    size, pos = place((a0 + a1) / 2, H - 0.05, a1 - a0, 0.1, 0.12)
    box(f'{name} head', size, pos, mat=frame_mat)
    size, pos = place((a0 + a1) / 2, 0.02, a1 - a0, 0.04, 0.1)
    box(f'{name} sill', size, pos, mat=frame_mat)


glass_run('North glass', -HX - 0.05, HX + 0.05, 'x', -HZ)
glass_run('West glass', -HZ, HZ, 'z', -HX, skip=(DOOR['z0'], DOOR['z1']))
# The door's frame (its posts, and the glass over it to the ceiling).
for z in (DOOR['z0'], DOOR['z1']):
    box('Door post', (0.1, H, FT + 0.02), (-HX, H / 2, z), mat=frame_mat)
box('Door head', (0.1, 0.08, DOOR['z1'] - DOOR['z0']), (-HX, DOOR['h'] + 0.04, (DOOR['z0'] + DOOR['z1']) / 2), mat=frame_mat)
glass_objs.append(box('Door transom', (0.012, H - DOOR['h'] - 0.08, DOOR['z1'] - DOOR['z0']),
                      (-HX, (DOOR['h'] + 0.08 + H) / 2, (DOOR['z0'] + DOOR['z1']) / 2), mat=glass))
# The leaf: glass in a thin frame, a long bar pull, hinged at the south post
# and swung open into the room (about 100 degrees).
LW = DOOR['z1'] - DOOR['z0'] - 0.04
leaf = []
for zz in (0.02, LW - 0.02):
    leaf.append(box('Leaf stile', (0.05, DOOR['h'] - 0.04, 0.04), (0, DOOR['h'] / 2, -zz), mat=frame_mat))
for yy in (0.04, DOOR['h'] - 0.06):
    leaf.append(box('Leaf rail', (0.05, 0.06, LW), (0, yy, -LW / 2), mat=frame_mat))
leaf_glass = box('Leaf glass', (0.012, DOOR['h'] - 0.12, LW - 0.06), (0, DOOR['h'] / 2, -LW / 2), mat=glass)
leaf_band = box('Leaf band', (0.016, 0.13, LW - 0.06), (0, 1.52, -LW / 2), mat=frosted)
leaf.append(box('Leaf pull', (0.03, 1.1, 0.03), (0.07, 1.25, -LW + 0.12), mat=alu))
door_leaf = group(leaf, 'Bridge door', (-HX + 0.02, 0, DOOR['z1'] - 0.02), -1.75)
# (Its own objects, 'Bridge door', 'Bridge door glass' and 'Bridge door
# frosted': his window in the flight shows the room without it, the user's
# call: seen edge on from there it read as a stray pole.)
leaf_glass.name, leaf_band.name = 'Bridge door glass', 'Bridge door frosted'
for o in (leaf_glass, leaf_band):
    # (Placed as group() places: about the world's origin, then moved.)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    o.rotation_euler = (0, 0, -1.75)
    o.location = (-HX + 0.02, -(DOOR['z1'] - 0.02), 0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# -------------------------------------------------------- the whiteboard
# On the east wall: a white board in an aluminium frame, its tray under it
# with markers and an eraser (its writing is drawn live).
bz0, bz1, by0, by1 = BOARD['z0'], BOARD['z1'], BOARD['y0'], BOARD['y1']
box('Board', (0.02, by1 - by0, bz1 - bz0), (HX - 0.035, (by0 + by1) / 2, 0), mat=board_white)
for y in (by0 - 0.012, by1 + 0.012):
    box('Board frame', (0.035, 0.026, bz1 - bz0 + 0.05), (HX - 0.04, y, 0), radius=0.004, mat=alu)
for z in (bz0 - 0.012, bz1 + 0.012):
    box('Board frame', (0.035, by1 - by0 + 0.05, 0.026), (HX - 0.04, (by0 + by1) / 2, z), radius=0.004, mat=alu)
box('Board tray', (0.09, 0.02, 1.0), (HX - 0.07, by0 - 0.05, -0.6), radius=0.005, mat=alu)
for k, c in enumerate(marker_mats):
    box('Marker', (0.025, 0.025, 0.17), (HX - 0.075, by0 - 0.027, -1.0 + k * 0.21), radius=0.008, mat=marker_mats[c])
box('Eraser', (0.06, 0.035, 0.16), (HX - 0.075, by0 - 0.02, -0.28), radius=0.006, mat=eraser_mat)

# ----------------------------------------------------------- the cabinet
# White, two doors, against the west glass north of the door; its back 0.1
# off the glass's line, clear of its posts and head (his window in the
# flight shows the room cut just inside them: hisOffice.ts OFFICE_CUT_X).
cz0, cz1, cd, ch = CABINET['z0'], CABINET['z1'], CABINET['d'], CABINET['h']
CAB = -HX + 0.1
box('Cabinet', (cd, ch, cz1 - cz0), (CAB + cd / 2, ch / 2, (cz0 + cz1) / 2), radius=0.008, mat=cabinet_mat)
box('Cabinet seam', (0.004, ch - 0.06, 0.006), (CAB + cd + 0.001, ch / 2, (cz0 + cz1) / 2), mat=cove)
for z in (-0.06, 0.06):
    box('Cabinet handle', (0.025, 0.28, 0.02), (CAB + cd + 0.015, ch * 0.62, (cz0 + cz1) / 2 + z), radius=0.006, mat=handle_mat)
box('Cabinet plinth', (cd - 0.04, 0.06, cz1 - cz0 - 0.04), (CAB + cd / 2, 0.03, (cz0 + cz1) / 2), mat=cove)

# --------------------------------------------------------------- the desks
LAP_W, LAP_D, LID_H = 0.43, 0.3, 0.29


def desk(x, z):
    """A desk: a white top on grey steel legs (two at each end, a rail
    under the top along each end, a beam along its back)."""
    box('Desk top', (DESK_W, 0.04, DESK_D), (x, DESK_TOP - 0.02, z), radius=0.006, mat=desk_top)
    for sx in (-1, 1):
        lx = x + sx * (DESK_W / 2 - 0.08)
        for sz in (-1, 1):
            box('Desk leg', (0.055, DESK_TOP - 0.04, 0.055), (lx, (DESK_TOP - 0.04) / 2, z + sz * (DESK_D / 2 - 0.07)), mat=desk_leg)
        box('Desk rail', (0.05, 0.05, DESK_D - 0.1), (lx, DESK_TOP - 0.065, z), mat=desk_leg)
    box('Desk beam', (DESK_W - 0.2, 0.06, 0.04), (x, DESK_TOP - 0.07, z), mat=desk_leg)


# A MacBook's deck (mirrors src/portfolio/room/macKeys.ts): its keyboard's
# rows (US layout) as widths in key pitches, back (the function row) to
# front, 14.5 a row; 'low' a half-height arrow, 'pair' the up arrow over the
# down. In the base's frame: x across, v toward its front from its middle.
PITCH, GAP, KB_V0, DECK_Y = 0.0258, 0.0036, -0.128, 0.008
KB_ROWS = [
    [1.5] + [1] * 13,
    [1] * 13 + [1.5],
    [1.5] + [1] * 13,
    [1.75] + [1] * 11 + [1.75],
    [2.25] + [1] * 10 + [2.25],
    [1, 1, 1, 1.25, 5, 1.25, 1, 'low', 'pair', 'low'],
]
PAD = dict(w=0.176, d=0.104, v=0.088)


def mac_caps():
    """Each key's cap: its middle (x, v) and size (w, d)."""
    kb_w = 14.5 * PITCH
    caps = []
    for r, row in enumerate(KB_ROWS):
        u = 0.0
        for k in row:
            wide = 1 if isinstance(k, str) else k
            x = -kb_w / 2 + (u + wide / 2) * PITCH
            v = KB_V0 + (r + 0.5) * PITCH
            w = wide * PITCH - GAP
            if isinstance(k, str):
                half = (PITCH - GAP) / 2 - GAP / 4
                caps.append((x, v + PITCH / 4 - GAP / 8, w, half))
                if k == 'pair':
                    caps.append((x, v - PITCH / 4 + GAP / 8, w, half))
            else:
                caps.append((x, v, w, PITCH - GAP))
            u += wide
    return caps


def laptop_on_stand(x, z, yaw, tile):
    """A laptop on an aluminium stand that lifts its back, built for a
    viewer at +z and turned by yaw: the stand's plate and its back support,
    the base tilted toward its user, the lid up, its screen one of the work
    screens (or off)."""
    tilt = 0.32
    parts = []
    parts.append(box('Stand plate', (0.3, 0.012, 0.27), (0, DESK_TOP + 0.075, 0.0), tilt_x=tilt, mat=alu))
    # (Under the base: taller, it showed through the deck behind the keys.)
    parts.append(box('Stand back', (0.26, 0.118, 0.014), (0, DESK_TOP + 0.059, -0.12), mat=alu))
    parts.append(box('Stand lip', (0.3, 0.02, 0.014), (0, DESK_TOP + 0.035, 0.125), mat=alu))
    cy, cz = DESK_TOP + 0.09, 0.0
    parts.append(box('Laptop base', (LAP_W, 0.016, LAP_D), (0, cy, cz), tilt_x=tilt, radius=0.004, mat=laptop_mat))

    def deck(u, v, h):
        """The base's frame (x across, v toward its front, h up from its
        middle) to three.js, the base tilted."""
        return (u, cy + h * math.cos(tilt) - v * math.sin(tilt), cz + h * math.sin(tilt) + v * math.cos(tilt))

    # Its keys, a hair out of the silver, and the trackpad.
    for kx, kv, kw, kd in mac_caps():
        parts.append(box('Laptop key', (kw, 0.0016, kd), deck(kx, kv, DECK_Y + 0.0004), tilt_x=tilt, mat=laptop_keys))
    parts.append(box('Trackpad', (PAD['w'], 0.0004, PAD['d']), deck(0, PAD['v'], DECK_Y + 0.0001), tilt_x=tilt, mat=trackpad_mat))
    # The hinge, at the base's back edge (raised by the tilt).
    hy, hz = cy + math.sin(tilt) * LAP_D / 2 + 0.008, cz - math.cos(tilt) * LAP_D / 2
    lean = 0.18  # the lid leans back from upright
    ly, lz = hy + math.cos(lean) * LID_H / 2, hz - math.sin(lean) * LID_H / 2
    parts.append(box('Laptop lid', (LAP_W, LID_H, 0.008), (0, ly, lz), tilt_x=-lean, radius=0.003, mat=laptop_mat))
    # Its screen, on the lid's front, in a black glass bezel.
    nx_, ny_, nz_ = 0.0, math.sin(lean), math.cos(lean)  # the lid's front normal
    up = (0.0, math.cos(lean), -math.sin(lean))

    def on_lid(w, h, off):
        c = (0.0, ly + ny_ * off, lz + nz_ * off)
        return [(sx * w / 2, c[1] + up[1] * sy * h / 2, c[2] + up[2] * sy * h / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]

    parts.append(quad('Laptop bezel', on_lid(LAP_W - 0.008, LID_H - 0.008, 0.0045), screen_dark))
    parts.append(quad('Laptop screen', on_lid(LAP_W - 0.03, LID_H - 0.035, 0.0055), screens_mat if tile is not None else screen_dark, tile))
    return group(parts, 'Laptop', (x, 0, z), yaw)


def screen_tile():
    return int(bench_rng.integers(0, 8))


RISER_H = 0.15  # about 11 cm


def riser(x, z):
    """A low monitor riser along a desk's back: a wooden top on four black
    legs, nearly the desk's width."""
    w, d = DESK_W - 0.12, 0.28
    box('Riser top', (w, 0.03, d), (x, DESK_TOP + RISER_H - 0.015, z), radius=0.004, mat=riser_wood)
    for sx in (-1, 1):
        for sz in (-1, 1):
            box('Riser leg', (0.03, RISER_H - 0.03, 0.03),
                (x + sx * (w / 2 - 0.05), DESK_TOP + (RISER_H - 0.03) / 2, z + sz * (d / 2 - 0.05)), mat=mouse_mat)


def mouse(x, z):
    """A mouse on the desk."""
    box('Mouse', (0.065, 0.03, 0.11), (x, DESK_TOP + 0.015, z), radius=0.012, mat=mouse_mat)


for px, face, who in PLACES:
    desk(px, face * DESK_Z)
    cz = face * CHAIR_Z
    if who == 'him':
        chair('His chair', px, cz, math.pi / 2 if face < 0 else -math.pi / 2, seat=SEAT_H + 0.047)
        continue
    # The free desk's chair tucked in under it.
    chair(f'Chair {who}', px, cz + (face * 0.35 if who == 'free' else 0), math.pi / 2 if face < 0 else -math.pi / 2)
    ahead = cz + face * 1.25  # the monitors, toward the sitter
    nz = -face  # screens face the sitter
    right = -face  # the sitter's right along x (facing +z it is -x)
    if who == 'free':
        monitor(px, ahead, 0, nz, on=False)
        continue
    keys_z = cz + face * 0.85
    if who == 'developer':
        # The riser along the desk's back, the monitor on it (his code),
        # the laptop on its stand at its left, turned in (the team's chat):
        # his double screen. A keyboard and a mouse.
        back = face * (DESK_Z + DESK_D / 2 - 0.17)
        riser(px, back)
        monitor(px + right * 0.25, back, 0, nz, tile=0, lift=RISER_H)
        laptop_on_stand(px - right * 0.62, ahead + face * 0.02, (0 if face < 0 else math.pi) + right * 0.35, 1)
        mac_keyboard(px + right * 0.15, keys_z, 0, face, False)
        mouse(px + right * 0.6, keys_z)
    else:
        # The COO and the CEO: only their laptops (live on the page), a
        # keyboard and a trackpad.
        mac_keyboard(px - right * 0.12, keys_z, 0, face, True)

# ------------------------------------------------------------ the corridors
# West: its far side a white wall with two wooden doors.
WX = -HX - CORR
world_uv(box('Corridor wall W', (T, H, Z1 - (-HZ - CORR)), (WX - T / 2, H / 2, (Z1 + (-HZ - CORR)) / 2), mat=wall_white), 1.5)
for z in (-2.4, 3.2):
    box('Corridor door', (0.05, 2.9, 1.3), (WX + 0.02, 1.45, z), radius=0.006, mat=door_wood)
    box('Corridor door frame', (0.06, 3.0, 1.42), (WX + 0.005, 1.5, z), mat=frame_mat)
    box('Corridor door handle', (0.06, 0.03, 0.18), (WX + 0.06, 1.35, z + 0.45), radius=0.01, mat=handle_mat)
# North: across it, another company's office behind frosted glass (lit),
# a short white wall, and a corridor running on north.
NZ = -HZ - CORR
OPP = (WX, 1.4)  # the frosted front's x span
glass_x0, glass_x1 = OPP
n = 3  # big panes, as ours (narrow ones, seen through our glass, read as clutter)
for k in range(n + 1):
    box('Opposite post', (FT, H, 0.1), (glass_x0 + (glass_x1 - glass_x0) * k / n, H / 2, NZ), mat=frame_mat)
for k in range(n):
    a0 = glass_x0 + (glass_x1 - glass_x0) * k / n + FT / 2
    a1 = glass_x0 + (glass_x1 - glass_x0) * (k + 1) / n - FT / 2
    frosted_objs.append(box('Opposite frosted', (a1 - a0, 2.5, 0.016), ((a0 + a1) / 2, 0.15 + 1.25, NZ), mat=frosted))
    glass_objs.append(box('Opposite glass', (a1 - a0, H - 2.65, 0.012), ((a0 + a1) / 2, (2.65 + H) / 2, NZ), mat=glass))
box('Opposite head', (glass_x1 - glass_x0, 0.1, 0.12), ((glass_x0 + glass_x1) / 2, H - 0.05, NZ), mat=frame_mat)
# Its room behind: a white back wall and sides, its own LED panels.
OB = NZ - 5.0
world_uv(box('Opposite back', (glass_x1 - glass_x0, H, T), ((glass_x0 + glass_x1) / 2, H / 2, OB - T / 2), mat=wall_white), 1.5)
for x in (glass_x0, glass_x1):
    world_uv(box('Opposite side', (T, H, NZ - OB), (x, H / 2, (NZ + OB) / 2), mat=wall_white), 1.5)
for x in (-5.2, -2.4, 0.4):
    box('Opposite panel', (1.0, 0.03, 1.0), (x, H - 0.012, NZ - 2.5), mat=led)
    desk(x, NZ - 2.2)
# The corridor north (x 2 to the room's east wall), its walls, and a white
# wall east of it.
NC = 2.0
for x in (NC, HX):
    world_uv(box('North corridor side', (T, H, NZ - Z0), (x + (-T / 2 if x == NC else T / 2), H / 2, (NZ + Z0) / 2), mat=wall_white), 1.5)
world_uv(box('North corridor end', (HX - NC, H, T), ((NC + HX) / 2, H / 2, Z0 + T / 2), mat=wall_white), 1.5)
world_uv(box('Corridor wall short', (NC - glass_x1, H, T), ((glass_x1 + NC) / 2, H / 2, NZ - T / 2), mat=wall_white), 1.5)
world_uv(box('Corridor wall E', (X1 - HX - T, H, T), ((HX + T + X1) / 2, H / 2, NZ - T / 2), mat=wall_white), 1.5)
world_uv(box('Corridor end E', (T, H, CORR), (X1 + T / 2, H / 2, -HZ - CORR / 2), mat=wall_white), 1.5)
for k in range(4):
    cyl('Downlight', 0.13, H - 0.012, H, (NC + HX) / 2, NZ - 1.4 - 2.2 * k, downlight, 20)

# --------------------------------------------------------------- export
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    bpy.context.object.name = name


join(glass_objs, 'Bridge glass')
join(frosted_objs, 'Bridge frosted')
keep = {'Bridge glass', 'Bridge frosted', 'Bridge door', 'Bridge door glass', 'Bridge door frosted'}
rest = [o for o in scene.objects if o.type == 'MESH' and o.name not in keep]
join(rest, 'Bridge')
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_yup=True, export_apply=True,
                          export_lights=False, export_cameras=False, export_image_format='WEBP',
                          export_image_quality=85,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6)
print('BRIDGE_DONE', OUT.stat().st_size, 'objects', len(scene.objects))
