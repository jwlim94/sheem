"""Neighbor's meeting room for /portfolio/7, chapter 2 (Lehi, 2022): the room
where he had his first onsite interview, after the user's memory.
Run: Blender -b --factory-startup --python art/portfolio-office/build_office.py
Writes public/models/portfolio-office/office.glb (Draco-compressed).

- A small, bright, all-white meeting room. Its front is a glass partition
  with a glass door onto the open office (frosted film over its lower half), and its
  far wall is glass from floor to ceiling onto the corn fields (drawn live in
  OfficeScene.tsx, with the mountains and sky).
- A whiteboard on the east wall (its drawing is live), with its marker tray:
  the black and red markers, the blue one's cap (he holds the blue one), and
  the eraser.
- A plain white 6 ft folding table (the kind sold at Costco): a moulded top
  with a rim and grey steel folding legs. Behind it, on its far side from
  the whiteboard, the two engineers' chairs, facing the board across it
  (they are drawn live, as translucent figures, like the hall's classmates);
  on its board side his own chair, pushed back where he left it.
- The table is kept clear: one engineer's laptop and the other's notebook and
  pen are drawn live (InterviewDesk.tsx). (2026-10-13: the mug, bottles,
  résumé, speaker and his tumbler went, at the user's request.) A TV
  with a camera bar on the west wall over a low credenza; a tall potted
  plant in the window corner (Poly Haven, CC0); ceiling tiles with two LED
  panels; carpet tiles.
- Beyond the glass front, a slice of the open office: desks and monitors,
  chairs, pendant lights.
Glass is exported as its own object ('Office glass'); the page makes it
transparent. Layout numbers mirror src/portfolio/room/office.ts (three.js
axes, at the hero's 1.38x scale).
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/portfolio-office/office.glb'
sys.path.insert(0, str(ROOT / 'art/portfolio-room'))

# Mirrors src/portfolio/room/office.ts.
HX, HZ, H = 4.2, 3.5, 3.6
BOARD = dict(x=HX - 0.045, y0=1.15, y1=2.75, z0=-1.6, z1=1.6)
IN = -1  # from the board's surface into the room, along x
TABLE = dict(x=-0.4, z=0.0, d=1.05, l=2.5, h=1.0)
PROP = 1.3  # chairs, table props: 1.3x real, for the 1.38x hero
SEAT_H = 0.56
CHAIRS = [(-1.5, -0.25, -0.1), (-1.5, 0.9, 0.06), (0.75, 0.25, math.pi - 0.45)]
DESK_HERO = (32.78, 10.09)  # office.ts DESK.hero (x, z): his place at the Renter window row
T = 0.15  # wall thickness
DOOR = (1.25, 2.4)  # the glass door's x span in the front wall
DOOR_H = 2.9

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

# ---------------------------------------------------------------- materials
WHITE_WALL = '#f2f2ef'
wall = material('Wall', WHITE_WALL, 0.92)
alu = material('Aluminium', '#b8bcc1', 0.35, metal=0.6)
dark_alu = material('Dark aluminium', '#3a3e44', 0.4, metal=0.5)
steel = material('Folding steel', '#8b8f95', 0.45, metal=0.4)
black_plastic = material('Black plastic', '#202226', 0.45)
fabric = material('Chair fabric', '#3d424a', 0.95)
glass = material('Glass', '#dfe9ec', 0.05)
frosted = material('Frosted glass', '#f3f5f5', 0.6)
cove = material('Cove base', '#6b6f75', 0.6)


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


carpet = textured('Carpet', carpet_tex(), 0.97)
ceiling = textured('Ceiling tiles', ceiling_tex(), 0.95)
mac_keys = textured('Mac keys', keys_tex(), 0.45)
painted = wall_tex()

# ----------------------------------------------------------------- the room
world_uv(box('Floor', (2 * HX + 2 * T, 0.1, 2 * HZ + 2 * T), (0, -0.05, 0), mat=carpet), 1.32)
world_uv(box('Ceiling', (2 * HX, 0.08, 2 * HZ), (0, H + 0.04, 0), mat=ceiling), 1.6)
for x in (-2.6, 0.0, 2.6):
    box(f'LED panel {x}', (1.0, 0.03, 1.0), (x, H - 0.012, 0.0), '#fbfbf8', mat=material('LED panel', '#fbfbf8', 0.3, emit=4.0))
    box(f'LED trim {x}', (1.04, 0.025, 1.04), (x, H - 0.006, 0.0), '#d9dadb', mat=alu)
box('Return vent', (0.6, 0.02, 0.6), (0.05, H - 0.01, -1.8), '#e2e3e1', mat=material('Vent', '#dfe0de', 0.6))
for k in range(9):
    box(f'Vent slot {k}', (0.54, 0.006, 0.022), (0.05, H - 0.022, -2.04 + k * 0.06), '#9fa2a6',
        mat=material('Vent slot', '#9fa2a6', 0.7))
box('Sprinkler', (0.05, 0.05, 0.05), (-0.1, H - 0.03, 1.4), '#d8d8d6', radius=0.02, mat=alu)

# West wall (TV) and east wall (whiteboard), solid white.
box('West wall', (T, H, 2 * HZ), (-HX - T / 2, H / 2, 0), mat=wall)
box('East wall', (T, H, 2 * HZ), (HX + T / 2, H / 2, 0), mat=wall)
for x, s in ((-HX + 0.01, 1), (HX - 0.01, -1)):
    box(f'Cove {x}', (0.02, 0.1, 2 * HZ), (x, 0.05, 0), mat=cove)

# The window wall (south): glass from floor to ceiling in four panes.
WZ = -HZ
box('Window head', (2 * HX + 0.3, 0.14, 0.2), (0, H - 0.07, WZ - 0.02), mat=dark_alu)
box('Window sill', (2 * HX + 0.3, 0.12, 0.26), (0, 0.06, WZ - 0.02), mat=dark_alu)
PANES = 6
MULL = [-HX + 2 * HX * k / PANES for k in range(PANES + 1)]
PANE_W = 2 * HX / PANES
for x in MULL:
    box(f'Mullion {x:.2f}', (0.07, H, 0.16), (x, H / 2, WZ - 0.02), mat=dark_alu)
win_glass = [box(f'Window glass {x:.2f}', (PANE_W - 0.07, H - 0.26, 0.02), (x + PANE_W / 2, H / 2, WZ - 0.04), mat=glass)
             for x in MULL[:-1]]
# Roller shades rolled up in their pockets above each pane.
for x in [m + PANE_W / 2 for m in MULL[:-1]]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.045, depth=PANE_W - 0.1, location=(x, -(WZ + 0.12), H - 0.2),
                                        rotation=(0, math.pi / 2, 0))
    o = smooth(bpy.context.object)
    o.name = f'Shade roll {x}'
    o.data.materials.append(material('Shade', '#d6d3cc', 0.9))
    box(f'Shade bar {x}', (PANE_W - 0.14, 0.025, 0.03), (x, H - 0.26, WZ + 0.12), mat=dark_alu)
box('Shade pocket', (2 * HX, 0.03, 0.26), (0, H - 0.14, WZ + 0.13), mat=wall)

# The glass front (north) with its door: a thin top track, glass panes down
# to the floor, frosted film over their lower half, the door with a long bar
# pull. (The aluminium bottom track glinted along the floor; it went at the
# user's request, 2026-10-13.)
FZ = HZ
# Frosted film over the glass's lower half, from the floor to about the
# middle (the user's call, 2026-10-13), faint, its top edge a touch stronger
# (the page's alpha map; its UVs run up it, `band_uv`). Before: a band at eye
# level, solid (it cut the view of the open office in two), faint (it tinted
# the floor seen through it like other carpet), thin, then pinstripes.
FROST_H = 1.6
FROST_Y = FROST_H / 2
box('Front track top', (2 * HX, 0.06, 0.08), (0, H - 0.03, FZ), mat=alu)
front_glass = []
for x0, x1 in ((-HX, -0.6), (-0.6, DOOR[0] - 0.05)):
    front_glass.append(box(f'Front glass {x0}', (x1 - x0 - 0.01, H - 0.06, 0.015), ((x0 + x1) / 2, (H - 0.06) / 2, FZ),
                           mat=glass))
    front_glass.append(band_uv(box(f'Front frost {x0}', (x1 - x0 - 0.01, FROST_H, 0.017), ((x0 + x1) / 2, FROST_Y, FZ),
                                   mat=frosted)))
front_glass.append(box('Front glass over door', (DOOR[1] - DOOR[0] + 0.1, H - DOOR_H - 0.1, 0.015),
                       ((DOOR[0] + DOOR[1]) / 2, (DOOR_H + H) / 2, FZ), mat=glass))
front_glass.append(box('Front glass end', (HX - DOOR[1] - 0.06, H - 0.06, 0.015),
                       ((HX + DOOR[1]) / 2 + 0.03, (H - 0.06) / 2, FZ), mat=glass))
front_glass.append(band_uv(box('Front frost end', (HX - DOOR[1] - 0.06, FROST_H, 0.017),
                               ((HX + DOOR[1]) / 2 + 0.03, FROST_Y, FZ), mat=frosted)))
for x in (-0.6, DOOR[0] - 0.05, DOOR[1] + 0.05):
    box(f'Front post {x}', (0.05, H, 0.09), (x, H / 2, FZ), mat=alu)
box('Door head', (DOOR[1] - DOOR[0] + 0.1, 0.06, 0.09), ((DOOR[0] + DOOR[1]) / 2, DOOR_H, FZ), mat=alu)
dw = DOOR[1] - DOOR[0]
# The door's leaf, its own object ('Office door', its origin on its hinge at
# the +x side): the page swings it open out into the corridor as the camera
# leaves through it (2026-10-14, the user's call: it flew through it shut).
# It fills its opening, post to post and floor to head, in a thin aluminium
# frame (stiles, top and bottom rails) round its glass (2026-10-15: a
# smaller leaf left gaps to the posts and under the head, a loose rail).
L0, L1 = DOOR[0] - 0.02, DOOR[1] + 0.02  # its edges, at the posts' faces
LT = DOOR_H - 0.035  # its top, under the head
lw, lc = L1 - L0, (L0 + L1) / 2
door_leaf = [
    box('Door glass', (lw - 0.06, LT - 0.12, 0.012), (lc, 0.08 + (LT - 0.12) / 2, FZ), mat=glass),
    band_uv(box('Door frost', (lw - 0.06, FROST_H - 0.12, 0.016), (lc, 0.08 + (FROST_H - 0.12) / 2, FZ),
                mat=frosted)),
    box('Door rail top', (lw, 0.05, 0.04), (lc, LT - 0.025, FZ), mat=alu),
    box('Door rail bottom', (lw, 0.07, 0.04), (lc, 0.045, FZ), mat=alu),
]
for xx in (L0 + 0.02, L1 - 0.02):
    door_leaf.append(box('Door stile', (0.04, LT - 0.01, 0.04), (xx, 0.01 + (LT - 0.01) / 2, FZ), mat=alu))
for zz in (FZ - 0.05, FZ + 0.07):
    door_leaf.append(tube('Door pull', [(DOOR[0] + 0.12, 0.85, zz), (DOOR[0] + 0.12, 1.85, zz)], 0.016, alu))
    for yy in (0.95, 1.75):
        door_leaf.append(tube('Door pull post', [(DOOR[0] + 0.12, yy, FZ + 0.01), (DOOR[0] + 0.12, yy, zz)], 0.009, alu))
bpy.ops.object.select_all(action='DESELECT')
for o in door_leaf:
    o.select_set(True)
bpy.context.view_layer.objects.active = door_leaf[0]
bpy.ops.object.join()
door = bpy.context.object
door.name = 'Office door'
scene.cursor.location = (L1, -FZ, 0.0)  # the hinge (three.js x, z -> Blender x, -y)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
scene.cursor.location = (0.0, 0.0, 0.0)
# (A light switch and a thermostat stood here, on the glass by the door:
# two white squares floating on it. They went at the user's request.)

# ----------------------------------------------------------- the whiteboard
bx, by0, by1, bz0, bz1 = BOARD['x'], BOARD['y0'], BOARD['y1'], BOARD['z0'], BOARD['z1']
box('Board back', (0.02, by1 - by0, bz1 - bz0), (bx - IN * 0.012, (by0 + by1) / 2, 0), mat=material('Board', '#f7f8f8', 0.22))
for (sy, sz, py, pz) in (((by1 - by0 + 0.06), 0.03, (by0 + by1) / 2, bz0 - 0.015),
                         ((by1 - by0 + 0.06), 0.03, (by0 + by1) / 2, bz1 + 0.015),
                         (0.03, bz1 - bz0 + 0.06, by1 + 0.015, 0), (0.03, bz1 - bz0 + 0.06, by0 - 0.015, 0)):
    box('Board frame', (0.03, sy, sz), (bx - IN * 0.007, py, pz), radius=0.006, mat=alu)
for zz in (bz0 + 0.04, bz1 - 0.04):
    box('Board cap', (0.035, 0.035, 0.035), (bx - IN * 0.005, by1 + 0.015, zz), mat=material('Board corner', '#9ea2a7', 0.5))
    box('Board cap', (0.035, 0.035, 0.035), (bx - IN * 0.005, by0 - 0.015, zz), mat=material('Board corner', '#9ea2a7', 0.5))
TRAY_Y = by0 - 0.07
box('Marker tray', (0.09, 0.02, 1.4), (bx + IN * 0.03, TRAY_Y, 0.6), radius=0.005, mat=alu)
box('Marker tray lip', (0.012, 0.035, 1.4), (bx + IN * 0.07, TRAY_Y + 0.012, 0.6), mat=alu)
cap_col = {'black': '#1e1f22', 'blue': '#2f5fb8', 'red': '#c23b32', 'green': '#2f8a4a'}
marker_body = material('Marker body', '#efefeb', 0.4)


def marker(name, color, x, y, z, yaw, capped=True):
    """A dry-erase marker lying on its side (three.js), along z turned by yaw."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.011, depth=0.13, location=(x, -z, y),
                                        rotation=(math.pi / 2, 0, yaw))
    b = smooth(bpy.context.object)
    b.name = f'Marker {name}'
    b.data.materials.append(marker_body)
    if capped:
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0125, depth=0.04,
                                            location=(x - 0.065 * math.sin(yaw), -(z + 0.065 * math.cos(yaw)), y),
                                            rotation=(math.pi / 2, 0, yaw))
        c = smooth(bpy.context.object)
        c.name = f'Marker cap {name}'
        c.data.materials.append(material(f'Marker cap {color}', cap_col[color], 0.35))
    band = box(f'Marker band {name}', (0.024, 0.024, 0.02), (x, y, z - 0.03), mat=material(f'Marker band {color}', cap_col[color], 0.4),
               yaw=yaw)
    return band


ty = TRAY_Y + 0.022
marker('black', 'black', bx + IN * 0.03, ty, 0.25, 0.05)
marker('red', 'red', bx + IN * 0.03, ty, 0.48, -0.08)
# The blue marker is in his hand; its cap lies on the tray.
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0125, depth=0.04, location=(bx + IN * 0.03, -0.75, ty),
                                    rotation=(math.pi / 2, 0, 0.3))
o = smooth(bpy.context.object)
o.name = 'Blue cap'
o.data.materials.append(material('Marker cap blue', cap_col['blue'], 0.35))
box('Eraser', (0.06, 0.035, 0.15), (bx + IN * 0.03, ty + 0.012, 1.05), radius=0.008, mat=material('Eraser', '#3f4f6b', 0.6))
box('Eraser felt', (0.06, 0.012, 0.15), (bx + IN * 0.03, ty - 0.01, 1.05), mat=material('Eraser felt', '#2a2b2e', 0.95))

# ------------------------------------------------------------- the table
tx, tz, td, tl, th = TABLE['x'], TABLE['z'], TABLE['d'], TABLE['l'], TABLE['h']
table_white = material('Table top', '#f4f4f1', 0.55)
table_parts = [
    box('Table top', (td, 0.045, tl), (0, th - 0.0225, 0), radius=0.018, mat=table_white),
    box('Table rim', (td - 0.06, 0.04, tl - 0.06), (0, th - 0.06, 0), radius=0.01,
        mat=material('Table rim', '#e4e4e0', 0.6)),
]
# Grey steel folding legs at each end: two uprights joined by a foot bar and
# a cross bar, a brace back to the middle, rubber feet.
for s in (-1, 1):
    zl = s * (tl / 2 - 0.16)
    for xs in (-1, 1):
        xl = xs * (td / 2 - 0.1)
        table_parts.append(tube('Table leg', [(xl, 0.035, zl), (xl, th - 0.07, zl)], 0.016, steel))
        table_parts.append(cyl('Table foot', 0.022, 0.0, 0.03, xl, zl, black_plastic, 12))
    table_parts.append(tube('Table cross', [(-(td / 2 - 0.1), 0.62, zl), (td / 2 - 0.1, 0.62, zl)], 0.012, steel))
    table_parts.append(tube('Table brace', [(0, 0.62, zl), (0, th - 0.075, zl - s * 0.55)], 0.011, steel))
    table_parts.append(box('Table hinge', (td - 0.16, 0.03, 0.05), (0, th - 0.075, zl), mat=steel))
group(table_parts, 'Folding table', (tx, 0, tz))

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


for k, (x, z, yaw) in enumerate(CHAIRS):
    chair(f'Chair {k}', x, z, yaw)

# His white backpack (the room's and the hall's, the one he wears:
# art/portfolio-room/backpack.py build_v2_backpack) on his empty chair, sat on the seat and leaning back against
# its backrest, sagging into it (2026-10-13, the user's idea).
from backpack import build_v2_backpack
bx, bz, byaw = CHAIRS[2]
SEAT_TOP = (SEAT_H / PROP + 0.0175) * PROP  # the cushion's top
BACK_AT = -0.27 * PROP  # the backrest's face, along the chair's facing
BAG_GAP = 0.12  # the bag's origin to the backrest
bag = build_v2_backpack(ROOT / 'art/portfolio-room/backpack-v2/source.glb', 'Backpack', height=0.58,
                          slump=0.1, wall_x=-BAG_GAP + 0.006, show_side=0, contact=False)
off = BACK_AT + BAG_GAP
bag.location = (bx + math.cos(byaw) * off, -(bz) + math.sin(byaw) * off, SEAT_TOP)
bag.rotation_euler = (0.0, 0.0, byaw)  # its front the way the chair faces

# ------------------------------------------------------- on the table
# Kept clear: the engineers' laptop and notebook are drawn live
# (InterviewDesk.tsx).

# --------------------------------------------------------- the west wall
box('TV', (0.05, 1.07, 1.9), (-HX + 0.05, 1.8, 0.0), radius=0.006, mat=material('TV body', '#16171a', 0.3))
box('TV glass', (0.004, 1.03, 1.86), (-HX + 0.077, 1.8, 0.0), mat=material('TV glass', '#0d0e11', 0.42))
box('Camera bar', (0.06, 0.06, 0.6), (-HX + 0.06, 2.37, 0.0), radius=0.012, mat=black_plastic)
box('Camera lens', (0.004, 0.03, 0.03), (-HX + 0.091, 2.37, 0.0), mat=material('Camera lens', '#0a0b0d', 0.1))
box('Credenza', (0.45, 0.62, 1.7), (-HX + 0.23, 0.31, 0.0), radius=0.01, mat=material('Credenza', '#e9e8e4', 0.55))
box('Credenza top', (0.47, 0.025, 1.72), (-HX + 0.23, 0.632, 0.0), radius=0.006, mat=material('Oak', '#c9a77e', 0.5))
for zz in (-0.42, 0.42):
    box(f'Credenza seam {zz}', (0.003, 0.56, 0.006), (-HX + 0.455, 0.31, zz), mat=material('Seam', '#cfcdc8', 0.6))
box('Hub', (0.12, 0.03, 0.16), (-HX + 0.25, 0.66, -0.55), radius=0.01, mat=black_plastic)

# ------------------------------------------------- the open office beyond
# Neighbor's floor, after the user's sketch (2026-10-15, its fourth and most
# detailed version: every bench and which way its people face), built only
# as far as the glass shows it. The sketch is placed at 6 cm a unit: its x
# (right) runs out from our glass front (+z), its y (down) toward -x (its
# top, the windows' side, is the whiteboard's side). The building's south
# face is kept flush with our meeting room's window wall. Meeting rooms line
# the outer wall, ours among them; by the big windows the Renter team (his
# team): a single row facing the windows (his place), a double bench, a
# single row facing away; the A and B teams' benches running out toward the
# windows, and a third straight out from our room, their people facing each
# other across them; on the -x side three more meeting rooms in front of a
# solid core; far ahead the eating area's two round wooden tables, the
# kitchen in the far corner, two offices by the windows, the other door; the
# entrance on the -x wall. (Earlier versions: 10 m of single desks; 25 m
# with windows on the far wall; 38 m with the benches straight ahead; the
# third sketch, the benches pulled in and the rooms nearer at the user's
# call: the corridor read too wide.)
U = 0.06


def plan(X, Y):
    """The sketch's units to the room's x, z."""
    return (761.5 - Y) * U, HZ + (X - 426) * U


XE, _ = plan(0, 137)  # the windows' wall (the sketch's top)
XW, _ = plan(0, 1285)  # the entrance's wall
_, FAR = plan(1425, 0)
SOUTH = -HZ - T  # the building's south face, flush with our room's
FW, OD = XE - XW, FAR - HZ
OS = FAR - SOUTH  # the windows' wall's length
# The -x side's meeting rooms: nearer than the sketch (the user's call on
# the third sketch: the corridor read too wide), a bench now standing out in
# it besides.
ROOMS_FRONT, ROOM_DEEP = -7.0, 7.5
# (From the room's floor's edge on: overlapping it, the two flickered in a
# strip along the glass.)
# Its own material ('Office carpet', the same tiles): the page shades it
# evenly, as lit by the ceiling alone (the sun's shadow reaches only round
# the meeting room, and past it the sun lit the floor: a diagonal edge).
desk_top = material('Desk top', '#f3f2ee', 0.5)
monitor_mat = material('Monitor', '#18191c', 0.3)
divider = material('Desk screen', '#c9ccd0', 0.95)
pendant = material('Pendant', '#2b2d31', 0.5)
pendant_glow = material('Pendant glow', '#fff3dc', 0.3, emit=5.0)
trackpad_mat = material('Trackpad', '#ecebe7', 0.32)
kb_silver = material('Keyboard silver', '#c7c8ca', 0.35)
KB_W, KB_D = 0.6, 0.247  # the room's keyboard (15.3 x 6.3 key units)


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


# The lit monitors show everyday work (build_screens.py's atlas: a code
# editor, team chat, a spreadsheet, a map app, a dashboard, a terminal, a
# design tool, mail), the rest are off, dark glass (2026-10-15: they had been
# plain white or black panels).
screens_mat = image_material('Office screens', ROOT / 'art/portfolio-office/screens.png', 0.3, 1.0)
screen_dark = material('Screen off', '#0b0c0e', 0.15)
stand_mat = material('Monitor stand', '#2a2d32', 0.4)


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


def monitor(mx, mz, nx, nz, on=True):
    """A desk monitor on a stand, its screen facing (nx, nz): a thin black
    body, a neck behind it down to a flat foot on the desk (2026-10-15: they
    had stood on a post plugged into the desk), its screen lit with one of
    the work screens, or off (`on`)."""
    along_z = abs(nx) > abs(nz)
    body = (0.025, 0.38, 0.62) if along_z else (0.62, 0.38, 0.025)
    box('Monitor', body, (mx, 1.36, mz), radius=0.004, mat=monitor_mat)
    tile = int(bench_rng.integers(0, 8))
    # (6 mm proud of the body's face: 1 mm, far off, the two flickered.)
    screen_plane(mx + nx * 0.0185, 1.36, mz + nz * 0.0185, nx, nz, 0.58, 0.34,
                 tile if on else None)
    neck = (0.03, 0.3, 0.06) if along_z else (0.06, 0.3, 0.03)
    box('Monitor neck', neck, (mx - nx * 0.035, 1.15, mz - nz * 0.035), mat=stand_mat)
    foot = (0.18, 0.012, 0.22) if along_z else (0.22, 0.012, 0.18)
    box('Monitor foot', foot, (mx - nx * 0.03, 1.006, mz - nz * 0.03), radius=0.004, mat=stand_mat)


office_carpet = carpet.copy()
office_carpet.name = 'Office carpet'
office_wall = textured('Office wall', painted, 0.9)
# Floor and ceiling: ahead of our room, and either side of it back to the
# south face.
for nm, y_, th, mat_, uvs in (('Office floor', -0.05, 0.1, office_carpet, 1.32),
                             ('Office ceiling', H + 0.04, 0.08, ceiling, 1.6)):
    world_uv(box(nm, (FW, th, OD - T), ((XW + XE) / 2, y_, HZ + T + (OD - T) / 2), mat=mat_), uvs)
    for x0, x1 in ((HX + T, XE), (XW, -HX - T)):
        world_uv(box(nm + ' side', (x1 - x0, th, HZ + T - SOUTH), ((x0 + x1) / 2, y_, (SOUTH + HZ + T) / 2), mat=mat_),
                 uvs)
box('Office far wall', (FW, H, 0.2), ((XW + XE) / 2, H / 2, FAR + 0.1), mat=office_wall)
box('Office west wall', (0.2, H, OS), (XW - 0.1, H / 2, (SOUTH + FAR) / 2), mat=office_wall)
for x0, x1 in ((HX + T, XE), (XW, -HX - T)):
    box('Office south wall', (x1 - x0, H, 0.15), ((x0 + x1) / 2, H / 2, SOUTH + 0.075), mat=office_wall)


def meeting_room(x0, x1, z0, z1, front):
    """A meeting room like ours: white sides, a glass front (with our
    front's frosted film) toward the floor, a table inside. `front`: which
    side is glass ('+z' or '-x')."""
    if front == '+z':
        for xx in (x0, x1):
            box('Room side', (0.12, H, z1 - z0), (xx, H / 2, (z0 + z1) / 2), mat=office_wall)
        w_ = x1 - x0
        box('Room front track', (w_, 0.06, 0.08), ((x0 + x1) / 2, H - 0.03, z1), mat=alu)
        front_glass.append(box('Room glass', (w_ - 0.1, H - 0.06, 0.015), ((x0 + x1) / 2, (H - 0.06) / 2, z1), mat=glass))
        front_glass.append(band_uv(box('Room frost', (w_ - 0.1, FROST_H, 0.017), ((x0 + x1) / 2, FROST_Y, z1),
                                       mat=frosted)))
        box('Room table', (w_ * 0.45, 0.04, 1.0), ((x0 + x1) / 2, 0.98, (z0 + z1) / 2), mat=desk_top)
        box('Room table base', (0.1, 0.94, 0.6), ((x0 + x1) / 2, 0.47, (z0 + z1) / 2), mat=black_plastic)
    else:
        for zz in (z0, z1):
            box('Room side', (x1 - x0, H, 0.12), ((x0 + x1) / 2, H / 2, zz), mat=office_wall)
        w_ = z1 - z0
        box('Room front post', (0.09, H, 0.05), (x0, H / 2, (z0 + z1) / 2), mat=alu)
        box('Room front track', (0.08, 0.06, w_), (x0, H - 0.03, (z0 + z1) / 2), mat=alu)
        front_glass.append(box('Room glass', (0.015, H - 0.06, w_ - 0.1), (x0, (H - 0.06) / 2, (z0 + z1) / 2), mat=glass))
        front_glass.append(band_uv(box('Room frost', (0.017, FROST_H, w_ - 0.1), (x0, FROST_Y, (z0 + z1) / 2),
                                       mat=frosted)))
        box('Room table', (1.0, 0.04, w_ * 0.5), ((x0 + x1) / 2, 0.98, (z0 + z1) / 2), mat=desk_top)
        box('Room table base', (0.6, 0.94, 0.1), ((x0 + x1) / 2, 0.47, (z0 + z1) / 2), mat=black_plastic)


# Beside ours along the outer wall: a meeting room on each side (the sketch's
# two "사무실" by ours), their glass fronts in line with ours.
meeting_room(HX + T, plan(0, 549)[0], SOUTH, HZ, '+z')
meeting_room(plan(0, 1024)[0], plan(0, 899)[0], SOUTH, HZ, '+z')
# The windows' wall: glass from near the floor to near the ceiling.
# Glass now, the view beyond it drawn live (OfficeOutside's east: the
# Wasatch, the town, a day passing over them): only the wall's band above
# and below the glass stays (2026-10-15: it was a glowing panel in a wall,
# which didn't read as glass).
box('East wall top', (0.2, 0.25, OS), (XE + 0.12, H - 0.125, (SOUTH + FAR) / 2), mat=office_wall)
box('East wall foot', (0.2, 0.3, OS), (XE + 0.12, 0.15, (SOUTH + FAR) / 2), mat=office_wall)
for zz in (SOUTH + 0.25, FAR - 0.25):
    box('East wall end', (0.2, H, 0.5), (XE + 0.12, H / 2, zz), mat=office_wall)
front_glass.append(box('East windows', (0.02, H - 0.55, OS - 1.0), (XE + 0.02, H / 2 + 0.025, (SOUTH + FAR) / 2),
                       mat=glass))
# The mullions: exactly the glass's height (0.3 to H - 0.25), standing in
# its plane, under a thin head along its top (2026-10-15: 5 cm taller and
# a few cm in front of the glass, close up their tops stood out over the
# white band above it).
GLASS_LO, GLASS_HI = 0.3, H - 0.25
for zm in np.arange(SOUTH + 0.5, FAR - 0.49, 1.8):
    box('Window mullion', (0.06, GLASS_HI - GLASS_LO, 0.07), (XE + 0.02, (GLASS_LO + GLASS_HI) / 2, zm), mat=dark_alu)
box('Window head', (0.08, 0.05, OS - 1.0), (XE + 0.02, GLASS_HI - 0.025, (SOUTH + FAR) / 2), mat=dark_alu)
box('Window sill', (0.25, 0.05, OS - 1.0), (XE - 0.12, 0.27, (SOUTH + FAR) / 2), mat=dark_alu)

bench_rng = np.random.default_rng(22)
SEAT_W = 1.8  # each place's width along a bench


def bench(name, a0, a1, c, along_z=False, skip=None):
    """A benching desk from a0 to a1 along x (or z), its middle at c on the
    other axis: one long top with a low screen down its middle, legs every
    few places, a monitor and keyboard at each place on both sides, chairs at
    most; a long pendant over it."""
    def at(a, b):  # along, across -> x, z
        return (b, a) if along_z else (a, b)

    def size(la, lb):
        return (lb, la) if along_z else (la, lb)

    L = a1 - a0
    am = (a0 + a1) / 2
    n = int(L // SEAT_W)
    x_, z_ = at(am, c)
    sx_, sz_ = size(L, 1.6)
    box(f'{name} top', (sx_, 0.04, sz_), (x_, 0.98, z_), mat=desk_top)
    for k in range(n // 3 + 1):
        x_, z_ = at(a0 + 0.05 + k * (L - 0.1) / max(1, n // 3), c)
        sx_, sz_ = size(0.05, 1.4)
        box(f'{name} leg', (sx_, 0.96, sz_), (x_, 0.48, z_), mat=black_plastic)
    x_, z_ = at(am, c)
    sx_, sz_ = size(L - 0.2, 0.03)
    box(f'{name} screen', (sx_, 0.34, sz_), (x_, 1.17, z_), mat=divider)
    for side in (-1, 1):
        for k in range(n):
            ma = a0 + (k + 0.5) * L / n
            if skip == (side, k):  # his place: furnished on its own
                print('MY_PLACE', name, round(c, 3), round(ma, 3))
                continue
            # The monitor, on its own side of the middle screen, facing its
            # place (they stood on the far side, half behind the screen).
            mx_, mz_ = at(ma, c + side * 0.22)
            nx_, nz_ = at(0, side)
            monitor(mx_, mz_, nx_, nz_)
            # The keyboard (the room's), facing the place, toward the middle.
            kx_, kz_ = at(ma, c + side * 0.48)
            fx_, fz_ = at(0, -side)
            mac_keyboard(kx_, kz_, fx_, fz_, bench_rng.random() < 0.5)
            if bench_rng.random() < 0.75:  # a few places empty
                x_, z_ = at(ma + (bench_rng.random() - 0.5) * 0.3, c + side * (1.05 + bench_rng.random() * 0.25))
                # Facing the desk (chairs are built facing +x).
                face = (math.pi if side > 0 else 0.0) if along_z else (math.pi / 2 if side > 0 else -math.pi / 2)
                chair(f'{name} chair', x_, z_, face + (bench_rng.random() - 0.5) * 0.7, far=True)
    for t in np.linspace(0.08, 0.92, 4):
        x_, z_ = at(a0 + t * L, c)
        cyl('Pendant cord', 0.004, 2.75, H, x_, z_, black_plastic, 6)
    x_, z_ = at(am, c)
    sx_, sz_ = size(L - 1.0, 0.16)
    box('Pendant', (sx_, 0.06, sz_), (x_, 2.72, z_), mat=pendant)
    sx_, sz_ = size(L - 1.1, 0.12)
    box('Pendant glow', (sx_, 0.005, sz_), (x_, 2.687, z_), mat=pendant_glow)




def row(name, z0, z1, xc, face, skip=None):
    """A single row of desks along z (0.9 m deep, its middle at x = xc),
    its people on one side only, facing `face` (+1: +x, the windows; -1:
    away from them): a monitor and keyboard at each place, chairs at most;
    a long pendant over it. `skip`: his place's index (furnished live)."""
    L = z1 - z0
    n = int(L // SEAT_W)
    front = xc - face * 0.45  # the edge his side sits at
    box(f'{name} top', (0.9, 0.04, L), (xc, 0.98, (z0 + z1) / 2), mat=desk_top)
    for k in range(n // 3 + 1):
        box(f'{name} leg', (0.8, 0.96, 0.05), (xc, 0.48, z0 + 0.05 + k * (L - 0.1) / max(1, n // 3)), mat=black_plastic)
    box(f'{name} back', (0.03, 0.3, L - 0.2), (xc + face * 0.44, 1.15, (z0 + z1) / 2), mat=divider)
    for k in range(n):
        mz = z0 + (k + 0.5) * L / n
        if skip == k:
            print('MY_PLACE', name, round(xc, 3), round(mz, 3))
            continue
        # His neighbours' screens are off, so his own draws the eye (the
        # user's call, 2026-10-15); every other screen is on.
        monitor(front + face * 0.65, mz, -face, 0, on=skip is None or abs(k - skip) != 1)
        mac_keyboard(front + face * 0.25, mz, face, 0, bench_rng.random() < 0.5)
        # (His neighbours' places are left without chairs: he gets up and
        # walks out past them.)
        if bench_rng.random() < 0.75 and not (skip is not None and abs(k - skip) == 1):
            chair(f'{name} chair', front - face * (0.5 + bench_rng.random() * 0.25),
                  mz + (bench_rng.random() - 0.5) * 0.3,
                  (0.0 if face > 0 else math.pi) + (bench_rng.random() - 0.5) * 0.7, far=True)
    for t in np.linspace(0.08, 0.92, 4):
        cyl('Pendant cord', 0.004, 2.75, H, xc, z0 + t * L, black_plastic, 6)
    box('Pendant', (0.16, 0.06, L - 1.0), (xc, 2.72, (z0 + z1) / 2), mat=pendant)
    box('Pendant glow', (0.12, 0.005, L - 1.1), (xc, 2.687, (z0 + z1) / 2), mat=pendant_glow)


# The Renter team (his team), by the windows, its rows running out along z:
# a single row facing the windows (his place: `MY_PLACE`, office.ts DESK,
# the fourth from its far end (a desk leg at its right, his backpack
# leaning on it), his monitor and keyboard drawn live by
# RenterDesk.tsx), a double bench (its window side facing away from them, its
# other side toward them), a single row facing away.
_, rz0 = plan(322, 0)
_, rz1 = plan(651, 0)
row('Renter window row', rz0, rz1, plan(0, 199)[0], 1, skip=int((rz1 - rz0) // SEAT_W) - 4)
bench('Renter team', rz0, rz1, plan(0, 299)[0], along_z=True)
row('Renter back row', rz0, rz1, plan(0, 399)[0], -1)
# His chair: under him (office.ts DESK.hero, 0.15 m ahead of his origin; a
# full one, its seat raised 5 cm for the hall's typing loop he sits in).
# (Further back under him than the hall's seat: his back went through
# the office chair's leaning backrest.)
chair('His chair', DESK_HERO[0] - 0.12, DESK_HERO[1], 0.0, seat=SEAT_H + 0.047)  # its own object: it rolls back
# (His white backpack stands by his desk, drawn live from its own GLB,
# public/models/jongwoo/backpack.glb: he picks it up and slings it on as he
# leaves, chapter 2's way out.)
# The A and B teams, and one straight out from our room: benches running
# out toward the windows (along x), their people facing each other across
# them.
for nm, X0, X1, Y0, Y1 in (('A team', 774, 875, 174, 501), ('B team', 925, 1026, 174, 501),
                           ('Middle bench', 623, 723, 496, 824)):
    xa_, za_ = plan(X0, Y1)
    xb_, zb_ = plan(X1, Y0)
    bench(nm, xa_, xb_, (za_ + zb_) / 2)

# The reception desk by the entrance (the sketch's "카운터", turned toward
# the entrance): a white counter with a raised ledge on the visitors' side,
# the receptionist's desk behind it with a monitor, a chair.
rc_x, rc_z = plan(538, 925)
RC_YAW = math.atan2(0.86, -0.51)  # its visitors' side toward the entrance
white_counter = material('Reception', '#f4f4f2', 0.45)
grey_counter = material('Reception top', '#c9ccd0', 0.4)
rparts = [
    box('Reception front', (0.06, 1.08, 2.6), (0.38, 0.54, 0), radius=0.01, mat=white_counter),
    box('Reception ledge', (0.34, 0.04, 2.7), (0.3, 1.1, 0), radius=0.01, mat=grey_counter),
    box('Reception desk', (0.75, 0.04, 2.5), (0.0, 0.76, 0), mat=white_counter),
]
for zz in (-1.3, 1.3):
    rparts.append(box('Reception end', (0.8, 1.08, 0.06), (0.0, 0.54, zz), radius=0.01, mat=white_counter))
rparts.append(box('Reception monitor', (0.03, 0.36, 0.56), (0.15, 1.05, -0.4), mat=monitor_mat))
rparts.append(box('Reception stand', (0.05, 0.22, 0.05), (0.18, 0.88, -0.4), mat=black_plastic))
group(rparts, 'Reception', (rc_x, 0, rc_z), RC_YAW, 1.0)
chair('Reception chair', rc_x - math.cos(RC_YAW) * 0.75, rc_z + math.sin(RC_YAW) * 0.75, RC_YAW, far=True)

# The eating area: two round wooden tables on pedestals, wooden chairs.
wood = material('Table wood', '#b98a5a', 0.55)
dark_wood = material('Chair wood', '#8a6240', 0.6)
# At the corridor's end, in the sketch's eating area, where the glass shows
# them (2026-10-13, the user's call).
for tx_, tz_ in ((3.4, FAR - 7.5), (-2.6, FAR - 6.0)):
    cyl('Round table', 1.0, 0.94, 0.98, tx_, tz_, wood, 40)
    cyl('Round table edge', 0.98, 0.92, 0.94, tx_, tz_, dark_wood, 40)
    cyl('Table column', 0.08, 0.06, 0.92, tx_, tz_, black_plastic, 16)
    cyl('Table foot', 0.45, 0.0, 0.06, tx_, tz_, black_plastic, 24)
    for k in range(5):
        a = k * 2 * math.pi / 5 + 0.4 + bench_rng.random() * 0.3
        cx_, cz_ = tx_ + math.cos(a) * 1.35, tz_ + math.sin(a) * 1.35
        parts = [box('Seat', (0.5, 0.05, 0.5), (0, 0.6, 0), radius=0.01, mat=dark_wood)]
        for lx, lz in ((-0.2, -0.2), (-0.2, 0.2), (0.2, -0.2), (0.2, 0.2)):
            parts.append(box('Leg', (0.04, 0.6, 0.04), (lx, 0.3, lz), mat=dark_wood))
        parts.append(box('Back', (0.04, 0.42, 0.44), (-0.23, 0.84, 0), radius=0.01, mat=dark_wood))
        group(parts, 'Cafe chair', (cx_, 0, cz_), math.pi - a, 1.0)

# The kitchen in the far -x corner: cabinets and a counter along the far
# wall, upper cabinets, a fridge, an island.
cab = material('Cabinet', '#e9e7e2', 0.6)
kx0, _ = plan(0, 1249)
kx1, _ = plan(0, 1074)
kl = kx1 - kx0
box('Base cabinets', (kl, 1.2, 0.8), ((kx0 + kx1) / 2, 0.6, FAR - 0.4), mat=cab)
box('Counter', (kl + 0.1, 0.05, 0.85), ((kx0 + kx1) / 2, 1.225, FAR - 0.42), mat=material('Counter', '#3b3e43', 0.4))
box('Upper cabinets', (kl - 1.5, 1.0, 0.45), ((kx0 + kx1) / 2 + 0.7, 2.6, FAR - 0.23), mat=cab)
box('Fridge', (1.1, 2.6, 0.85), (kx0 + 0.6, 1.3, FAR - 0.43), radius=0.02, mat=material('Fridge', '#c4c7cb', 0.35, metal=0.5))
box('Kitchen island', (kl * 0.6, 1.0, 1.1), ((kx0 + kx1) / 2, 0.5, FAR - 3.2), mat=cab)
box('Island top', (kl * 0.6 + 0.1, 0.05, 1.2), ((kx0 + kx1) / 2, 1.025, FAR - 3.2), mat=material('Counter', '#3b3e43', 0.4))
# The other door, on the far wall by the windows' end (the sketch's): a
# grey steel door, as the user remembers it (it had been wood).
DOOR_X = plan(0, 411)[0]
# A commercial office door, set in the wall rather than stuck on it: a light
# grey painted steel leaf (matte) recessed in a casing a shade darker, a
# narrow wired-glass vision panel at its latch side, a lever handle, a kick
# plate (2026-10-15: a plain grey slab on the white wall looked out of place).
door_leaf_mat = material('Steel door', '#a7acb2', 0.72)
casing_mat = material('Door casing', '#8f959c', 0.6)
box('Far door', (1.1, 2.4, 0.05), (DOOR_X, 1.2, FAR - 0.02), mat=door_leaf_mat)
for xx in (DOOR_X - 0.6, DOOR_X + 0.6):
    box('Far door jamb', (0.1, 2.5, 0.06), (xx, 1.25, FAR - 0.03), mat=casing_mat)
box('Far door head', (1.3, 0.1, 0.06), (DOOR_X, 2.45, FAR - 0.03), mat=casing_mat)
box('Far door vision', (0.16, 0.7, 0.012), (DOOR_X + 0.3, 1.65, FAR - 0.047), mat=material('Vision glass', '#3a4450', 0.15))
box('Far door vision trim', (0.2, 0.74, 0.008), (DOOR_X + 0.3, 1.65, FAR - 0.044), mat=casing_mat)
box('Far door lever', (0.14, 0.025, 0.03), (DOOR_X + 0.38, 1.05, FAR - 0.07), radius=0.008, mat=alu)
box('Far door rose', (0.05, 0.05, 0.015), (DOOR_X + 0.44, 1.05, FAR - 0.05), radius=0.01, mat=alu)
box('Far door kick plate', (1.0, 0.22, 0.006), (DOOR_X, 0.13, FAR - 0.047), mat=alu)
# A foosball table between the other door and the eating area, nearer the
# door, its length along the far wall (the user's memory, 2026-10-15: that
# stretch of floor looked bare): a dark wood cabinet on splayed legs, a green
# pitch inside its rim, eight chrome rods across it with black grips (the
# ends alternating sides) and little red and blue players.
FB_X, FB_Z = DOOR_X - 4.5, FAR - 2.2
fb_wood = material('Foosball wood', '#3a2a20', 0.55)
fb_parts = [box('Foosball tray', (1.42, 0.2, 0.78), (0, 0.74, 0), mat=fb_wood),
            box('Foosball pitch', (1.34, 0.01, 0.7), (0, 0.79, 0), mat=material('Pitch', '#2f7d3a', 0.8))]
for sx in (-1, 1):
    fb_parts.append(box('Foosball rim', (0.04, 0.12, 0.78), (sx * 0.69, 0.9, 0), mat=fb_wood))
    for sz in (-1, 1):
        fb_parts.append(box('Foosball leg', (0.08, 0.66, 0.08), (sx * 0.6, 0.33, sz * 0.32), mat=fb_wood))
for sz in (-1, 1):
    fb_parts.append(box('Foosball side', (1.42, 0.12, 0.04), (0, 0.9, sz * 0.37), mat=fb_wood))
fb_parts.append(box('Pitch line', (0.006, 0.002, 0.7), (0, 0.796, 0), mat=material('Pitch line', '#e8efe4', 0.6)))
chrome = material('Chrome', '#d8dbe0', 0.2, metal=0.9)
for i, (n_, team) in enumerate(((1, 0), (2, 0), (3, 1), (5, 0), (5, 1), (3, 0), (2, 1), (1, 1))):
    rx = -0.6 + i * (1.2 / 7)
    side = -1 if team == 0 else 1
    fb_parts.append(cyl('Foosball rod', 0.007, -0.62, 0.62, rx, 0, chrome, 10))
    fb_parts[-1].rotation_euler = (1.5708, 0, 0)
    fb_parts[-1].location = (rx, 0, 0.88)
    fb_parts.append(cyl('Foosball grip', 0.018, 0.0, 0.12, rx, 0, material('Grip', '#151515', 0.6), 12))
    fb_parts[-1].rotation_euler = (1.5708, 0, 0)
    fb_parts[-1].location = (rx, -side * 0.62, 0.88)
    for k in range(n_):
        pz = (k - (n_ - 1) / 2) * (0.6 / max(n_, 2))
        fb_parts.append(box('Foosball player', (0.03, 0.09, 0.025), (rx, 0.84, pz),
                            mat=material('Red player' if team == 0 else 'Blue player',
                                         '#c8322b' if team == 0 else '#2f5fb8', 0.5)))
group(fb_parts, 'Foosball', (FB_X, 0, FB_Z), 0.0, 1.0)

# Two offices by the windows at the far end, a wall between them; their
# glass fronts toward the floor (-x).
for X0, X1 in ((1070, 1196), (1238, 1363)):
    ox_, oz0_ = plan(X0, 311)
    _, oz1_ = plan(X1, 0)
    meeting_room(ox_, XE, oz0_, oz1_, '-x')
_, wz0 = plan(1196, 0)
_, wz1 = plan(1238, 0)
box('Office link wall', (0.12, H, wz1 - wz0), (plan(0, 249)[0], H / 2, (wz0 + wz1) / 2), mat=office_wall)
# The entrance, on the -x wall: glass double doors in a dark frame.
_, ez0 = plan(350, 0)
_, ez1 = plan(551, 0)
ez = (ez0 + ez1) / 2
box('Entrance frame', (0.12, 2.9, 3.4), (XW + 0.02, 1.45, ez), mat=dark_alu)
for s_ in (-1, 1):
    front_glass.append(box('Entrance glass', (0.03, 2.7, 1.5), (XW + 0.05, 1.4, ez + s_ * 0.78), mat=glass))
    box('Entrance pull', (0.04, 1.0, 0.03), (XW + 0.12, 1.2, ez + s_ * 0.12), mat=alu)
# On the -x side: a solid core (white walls) and, in front of it, three
# meeting rooms like ours, their glass fronts facing the floor.
_, cz0 = plan(623, 0)
_, cz1 = plan(1151, 0)
cx0, cx1 = ROOMS_FRONT - ROOM_DEEP, XW
box('Core', (cx0 - cx1, H, cz1 - cz0), ((cx0 + cx1) / 2, H / 2, (cz0 + cz1) / 2), mat=office_wall)
for X0, X1 in ((623, 748), (824, 949), (1000, 1126)):
    _, rz0_ = plan(X0, 0)
    _, rz1_ = plan(X1, 0)
    rx0, rx1 = cx0, ROOMS_FRONT  # rx1: its glass front (facing +x)
    rw = rz1_ - rz0_
    for zz in (rz0_, rz1_):
        box('Room side', (rx1 - rx0, H, 0.12), ((rx0 + rx1) / 2, H / 2, zz), mat=office_wall)
    box('Room front post', (0.09, H, 0.05), (rx1, H / 2, (rz0_ + rz1_) / 2), mat=alu)
    box('Room front track', (0.08, 0.06, rw), (rx1, H - 0.03, (rz0_ + rz1_) / 2), mat=alu)
    front_glass.append(box('Room glass', (0.015, H - 0.06, rw - 0.1), (rx1, (H - 0.06) / 2, (rz0_ + rz1_) / 2), mat=glass))
    front_glass.append(band_uv(box('Room frost', (0.017, FROST_H, rw - 0.1), (rx1, FROST_Y, (rz0_ + rz1_) / 2),
                                   mat=frosted)))
    box('Room table', (1.0, 0.04, rw * 0.5), ((rx0 + rx1) / 2, 0.98, (rz0_ + rz1_) / 2), mat=desk_top)
    box('Room table base', (0.6, 0.94, 0.1), ((rx0 + rx1) / 2, 0.47, (rz0_ + rz1_) / 2), mat=black_plastic)

# Square ceiling panels over the floor.
for zp in np.arange(SOUTH + 3.0, FAR - 2.0, 7.0):
    for xp in np.arange(XW + 4.0, XE - 2.0, 7.0):
        if abs(xp) < HX + 1 and zp < HZ + 1:
            continue  # over our room
        box('Ceiling panel', (1.2, 0.02, 1.2), (xp, H - 0.01, zp), mat=material('Panel glow', '#ffffff', 0.4, emit=2.5))
print('FLOOR', round(XW, 1), round(XE, 1), round(FAR, 1))

# ------------------------------------------------------------- the plant
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'art/portfolio-office/polyhaven/potted_plant_01/potted_plant_01_1k.gltf'))
plant = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in plant:
    o.select_set(True)
bpy.context.view_layer.objects.active = plant[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.context.view_layer.objects.active = plant[0]
bpy.ops.object.join()
pl = bpy.context.object
pl.name = 'Plant'
# Constant roughness (the exporter failed packing its roughness maps).
for m in pl.data.materials:
    b = next((nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'), None)
    if b is None:
        continue
    for name, value in (('Roughness', 0.7), ('Metallic', 0.0)):
        for link in list(b.inputs[name].links):
            m.node_tree.links.remove(link)
        b.inputs[name].default_value = value
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
dec = pl.modifiers.new('Lighter', 'DECIMATE')
dec.ratio = min(1.0, 60000 / max(1, len(pl.data.polygons)))
bpy.ops.object.modifier_apply(modifier=dec.name)
zs = [v.co.z for v in pl.data.vertices]
pl.scale = (1.25,) * 3
pl.location = (-HX + 0.55, 2.1, -min(zs) * 1.25)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in bpy.data.objects if o not in before and o.type != 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)
print('PLANT faces', len(pl.data.polygons))

# The painted walls' texture runs in metres (world UVs, 1.5 m a tile).
for o in scene.objects:
    if o.type == 'MESH' and any(m and m.name == 'Office wall' for m in o.data.materials):
        world_uv(o, 1.5)

# --------------------------------------------------------------- export
bpy.ops.object.select_all(action='DESELECT')
glass_objs = win_glass + front_glass
for o in glass_objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = glass_objs[0]
bpy.ops.object.join()
bpy.context.object.name = 'Office glass'
bpy.ops.object.select_all(action='DESELECT')
keep = {'Office glass', 'Plant', 'Office door', 'His chair'}
rest = [o for o in scene.objects if o.type == 'MESH' and o.name not in keep]
for o in rest:
    o.select_set(True)
bpy.context.view_layer.objects.active = rest[0]
bpy.ops.object.join()
bpy.context.object.name = 'Office'
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_yup=True, export_apply=True,
                          export_lights=False, export_cameras=False, export_image_format='WEBP',
                          export_image_quality=85,
                          # Draco (decoded from public/draco/): the deep open
                          # office's benches and chairs.
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6)
print('OFFICE_DONE', OUT.stat().st_size, 'objects', len(scene.objects))
