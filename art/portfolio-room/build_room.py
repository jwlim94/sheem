"""Cozy study room for /portfolio/7 from Kenney Furniture Kit (CC0) pieces.
Run: Blender -b --factory-startup --python art/portfolio-room/build_room.py
Writes public/models/portfolio-room/room.glb. Set PREVIEW=<file.png> to render a
check frame with the story character seated at the desk.

Blender axes: +Y is the back wall; the viewer stands at -Y. Furniture is scaled
x2.4 so the desk meets the 2.4 m-tall chibi student's seated hands.
"""
import bpy, os, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
KENNEY = ROOT / 'art/portfolio-room/kenney'
K = 2.4
W, D, H = 6.2, 5.2, 4.4  # room width (x), depth (y), wall height

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


# Sheem palette: creams, sage, honey wood, soft charcoal.
PALETTE = {
    'wood': '#d9b48f', 'woodDark': '#b38b68', 'carpet': '#9db58a',
    'carpetDarker': '#7d9670', 'carpetWhite': '#f7f1e3', 'metal': '#e4e4dc',
    'metalMedium': '#8e9893', 'metalDark': '#394046', 'plant': '#7b9645',
    'lamp': '#ffe2b0', '_defaultMat': '#f2ead8',
}
materials = {}


def material(name, hexcolor, rough=0.75, emit=0.0):
    key = (name, hexcolor, emit)
    if key in materials:
        return materials[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*srgb(hexcolor), 1)
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*srgb(hexcolor), 1)
        p.inputs['Emission Strength'].default_value = emit
    materials[key] = m
    return m


def place(piece, x, y, rot=0, z=0.0, scale=K, name=None, depth=1.0, height=1.0):
    """Imports a Kenney piece, rotates it about Z, centres its footprint on (x, y).
    `depth` / `height` stretch the piece front-to-back (local Y) / vertically on top of `scale`."""
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(KENNEY / f'{piece}.glb'))
    new = [o for o in scene.objects if o not in before]
    root = bpy.data.objects.new(name or piece, None)
    scene.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
        if o.type == 'MESH':
            for slot in o.material_slots:
                base = slot.material.name.split('.')[0]
                emit = 1.4 if base == 'lamp' else 0.0
                slot.material = material(base, PALETTE.get(base, '#cccccc'), emit=emit)
    root.scale = (scale, scale * depth, scale * height)
    root.rotation_euler.z = math.radians(rot)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in new if o.type == 'MESH' for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    # Pivot at the footprint centre so the web scene can rotate pieces (the chair) in place.
    pivot = root.matrix_world.inverted() @ Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for o in new:
        if o.parent == root:
            o.location -= pivot
    root.location = (x, y, z)
    bpy.context.view_layer.update()
    return root, hi - lo


def box(name, size, loc, hexcolor, rough=0.9, emit=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(material(name, hexcolor, rough, emit))
    return o


# Shell: floor, back wall with a window, left wall, skirting.
# Floor: low-contrast oak planks running toward the window (along Y), so the
# open floor in front of the title reads as a finished floor, not a void.
import numpy as np
import bmesh
floor_rng = np.random.default_rng(11)
FW, FH = 2048, int(2048 * D / W)
fx = (np.arange(FW) + 0.5) / FW * W
fy = (np.arange(FH) + 0.5) / FH * D
FX, FY = np.meshgrid(fx, fy)
PLANK = 0.16  # board width (x)
col = np.floor(FX / PLANK).astype(int)
# Each column of boards is staggered; board length 1.1-1.9 m.
offset = floor_rng.uniform(0, 1.9, col.max() + 1)[col]
length = 1.5
row = np.floor((FY + offset) / length).astype(int)
board = col * 97 + row * 13
tone = floor_rng.normal(0, 1, board.max() + 1)[board]
# Grain: long wavy lines per board, with a slower figure and fine pores.
warp = np.sin(FY * 2.3 + col * 1.7) * 1.6 + np.sin(FY * 7.9 + col * 3.1) * 0.35
grain = (np.sin((FX - col * PLANK) * 2 * np.pi / 0.022 + warp) * 0.5 + 0.5) ** 2.2
figure = np.sin((FX - col * PLANK) * 2 * np.pi / 0.11 + warp * 0.6) * 0.5 + 0.5
fine = floor_rng.normal(0, 1, FX.shape)
oak = np.array([0.80, 0.70, 0.57])  # natural oak, satin finish
shade = 1 + 0.045 * tone + 0.06 * (0.5 - grain) + 0.03 * (figure - 0.5) + 0.012 * fine
# Thin darker seams between boards (both directions).
seam_x = np.abs(((FX / PLANK) % 1) - 0.0)
seam_x = np.minimum(seam_x, 1 - seam_x) * PLANK
seam_y = np.abs(((FY + offset) / length) % 1)
seam_y = np.minimum(seam_y, 1 - seam_y) * length
seam = np.clip(1 - np.minimum(seam_x, seam_y) / 0.0025, 0, 1)
fimg = np.clip(oak[None, None, :] * (shade * (1 - 0.3 * seam))[..., None], 0, 1)
floor_img = bpy.data.images.new('Oak floor', FW, FH, alpha=False)
floor_img.pixels[:] = np.dstack([fimg, np.ones((FH, FW))]).astype(np.float32).ravel()
floor_img.filepath_raw = str(ROOT / 'art/portfolio-room/floor.png')
floor_img.file_format = 'PNG'
floor_img.save()
floor_img.pack()
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
floor = bpy.context.object
floor.name = 'Floor'
floor.scale = (W, D, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
thick = floor.modifiers.new('Thickness', 'SOLIDIFY')
thick.thickness, thick.offset = 0.12, -1.0
bpy.ops.object.modifier_apply(modifier=thick.name)
floor_mat = bpy.data.materials.new('Oak floor')
floor_mat.use_nodes = True
fb = next(n for n in floor_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
ft = floor_mat.node_tree.nodes.new('ShaderNodeTexImage')
ft.image = floor_img
floor_mat.node_tree.links.new(ft.outputs['Color'], fb.inputs['Base Color'])
fb.inputs['Roughness'].default_value = 0.42  # satin: the lamp glints along it
floor.data.materials.append(floor_mat)
back_y = D / 2
wx, wz, ww, wh = -0.9, 2.55, 2.2, 1.5  # window centre x/z, width, height
for name, size, loc in [
    ('Back wall left', ((W / 2 + wx - ww / 2), 0.2, H), ((-W / 2 + wx - ww / 2) / 2, back_y + 0.1, H / 2)),
    ('Back wall right', ((W / 2 - wx - ww / 2), 0.2, H), ((W / 2 + wx + ww / 2) / 2, back_y + 0.1, H / 2)),
    ('Back wall below', (ww, 0.2, wz - wh / 2), (wx, back_y + 0.1, (wz - wh / 2) / 2)),
    ('Back wall above', (ww, 0.2, H - wz - wh / 2), (wx, back_y + 0.1, (H + wz + wh / 2) / 2)),
]:
    box(name, size, loc, '#f3ead6')
box('Left wall', (0.2, D, H), (-W / 2 - 0.1, 0, H / 2), '#eadfc8')
# Skirting painted a shade creamier than the wall, with a small moulded cap.
box('Back skirting', (W, 0.06, 0.18), (0, back_y - 0.03, 0.09), '#e6dcc6', rough=0.5)
box('Left skirting', (0.06, D, 0.18), (-W / 2 + 0.03, 0, 0.09), '#e6dcc6', rough=0.5)
box('Back skirting cap', (W, 0.072, 0.022), (0, back_y - 0.036, 0.19), '#ece3cf', rough=0.45)
box('Left skirting cap', (0.072, D, 0.022), (-W / 2 + 0.036, 0, 0.19), '#ece3cf', rough=0.45)


def plaster_material():
    # A warm limewash plaster: soft, low-contrast mottling and faint trowel
    # strokes (one 2 m tile), so the walls read as a finished surface.
    n = 512
    rng = np.random.default_rng(5)
    def wrap_noise(cells):
        # Smooth, tileable noise: a periodic coarse grid, bilinearly upsampled.
        g = rng.normal(0, 1, (cells, cells))
        t = np.arange(n) / n * cells
        i0 = np.floor(t).astype(int)
        f = t - i0
        f = f * f * (3 - 2 * f)
        i1 = (i0 + 1) % cells
        rows = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]
        rows1 = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
        return rows * (1 - f)[:, None] + rows1 * f[:, None]
    blot = wrap_noise(6)
    blot2 = wrap_noise(24)
    yy, xx = np.mgrid[0:n, 0:n] / n
    strokes = np.sin((xx * 7 + yy * 3) * 2 * np.pi + np.sin(yy * 2 * np.pi) * 2) * 0.5
    v = 1 + 0.007 * blot + 0.003 * blot2 + 0.002 * strokes + rng.normal(0, 0.003, (n, n))  # barely there
    base = np.array([0.95, 0.91, 0.83])
    rgb = np.clip(base[None, None, :] * v[..., None], 0, 1)
    img = bpy.data.images.new('Plaster', n, n)
    img.pixels.foreach_set(np.dstack([rgb, np.ones((n, n))]).astype(np.float32).ravel())
    img.pack()
    m = bpy.data.materials.new('Plaster')
    m.use_nodes = True
    b = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
    t = m.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = img
    m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.92
    return m


def world_uv(o, size):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        ax = max(range(3), key=lambda i: abs(f.normal[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        for l in f.loops:
            co = o.matrix_world @ l.vert.co
            l[uv].uv = (co[a] / size, co[b] / size)
    bm.to_mesh(o.data)
    bm.free()


plaster = plaster_material()
for n_ in ('Back wall left', 'Back wall right', 'Back wall below', 'Back wall above', 'Left wall'):
    o_ = bpy.data.objects[n_]
    o_.data.materials[0] = plaster
    world_uv(o_, 2.0)
# Window frame, sill and a warm evening sky behind the glass.
f = 0.08
for name, size, loc in [
    ('Frame top', (ww, 0.16, f), (wx, back_y, wz + wh / 2)),
    ('Frame bottom', (ww + 0.2, 0.3, f), (wx, back_y - 0.06, wz - wh / 2)),
    ('Frame left', (f, 0.16, wh), (wx - ww / 2, back_y, wz)),
    ('Frame right', (f, 0.16, wh), (wx + ww / 2, back_y, wz)),
    ('Frame mullion', (0.05, 0.12, wh), (wx, back_y, wz)),
]:
    box(name, size, loc, '#fbf6ea', 0.6)
# The window is left open: the web scene renders a 3D dusk landscape behind it.
# Roller blind, rolled up at the top of the window: a linen roll with end
# brackets, the bottom rail tucked under it and a short pull cord.
roll_r, roll_z = 0.055, wz + wh / 2 + 0.085
roll_y = back_y - 0.1
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=roll_r, depth=ww + 0.08,
                                    location=(wx, roll_y, roll_z), rotation=(0, math.pi / 2, 0))
blind = bpy.context.object
blind.name = 'Blind roll'
for poly in blind.data.polygons:
    poly.use_smooth = True
blind.data.materials.append(material('Blind linen', '#e9e0cf', 0.95))
box('Blind rail', (ww + 0.06, 0.03, 0.016), (wx, roll_y - roll_r + 0.012, roll_z - roll_r + 0.006), '#d8cdb8', 0.7)
for side in (-1, 1):
    box(f'Blind bracket {side}', (0.018, roll_r * 2 + 0.04, roll_r * 2 + 0.02),
        (wx + side * (ww / 2 + 0.055), back_y - 0.07, roll_z), '#f2efe8', 0.5)
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.003, depth=0.32,
                                    location=(wx + ww / 2 - 0.12, roll_y - roll_r + 0.01, roll_z - roll_r - 0.16))
cord = bpy.context.object
cord.name = 'Blind cord'
cord.data.materials.append(material('Blind cord', '#cfc5b3', 0.8))
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.012,
                                     location=(wx + ww / 2 - 0.12, roll_y - roll_r + 0.01, roll_z - roll_r - 0.33))
bpy.context.object.name = 'Blind pull'
bpy.context.object.data.materials.append(material('Blind cord', '#cfc5b3', 0.8))

# Furniture.
# Own desk instead of Kenney's: that one is a closed cabinet, so the chair, knees
# and hands went through it. Same footprint (1.76 x 1.14 m, top at 0.92 m) with
# open knee space; the drawer pedestal sits right of the knees (hero at x -0.9).
DX0, DX1 = -1.78, -0.02            # left / right edge
DY0, DY1 = back_y - 1.17, back_y - 0.03  # front / back edge
desk_top, top_t, leg = 0.92, 0.05, 0.06
under = desk_top - top_t
desk = bpy.data.objects.new('desk', None)
scene.collection.objects.link(desk)
parts = [
    ('Desk top', (DX1 - DX0, DY1 - DY0, top_t), ((DX0 + DX1) / 2, (DY0 + DY1) / 2, under + top_t / 2), '#d9b48f'),
    ('Desk leg front', (leg, leg, under), (DX0 + leg / 2 + 0.03, DY0 + leg / 2 + 0.03, under / 2), '#d9b48f'),
    ('Desk leg back', (leg, leg, under), (DX0 + leg / 2 + 0.03, DY1 - leg / 2 - 0.03, under / 2), '#d9b48f'),
    ('Desk back panel', (DX1 - DX0 - 0.1, 0.03, 0.45), ((DX0 + DX1) / 2, DY1 - 0.05, under - 0.25), '#c9a37f'),
    ('Desk pedestal', (0.4, DY1 - DY0 - 0.06, under), (DX1 - 0.23, (DY0 + DY1) / 2, under / 2), '#d9b48f'),
]
# One tall cabinet door on the pedestal (the PC tower lives inside), with a
# vertical handle on its left edge.
door_h = under - 0.08
parts.append(('Desk door', (0.36, 0.02, door_h), (DX1 - 0.23, DY0 + 0.02, under / 2 + 0.01), '#c9a37f'))
parts.append(('Desk handle', (0.022, 0.03, 0.16), (DX1 - 0.23 - 0.14, DY0, under / 2 + 0.12), '#8e9893'))
for name, size, loc, colour in parts:
    box(name, size, loc, colour, 0.75).parent = desk
# A thin, modern flat-panel monitor (Kenney's chunky one looked bent once the
# upright code screen sat on its tilted face). The web scene draws the code
# editor exactly on the panel's glass: 0.8 x 0.5 m centred at x -0.9, height 1.35.
MON_X, MON_Z, MON_Y = -0.9, 1.35, back_y - 0.343  # panel centre; front glass at y ~2.245


def slab(name, size, loc, hexcolor, rough, radius, tilt=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius:
        b = o.modifiers.new('Rounded', 'BEVEL')
        b.width, b.segments, b.limit_method = radius, 5, 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=b.name)
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.rotation_euler.x = tilt
    o.data.materials.append(material(name, hexcolor, rough))
    return o


monitor = bpy.data.objects.new('Monitor', None)
scene.collection.objects.link(monitor)
for part in [
    slab('Monitor shell', (0.86, 0.024, 0.56), (MON_X, MON_Y + 0.006, MON_Z), '#c7c8ca', 0.35, 0.012),
    slab('Monitor glass', (0.844, 0.004, 0.544), (MON_X, MON_Y - 0.008, MON_Z), '#0d0f12', 0.18, 0.0),
    slab('Monitor neck', (0.12, 0.022, 0.34), (MON_X, MON_Y + 0.05, desk_top + 0.17), '#c7c8ca', 0.35, 0.008, tilt=math.radians(8)),
    slab('Monitor foot', (0.24, 0.17, 0.012), (MON_X, MON_Y + 0.07, desk_top + 0.006), '#c7c8ca', 0.35, 0.02),
]:
    part.parent = monitor
# A thin silver keyboard with white keycaps (Magic Keyboard style, no logo),
# centred under the Typing clip's fingertips (measured: depth -2.06, height 0.94
# in three.js). Layout in key units u; the function row is at the back (+Y).
KB_U = 0.0392
KB_ROWS = [  # (row depth in u, [key widths in u]); 14.5 u per row
    (0.5, [1.5] + [1] * 12 + [1]),
    (1, [1] * 13 + [1.5]),
    (1, [1.5] + [1] * 12 + [1]),
    (1, [1.75] + [1] * 11 + [1.75]),
    (1, [2.25] + [1] * 10 + [2.25]),
    (1, [1, 1, 1, 1.25, 5, 1.25, 1, 1, 'updown', 1]),
]
kb_w, kb_d = 15.3 * KB_U, 6.3 * KB_U
keyboard = bpy.data.objects.new('Keyboard', None)
scene.collection.objects.link(keyboard)
keyboard.location = (-1.02, back_y - 0.57, desk_top)
keyboard.rotation_euler.x = math.radians(1.5)  # back edge slightly higher
base = slab('Keyboard base', (kb_w, kb_d, 0.008), (0, 0, 0.004), '#c7c8ca', 0.35, 0.006)
keys = []


def key(x, y, w, d):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.0105))
    k = bpy.context.object
    k.scale = (w * KB_U - 0.004, d * KB_U - 0.004, 0.005)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    keys.append(k)


y = kb_d / 2 - 0.4 * KB_U
for depth, widths in KB_ROWS:
    x = -14.5 * KB_U / 2
    yc = y - depth * KB_U / 2
    for w in widths:
        if w == 'updown':  # up / down arrows stacked in one key slot
            key(x + KB_U / 2, yc + KB_U / 4, 1, 0.5)
            key(x + KB_U / 2, yc - KB_U / 4, 1, 0.5)
            w = 1
        else:
            key(x + w * KB_U / 2, yc, w, depth)
        x += w * KB_U
    y -= depth * KB_U
bpy.ops.object.select_all(action='DESELECT')
for k in keys:
    k.select_set(True)
bpy.context.view_layer.objects.active = keys[0]
bpy.ops.object.join()
caps = bpy.context.object
caps.name = 'Keyboard keys'
bevel = caps.modifiers.new('Rounded', 'BEVEL')
bevel.width, bevel.segments, bevel.limit_method = 0.0012, 1, 'ANGLE'
bpy.ops.object.modifier_apply(modifier=bevel.name)
caps.data.materials.clear()
caps.data.materials.append(material('Keycaps', '#f5f5f2', 0.45))
base.parent = caps.parent = keyboard
print('KEYBOARD keys', len(keys), 'size', round(kb_w, 3), round(kb_d, 3))
# A flat white trackpad under the Mixamo Typing clip's right palm (palm on its
# left half, set a hand-width clear of the keyboard)
# (measured, three.js -Z = Blender +Y): rounded slab, thicker at the back.
bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.47, back_y - 0.56, desk_top + 0.008))
pad = bpy.context.object
pad.name = 'Trackpad'
pad.scale = (0.24, 0.2, 0.012)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bevel = pad.modifiers.new('Rounded corners', 'BEVEL')
bevel.width, bevel.segments, bevel.limit_method = 0.018, 6, 'ANGLE'
bpy.ops.object.modifier_apply(modifier=bevel.name)
for poly in pad.data.polygons:
    poly.use_smooth = True
pad.rotation_euler.x = math.radians(2)  # back edge (+Y) slightly higher
pad.data.materials.append(material('Trackpad', '#ecebe7', 0.32))
# Energy drink can where the desk lamp was (original design, no brand): slim
# 250 ml can (13.4 x 5.3 cm) at the scene's 1.38x scale.
CAN_R, CAN_H = 0.0365, 0.185
can = bpy.data.objects.new('Energy drink', None)
scene.collection.objects.link(can)
can.location = (-1.5, back_y - 0.38, desk_top)


def can_part(name, r0, r1, z0, z1, hexcolor, rough, metal=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=r0, radius2=r1, depth=z1 - z0,
                                    location=(0, 0, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = name
    for poly in o.data.polygons:
        poly.use_smooth = True
    m = material(name, hexcolor, rough)
    next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Metallic'].default_value = metal
    o.data.materials.append(m)
    o.parent = can
    return o


can_part('Can base', CAN_R * 0.82, CAN_R, 0.0, 0.008, '#c9cbce', 0.3, 1.0)
# One solid yellow, its texture doing the work (bands and stripes read as
# busy): ink printed on aluminium, a fine grain with a faint metallic fleck,
# a touch darker where the body turns into the base and the neck, under a
# thin clear lacquer that catches a crisp highlight.
body_o = can_part('Can body', CAN_R, CAN_R, 0.008, CAN_H - 0.016, '#f5c21b', 0.42)


def can_paint():
    import numpy as np
    rng = np.random.default_rng(7)
    w, h = 256, 512
    v = (np.arange(h) + 0.5) / h  # along the can's height
    grain = rng.normal(0, 0.012, (h, w)) + np.kron(rng.normal(0, 0.01, (h // 8, w // 8)), np.ones((8, 8)))
    fleck = (rng.random((h, w)) < 0.015) * 0.06
    ends = 1 - 0.03 * (np.exp(-v / 0.03) + np.exp(-(1 - v) / 0.03))[:, None]
    base = np.array([0xf5, 0xc2, 0x1b]) / 255  # sRGB bytes, as glTF stores colour maps
    rgb = np.clip(base[None, None] * (1 + grain + fleck)[..., None] * ends[..., None], 0, 1)
    img = bpy.data.images.new('Can paint', w, h)
    img.pixels.foreach_set(np.concatenate([rgb, np.ones((h, w, 1))], -1).astype(np.float32).ravel())
    img.pack()
    return img


m = body_o.data.materials[0]
nt = m.node_tree
b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = can_paint()
nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
# A little self-light (as the bookcase's things have): its shaded side read
# as a dark, olive bottom.
nt.links.new(tex.outputs['Color'], b.inputs['Emission Color'])
b.inputs['Emission Strength'].default_value = 0.16
for key, val in (('Coat Weight', 0.6), ('Coat Roughness', 0.12)):
    if key in b.inputs:
        b.inputs[key].default_value = val
can_part('Can neck', CAN_R, CAN_R * 0.84, CAN_H - 0.016, CAN_H - 0.002, '#c9cbce', 0.28, 1.0)
can_part('Can lid', CAN_R * 0.84, CAN_R * 0.8, CAN_H - 0.002, CAN_H, '#d6d8da', 0.3, 1.0)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -CAN_R * 0.25, CAN_H + 0.0015))
tab = bpy.context.object
tab.name = 'Can tab'
tab.scale = (0.012, 0.022, 0.002)
tab.data.materials.append(material('Can lid', '#d6d8da', 0.3))
tab.parent = can
can.rotation_euler.z = math.radians(-25)
# Desk plant: Poly Haven "Potted Plant 04" (CC0), a succulent in a white ceramic
# pot, with its own PBR materials. Real size 17 x 19 x 27 cm; x1.1 suits the
# 1.38x-scaled hero and furniture.
before = set(scene.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'art/portfolio-room/polyhaven/potted_plant_04/potted_plant_04_1k.gltf'))
plant_parts = [o for o in scene.objects if o not in before]
plant = bpy.data.objects.new('Desk plant', None)
scene.collection.objects.link(plant)
for o in plant_parts:
    if o.parent is None:
        o.parent = plant
plant.scale = (1.1,) * 3
plant.rotation_euler.z = math.radians(35)
bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in plant_parts if o.type == 'MESH' for c in o.bound_box]
low = min(p.z for p in pts)
cx = sum(p.x for p in pts) / len(pts)
cy = sum(p.y for p in pts) / len(pts)
plant.location += Vector((-0.2 - cx, back_y - 0.35 - cy, desk_top - low))
bpy.context.view_layer.update()
print('PLANT height', round(max(p.z for p in pts) - low, 3))
place('books', -1.6, back_y - 0.8, rot=170, z=desk_top, name='Desk books')
chair, _ = place('chairDesk', -0.9, back_y - 1.45, rot=0, name='Chair')
# Bookcase: a minimal, IKEA-style open shelf in light oak with thick shelves
# and no back (the wall shows through). Books only on the lower two shelves —
# a curated few with small spine titles — snacks and small objects above.
from mathutils import Matrix
BC_X, BC_W, BC_D, BC_H = 1.68, 1.2, 0.42, 1.5
bc_y = back_y - BC_D / 2 - 0.01
OAK = '#d8bd94'
bookcase = bpy.data.objects.new('Bookcase', None)
scene.collection.objects.link(bookcase)
side_t, shelf_t = 0.04, 0.04
levels = [0.0, 0.48, 0.96, BC_H - shelf_t]
parts = [slab('Bookcase side L', (side_t, BC_D, BC_H), (BC_X - BC_W / 2 + side_t / 2, bc_y, BC_H / 2), OAK, 0.55, 0.006),
         slab('Bookcase side R', (side_t, BC_D, BC_H), (BC_X + BC_W / 2 - side_t / 2, bc_y, BC_H / 2), OAK, 0.55, 0.006)]
for k, z in enumerate(levels):
    parts.append(slab(f'Bookcase shelf {k}', (BC_W - 2 * side_t, BC_D, shelf_t), (BC_X, bc_y, z + shelf_t / 2), OAK, 0.55, 0.004))
inner_l = BC_X - BC_W / 2 + side_t + 0.025
inner_r = BC_X + BC_W / 2 - side_t - 0.025
front = bc_y - BC_D / 2


def lit(o, k=0.08):
    """A touch of self-light so things read in the dim corner."""
    for m in o.data.materials:
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Emission Color'].default_value = b.inputs['Base Color'].default_value
        b.inputs['Emission Strength'].default_value = k
    return o


for o in parts:
    lit(o)

BOOK = {'cream': '#ece4d3', 'sand': '#d9c3a0', 'sage': '#a9b79a', 'terra': '#c2754f',
        'ink': '#2e3138', 'mist': '#9fb2bd', 'clay': '#b98f74'}
TITLE_INK = {'ink': '#e9e2d4', 'terra': '#f3e9dc', 'mist': '#2e3138'}


def spine_title(text, x, z_mid, h, colour):
    """Small vertical title on a spine, reading bottom to top."""
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body = text
    t.data.size = 0.016
    t.data.align_x, t.data.align_y = 'CENTER', 'CENTER'
    t.data.space_character = 1.15
    bpy.ops.object.convert(target='MESH')
    t = bpy.context.object
    # Long titles shrink to fit the spine, with a margin at each end.
    fit = min(1.0, (h - 0.04) / max(t.dimensions.x, 1e-6))
    t.matrix_world = (Matrix.Translation((x, front + 0.012 - 0.0012, z_mid)) @ Matrix.Rotation(math.pi / 2, 4, 'Y')
                      @ Matrix.Rotation(math.pi / 2, 4, 'X') @ Matrix.Scale(fit, 4))
    t.data.materials.append(material('Spine title ' + colour, TITLE_INK.get(colour, '#3a3530'), 0.6))
    lit(t, 0.05)
    parts.append(t)


def books_row(z0, x, specs):
    """specs: (key, width, height, title) standing books, spines to the room."""
    for key, w, h, title in specs:
        b = slab(f'Book {key} {x:.3f}', (w, 0.2, h), (x + w / 2, front + 0.012 + 0.1, z0 + h / 2), BOOK[key], 0.75, 0.003)
        b.data.materials[0] = material('Book ' + key, BOOK[key], 0.75)
        lit(b, 0.05)
        parts.append(b)
        if title:
            spine_title(title, x + w / 2, z0 + h / 2, h, key)
        x += w + 0.003
    return x


def stack(z0, x, specs):
    for key, w, h in specs:
        b = slab(f'Stack {key} {z0:.3f}', (w, 0.17, h), (x, front + 0.012 + 0.09, z0 + h / 2), BOOK[key], 0.75, 0.003)
        b.data.materials[0] = material('Book ' + key, BOOK[key], 0.75)
        lit(b, 0.05)
        parts.append(b)
        z0 += h + 0.001


# Shelf 1 (bottom): a fuller run of books and a lying stack at the right.
z = levels[0] + shelf_t
# Computer science books on both shelves: the classics of the degree below
# (algorithms, systems, languages), the working programmer's above.
x = books_row(z, inner_l, [('ink', 0.04, 0.32, 'INTRO TO ALGORITHMS'), ('cream', 0.035, 0.3, 'SICP'),
                          ('sage', 0.05, 0.33, 'COMPUTER SYSTEMS'), ('sand', 0.032, 0.29, ''),
                          ('terra', 0.042, 0.31, 'DESIGN PATTERNS'), ('mist', 0.036, 0.28, 'THE C LANGUAGE'),
                          ('clay', 0.045, 0.32, 'COMPUTER NETWORKING'), ('cream', 0.03, 0.27, ''),
                          ('ink', 0.048, 0.33, 'OPERATING SYSTEMS'), ('sand', 0.038, 0.3, 'DATABASE SYSTEMS'),
                          ('sage', 0.034, 0.28, 'COMPILERS'), ('terra', 0.04, 0.31, 'DISCRETE MATH'),
                          ('mist', 0.044, 0.32, 'ARTIFICIAL INTELLIGENCE')])
stack(z, inner_r - 0.15, [('cream', 0.25, 0.036), ('clay', 0.23, 0.032), ('ink', 0.21, 0.03), ('sage', 0.22, 0.028)])

# Shelf 2: mug and rubber duck at the left, books with a bookend at the right.
z = levels[1] + shelf_t
# Rubber duck (for rubber-duck debugging), facing the room.
dx, dy = inner_l + 0.29, front + 0.14
for name_, loc_, sc_ in [('Duck body', (dx, dy, z + 0.045), (0.075, 0.06, 0.05)),
                         ('Duck head', (dx - 0.02, dy - 0.005, z + 0.115), (0.04, 0.04, 0.04))]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=loc_)
    o_ = bpy.context.object
    o_.name = name_
    o_.scale = sc_
    for poly in o_.data.polygons:
        poly.use_smooth = True
    o_.data.materials.append(material('Duck', '#f4c430', 0.4))
    parts.append(lit(o_, 0.1))
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.016, radius2=0.004, depth=0.03,
                                location=(dx - 0.02, dy - 0.05, z + 0.11), rotation=(math.pi / 2, 0, 0))
beak = bpy.context.object
beak.name = 'Duck beak'
beak.data.materials.append(material('Duck beak', '#f08a24', 0.4))
parts.append(lit(beak, 0.1))
for side in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.006,
                                         location=(dx - 0.02 + side * 0.016, dy - 0.037, z + 0.125))
    eye = bpy.context.object
    eye.name = f'Duck eye {side}'
    eye.data.materials.append(material('Duck eye', '#1d1d1f', 0.3))
    parts.append(eye)
x = books_row(z, inner_r - 0.52, [('ink', 0.04, 0.3, 'CLEAN CODE'), ('mist', 0.036, 0.28, 'REFACTORING'),
                                 ('cream', 0.045, 0.32, 'PRAGMATIC PROGRAMMER'), ('terra', 0.034, 0.29, ''),
                                 ('sand', 0.045, 0.31, 'CODE COMPLETE'), ('ink', 0.038, 0.29, 'MYTHICAL MAN-MONTH'),
                                 ('cream', 0.05, 0.33, 'DATA-INTENSIVE APPS'), ('sage', 0.034, 0.28, 'EFFECTIVE JAVA'),
                                 ('clay', 0.04, 0.3, 'CLEAN ARCHITECTURE'), ('mist', 0.042, 0.31, 'SYSTEM DESIGN'),
                                 ('sand', 0.036, 0.29, 'CODING INTERVIEW')])
be = slab('Bookend', (0.012, 0.12, 0.15), (inner_r - 0.52 - 0.01, front + 0.07, z + 0.075), '#2b2b2d', 0.4, 0.002)
parts.append(lit(be, 0.03))

# Shelf 3: snacks — candy jar, snack box, chip bag — and an AirPods-style case.
z = levels[2] + shelf_t
# A long soundbar-style speaker on the left: matte charcoal body, a dark
# fabric grille on the front and rubber feet. Its RGB spectrum display, light
# strip and standby light are drawn live in SpeakerViz.tsx (they follow the
# music), sized from the 'Speaker grille' object.
SPK_W, SPK_H, SPK_D = 0.56, 0.13, 0.13
spk_x = inner_l + SPK_W / 2 + 0.02
spk = slab('Speaker', (SPK_W, SPK_D, SPK_H), (spk_x, front + 0.03 + SPK_D / 2, z + 0.008 + SPK_H / 2), '#26282c', 0.55, 0.02)
parts.append(lit(spk, 0.04))
grille = slab('Speaker grille', (SPK_W - 0.03, 0.004, SPK_H - 0.03), (spk_x, front + 0.03 - 0.0015, z + 0.008 + SPK_H / 2), '#1e2023', 0.95, 0.008)
parts.append(lit(grille, 0.02))
for gx in np.linspace(-SPK_W / 2 + 0.03, SPK_W / 2 - 0.03, 48):  # fine vertical weave lines
    ln = slab(f'Grille line {gx:.3f}', (0.0012, 0.001, SPK_H - 0.038), (spk_x + gx, front + 0.03 - 0.0038, z + 0.008 + SPK_H / 2), '#2a2c30', 0.95, 0.0)
    ln.data.materials[0] = material('Grille line', '#2a2c30', 0.95)
    parts.append(ln)
for fx in (-SPK_W / 2 + 0.05, SPK_W / 2 - 0.05):
    foot = slab(f'Speaker foot {fx:.2f}', (0.03, 0.07, 0.008), (spk_x + fx, front + 0.03 + SPK_D / 2, z + 0.004), '#1d1d1f', 0.8, 0.002)
    parts.append(foot)

from mathutils import Matrix as _M


def controller(gc_x, gc_y, rot, shell):
    """A game controller lying flat, turned by rot about its centre."""
    gc_parts = []
    body = slab('Controller body', (0.13, 0.075, 0.028), (gc_x, gc_y, z + 0.022), shell, 0.45, 0.012)
    gc_parts.append(body)
    for side in (-1, 1):  # grips
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1, location=(gc_x + side * 0.052, gc_y + 0.03, z + 0.02))
        grip = bpy.context.object
        grip.name = f'Controller grip {side}'
        grip.scale = (0.032, 0.045, 0.02)
        grip.data.materials.append(material('Controller ' + shell, shell, 0.45))
        gc_parts.append(grip)
    for side, col_ in ((-1, '#2b2b2d'), (1, '#2b2b2d')):  # thumbsticks
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.011, depth=0.012, location=(gc_x + side * 0.028, gc_y + 0.012, z + 0.04))
        st_ = bpy.context.object
        st_.name = f'Controller stick {side}'
        st_.data.materials.append(material('Controller stick', col_, 0.6))
        gc_parts.append(st_)
    for k, (bx_, by_, col_) in enumerate([(0.05, -0.018, '#d9534f'), (0.06, -0.008, '#4a90d9'), (0.04, -0.008, '#f2c14e'), (0.05, 0.002, '#5cb85c')]):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.0045, depth=0.006, location=(gc_x + bx_, gc_y + by_, z + 0.037))
        bt = bpy.context.object
        bt.name = f'Controller button {k}'
        bt.data.materials.append(material('Button ' + col_, col_, 0.4))
        gc_parts.append(bt)
    for dx_, dy_, w_, h_ in ((-0.05, -0.008, 0.022, 0.007), (-0.05, -0.008, 0.007, 0.022)):  # d-pad
        dp = slab(f'Controller dpad {w_}', (w_, h_, 0.004), (gc_x + dx_, gc_y + dy_, z + 0.0365), '#2b2b2d', 0.6, 0.001)
        gc_parts.append(dp)
    m_ = _M.Translation((gc_x, gc_y, 0)) @ _M.Rotation(rot, 4, 'Z') @ _M.Translation((-gc_x, -gc_y, 0))
    for o in gc_parts:
        o.matrix_world = m_ @ o.matrix_world
        parts.append(lit(o, 0.06))


# Two game controllers, spaced apart, to the right of the speaker.
controller(inner_l + 0.75, front + 0.15, math.radians(-8), '#ecebe7')
controller(inner_l + 0.98, front + 0.15, math.radians(10), '#ff8a2b')  # bright orange (a dark one vanished)


# Top surface: his tumbler (art/portfolio-room/tumbler.py, shared with the
# lecture hall), a small plant and a short stack.
z = BC_H
import sys
sys.path.insert(0, str(ROOT / 'art/portfolio-room'))
from tumbler import build_tumbler
parts.extend(build_tumbler('Tumbler', (inner_l + 0.08, front + 0.2, z), glow=0.05))
WAL_X, WATCH_X = inner_l + 0.27, inner_l + 0.47
jar_x = inner_r - 0.12
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.07, depth=0.19, location=(jar_x, front + 0.16, z + 0.095))
jar = bpy.context.object
jar.name = 'Candy jar'
jm = material('Jar glass', '#dfe9ec', 0.08)
next(n for n in jm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Alpha'].default_value = 0.28
jar.data.materials.append(jm)
parts.append(jar)
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.073, depth=0.025, location=(jar_x, front + 0.16, z + 0.2))
lid = bpy.context.object
lid.name = 'Candy jar lid'
lid.data.materials.append(material('Jar lid', '#c9a46b', 0.4))
parts.append(lit(lid, 0.06))
candy_rng = np.random.default_rng(5)
CANDY = ['#e46a6a', '#f2c14e', '#7fb77e', '#6aa3d9', '#f29bb8', '#f7f1e3']
for j in range(46):
    a_ = candy_rng.uniform(0, math.tau)
    r_ = 0.052 * math.sqrt(candy_rng.uniform())
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.016,
                                         location=(jar_x + r_ * math.cos(a_), front + 0.16 + r_ * math.sin(a_), z + 0.02 + candy_rng.uniform(0, 0.13)))
    c = bpy.context.object
    c.name = f'Candy {j}'
    col_ = CANDY[j % len(CANDY)]
    c.data.materials.append(material('Candy ' + col_, col_, 0.3))
    parts.append(lit(c, 0.15))
# Supplement bottles beside the candy jar: a tall white one with an orange
# cap and label, a short amber glass one with a white cap, a small white one.
def bottle(name, bx_, r_, h_, body_col, cap_col, label_col=None, glass=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=r_, depth=h_, location=(bx_, front + 0.17, z + h_ / 2))
    b_ = bpy.context.object
    b_.name = name
    for poly in b_.data.polygons:
        poly.use_smooth = True
    b_.data.materials.append(material(name, body_col, 0.15 if glass else 0.45))
    parts.append(lit(b_, 0.08))
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=r_ * 0.82, depth=0.022, location=(bx_, front + 0.17, z + h_ + 0.011))
    c_ = bpy.context.object
    c_.name = name + ' cap'
    c_.data.materials.append(material(name + ' cap', cap_col, 0.5))
    parts.append(lit(c_, 0.08))
    if label_col:
        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=r_ * 1.01, depth=h_ * 0.5, location=(bx_, front + 0.17, z + h_ * 0.45))
        l_ = bpy.context.object
        l_.name = name + ' label'
        l_.data.materials.append(material(name + ' label', label_col, 0.6))
        parts.append(lit(l_, 0.08))


bottle('Vitamin bottle', inner_r - 0.255, 0.032, 0.13, '#f4f2ec', '#f08a24', '#f6c76b')
bottle('Supplement jar', inner_r - 0.33, 0.034, 0.09, '#7a4a1e', '#f4f2ec', '#efe6d2', glass=True)
bottle('Pill bottle', inner_r - 0.395, 0.022, 0.08, '#f4f2ec', '#5c8a5a')

# A black pebbled-leather card holder lying flat: a back panel, a front pocket
# with a curved opening, edge stitching and a white card showing at the side.
CW_, CD_, CT_ = 0.1, 0.14, 0.013
wal_parts = [slab('Card holder back', (CW_, CD_, CT_), (0, 0, CT_ / 2), '#1c1d20', 0.6, 0.006)]
# Front pocket: the right two thirds, its left edge curving (a few stepped slabs).
for k_ in range(6):
    t_ = k_ / 5
    x0_ = -CW_ * 0.12 + 0.016 * math.sin(math.pi * t_)
    wal_parts.append(slab(f'Card holder pocket {k_}', (CW_ / 2 - x0_ + 0.002, CD_ / 6 + 0.001, 0.008),
                          ((x0_ + CW_ / 2) / 2, -CD_ / 2 + CD_ * (k_ + 0.5) / 6, CT_ + 0.005), '#2a2b30', 0.55, 0.003))
# The card sits in the pocket: its edge shows in the curved opening and a few
# millimetres past the right side.
cx0_, cx1_ = -CW_ * 0.12 - 0.01, CW_ / 2 + 0.007
card = slab('Card holder card', (cx1_ - cx0_, CD_ * 0.8, 0.0012), ((cx0_ + cx1_) / 2, 0.0, CT_ + 0.0007), '#f2f2ef', 0.4, 0.0003)
wal_parts.append(card)
wal_parts.append(slab('Card holder stitch', (CW_ - 0.006, CD_ - 0.006, 0.001), (0, 0, CT_ + 0.0002), '#3a3b40', 0.7, 0.0))
wm_ = _M.Translation((WAL_X, front + 0.16, z)) @ _M.Rotation(math.radians(-12), 4, 'Z')
for o in wal_parts:
    o.matrix_world = wm_ @ o.matrix_world
    parts.append(lit(o, 0.06))
# Wristwatch standing on its side: the strap curls into a closed loop behind
# a round case whose dial faces the room.
loop_r, strap_w, strap_t = 0.045, 0.03, 0.0055
wx_, wy_ = WATCH_X, front + 0.15
wz_ = z + loop_r + strap_t
bpy.ops.mesh.primitive_torus_add(major_radius=loop_r, minor_radius=strap_t, major_segments=48, minor_segments=10,
                                 location=(wx_, wy_, wz_), rotation=(0, math.pi / 2, 0))
strap = bpy.context.object
strap.name = 'Watch strap'
strap.scale = (1, 1, strap_w / (2 * strap_t))      # flatten the tube into a wide strap
strap.scale.z = strap_w / (2 * strap_t)
for poly in strap.data.polygons:
    poly.use_smooth = True
strap.data.materials.append(material('Watch strap', '#2b2b2d', 0.6))
parts.append(lit(strap, 0.04))
face_y = wy_ - loop_r - strap_t
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.029, depth=0.015, location=(wx_, face_y - 0.005, wz_), rotation=(math.pi / 2, 0, 0))
case_ = bpy.context.object
case_.name = 'Watch case'
cm_ = material('Watch case', '#c9cbce', 0.25)
next(n for n in cm_.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Metallic'].default_value = 0.9
case_.data.materials.append(cm_)
for poly in case_.data.polygons:
    poly.use_smooth = True
parts.append(lit(case_, 0.05))
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.024, depth=0.002, location=(wx_, face_y - 0.0128, wz_), rotation=(math.pi / 2, 0, 0))
dial = bpy.context.object
dial.name = 'Watch dial'
dial.data.materials.append(material('Watch dial', '#f2efe6', 0.4))
parts.append(lit(dial, 0.1))
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.004, depth=0.007, location=(wx_ + 0.032, face_y - 0.005, wz_), rotation=(0, math.pi / 2, 0))
crown = bpy.context.object
crown.name = 'Watch crown'
crown.data.materials.append(cm_)
parts.append(lit(crown, 0.05))
for ang_, ln_ in ((0.6, 0.017), (2.2, 0.011)):
    hand = slab(f'Watch hand {ang_}', (0.002, 0.001, ln_), (wx_ + math.sin(ang_) * ln_ / 2, face_y - 0.0142, wz_ + math.cos(ang_) * ln_ / 2), '#1d1d1f', 0.5, 0.0)
    hand.rotation_euler.y = ang_
    parts.append(hand)

for o in parts:
    o.parent = bookcase
    o.matrix_parent_inverse = bookcase.matrix_world.inverted()
print('BOOKCASE parts', len(parts))
# Shoes off indoors: the hero's white sneakers, modelled here in the room's
# soft stylised look: a rounded sole with a little toe spring, a lofted upper
# with a padded collar and dark lining, a tongue, and criss-cross laces tied
# in a bow. Left on the floor right of the bookcase, casually askew.
from mathutils.bvhtree import BVHTree


def lace_tube(name, pts, radius, mat, closed=False):
    """A thin tube through points (laces, collar padding, trim)."""
    cu_ = bpy.data.curves.new(name, 'CURVE')
    cu_.dimensions = '3D'
    cu_.bevel_depth = radius
    cu_.bevel_resolution = 2
    sp_ = cu_.splines.new('POLY')
    sp_.points.add(len(pts) - 1)
    for p_, co_ in zip(sp_.points, pts):
        p_.co = (*co_, 1)
    sp_.use_cyclic_u = closed
    o_ = bpy.data.objects.new(name, cu_)
    scene.collection.objects.link(o_)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o_
    o_.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o_ = bpy.context.object
    for q_ in o_.data.polygons:
        q_.use_smooth = True
    o_.data.materials.append(mat)
    return o_


def _spow(v, e):
    return math.copysign(abs(v) ** e, v)


SNK_L, SNK_T = 0.42, 0.03  # length, sole thickness (hero scale)
# Upper height along the shoe, heel (0) to toe (1).
SNK_H = [(0.0, 0.118), (0.15, 0.124), (0.4, 0.13), (0.58, 0.108), (0.78, 0.078), (0.92, 0.06), (1.0, 0.05)]
snk_upper = material('Sneaker upper', '#f2f1ec', 0.65)
snk_sole = material('Sneaker sole', '#e2ddd2', 0.8)
snk_lining = material('Sneaker lining', '#4f4b46', 0.9)
snk_lace = material('Sneaker lace', '#fbfaf6', 0.8)
snk_eyelet = material('Sneaker eyelet', '#8f8a82', 0.5)


def _height(u):
    u = min(max(u, 0.0), 1.0)
    for (u0, h0), (u1, h1) in zip(SNK_H, SNK_H[1:]):
        if u <= u1:
            t = (u - u0) / (u1 - u0)
            return h0 + (h1 - h0) * (0.5 - 0.5 * math.cos(math.pi * t))
    return SNK_H[-1][1]


def _lift(x):
    """Toe spring and a slightly rounded heel."""
    u = x / SNK_L
    return 0.022 * max(0.0, (u - 0.78) / 0.22) ** 2 + 0.006 * max(0.0, (0.06 - u) / 0.06) ** 2


def _outline(n=64, wh=0.05, wt=0.071):
    """Footprint: an egg, narrow at the heel (x 0) and wide at the toe (x L)."""
    pts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        c, s_ = math.cos(th), math.sin(th)
        w = wh + (wt - wh) * (1 + c) / 2
        pts.append((SNK_L / 2 * (1 + _spow(c, 0.8)), w * _spow(s_, 0.8)))
    return pts


def _mesh_obj(name, bm, mats, subsurf=1):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for q in me.polygons:
        q.use_smooth = True
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    if subsurf:
        o.modifiers.new('Smooth', 'SUBSURF').levels = subsurf
    return o


def sneaker(name):
    out = _outline()
    n = len(out)
    cx = SNK_L / 2
    kit = []
    # Sole.
    bm = bmesh.new()
    rings = [[bm.verts.new((cx + (x - cx) * sc, y * sc, z + _lift(x))) for x, y in out]
             for sc, z in ((0.96, 0.0), (1.0, 0.007), (1.0, SNK_T - 0.005), (0.985, SNK_T))]
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    kit.append(_mesh_obj(f'{name} sole', bm, [snk_sole]))
    # Upper: rings from the sole edge over a superellipse shoulder to a ridge.
    bm = bmesh.new()
    K = 12
    grid = []
    for k in range(K + 1):
        ph = math.pi / 2 * k / K
        sy, f = _spow(math.cos(ph), 2 / 3), _spow(math.sin(ph), 2 / 3)
        grid.append([bm.verts.new((cx + (x - cx) * (1 - 0.1 * f) * 0.97, y * 0.95 * sy,
                                   SNK_T - 0.004 + _height(x / SNK_L) * f + _lift(x))) for x, y in out])
    for a, b in zip(grid, grid[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # The opening around the ankle, toward the heel.
    cut = []
    for fc in bm.faces:
        c = fc.calc_center_median()
        if ((c.x / SNK_L - 0.2) / 0.15) ** 2 + (c.y / 0.036) ** 2 < 1 and c.z > SNK_T + 0.8 * _height(c.x / SNK_L):
            cut.append(fc)
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    edges = [e for e in bm.edges if e.is_boundary]
    adj = {}
    for e in edges:
        a, b = e.verts
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    loop, prev, cur = [edges[0].verts[0]], None, edges[0].verts[0]
    while True:
        nxt = [v for v in adj[cur] if v is not prev]
        if not nxt or nxt[0] is loop[0]:
            break
        prev, cur = cur, nxt[0]
        loop.append(cur)
    rim = [v.co.copy() for v in loop]
    oc = sum(rim, Vector()) / len(rim)
    # Lining: a wall down into the shoe and a dark insole.
    inner = [bm.verts.new((oc.x + (p.x - oc.x) * 0.86, oc.y + (p.y - oc.y) * 0.86, SNK_T + 0.02)) for p in rim]
    m = len(rim)
    for i in range(m):
        bm.faces.new((loop[i], loop[(i + 1) % m], inner[(i + 1) % m], inner[i])).material_index = 1
    bm.faces.new(inner).material_index = 1
    upper = _mesh_obj(f'{name} upper', bm, [snk_upper, snk_lining])
    kit.append(upper)
    # Padded collar roll along the rim.
    kit.append(lace_tube(f'{name} collar', [p + Vector((0, 0, 0.002)) for p in rim], 0.009, snk_upper, closed=True))
    # Tongue: rises from under the laces and out of the opening.
    me_u = upper.data
    bvh_u = BVHTree.FromPolygons([v.co for v in me_u.vertices], [q.vertices[:] for q in me_u.polygons])

    def surf(x, y):
        hit, nrm, _, _ = bvh_u.ray_cast(Vector((x, y, 1.0)), Vector((0, 0, -1)))
        return hit.z if hit else SNK_T - 0.004 + _height(x / SNK_L) + _lift(x)
    bm = bmesh.new()
    tg = []
    for i in range(9):
        u = 0.3 + 0.34 * i / 8
        row = []
        for j in range(5):
            y = -0.034 + 0.068 * j / 4
            z = SNK_T - 0.004 + _height(u) + _lift(u * SNK_L) + 0.006 - 6 * y * y
            if u < 0.4:
                z += (0.4 - u) * 0.3
            else:
                z = max(z, surf(u * SNK_L, y) + 0.004)
            row.append(bm.verts.new((u * SNK_L, y, z)))
        tg.append(row)
    for a, b in zip(tg, tg[1:]):
        for j in range(4):
            bm.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
    tongue = _mesh_obj(f'{name} tongue', bm, [snk_upper], subsurf=0)
    so = tongue.modifiers.new('Thick', 'SOLIDIFY')
    so.thickness = 0.006
    so.offset = -1
    tongue.modifiers.new('Smooth', 'SUBSURF').levels = 1
    kit.append(tongue)
    me_t = tongue.data
    vs = [v.co for v in me_u.vertices] + [v.co for v in me_t.vertices]
    nu = len(me_u.vertices)
    bvh = BVHTree.FromPolygons(vs, [q.vertices[:] for q in me_u.polygons] +
                               [[i + nu for i in q.vertices] for q in me_t.polygons])

    def on(x, y, lift):
        hit, nrm, _, _ = bvh.ray_cast(Vector((x, y, 1.0)), Vector((0, 0, -1)))
        return (hit + nrm * lift) if hit else Vector((x, y, 0.1))
    # Five eyelet pairs, criss-cross lacing and a bow at the top pair.
    rows = [(0.42 + 0.065 * i) * SNK_L for i in range(5)]
    half = [0.046 - 0.003 * i for i in range(5)]
    Lp = [(x, -h) for x, h in zip(rows, half)]
    Rp = [(x, h) for x, h in zip(rows, half)]

    def seg(a, b, lift, k=8):
        return [on(a[0] + (b[0] - a[0]) * t / k, a[1] + (b[1] - a[1]) * t / k, lift) for t in range(k + 1)]
    for x, y in Lp + Rp:
        kit.append(lace_tube(f'{name} eyelet', [on(x + 0.006 * math.cos(t), y + 0.006 * math.sin(t), 0.0015)
                                                 for t in [2 * math.pi * k / 12 for k in range(12)]],
                             0.0022, snk_eyelet, closed=True))
    for i in range(4):
        kit.append(lace_tube(f'{name} lace', seg(Rp[i + 1], Lp[i], 0.005), 0.0042, snk_lace))
        kit.append(lace_tube(f'{name} lace', seg(Lp[i + 1], Rp[i], 0.009), 0.0042, snk_lace))
    kit.append(lace_tube(f'{name} lace', seg(Lp[0], Rp[0], 0.007), 0.0042, snk_lace))
    bx, by = rows[0], 0.0
    for sgn in (-1, 1):
        loop_pts = [(bx + 0.004 + 0.014 * math.sin(t), by + sgn * (0.022 + 0.02 * math.cos(t)))
                    for t in [math.pi + 2 * math.pi * k / 16 for k in range(17)]]
        kit.append(lace_tube(f'{name} lace', [on(x, y, 0.009) for x, y in loop_pts], 0.0042, snk_lace))
        kit.append(lace_tube(f'{name} lace', seg((bx, by), (bx + 0.05, by + sgn * 0.05), 0.008), 0.0042, snk_lace))
    knot = on(bx, by, 0.011)
    kit.append(lace_tube(f'{name} lace', [knot - Vector((0.006, 0, 0)), knot + Vector((0.006, 0, 0))], 0.0075, snk_lace))
    # Heel tab.
    kit.append(slab(f'{name} heel tab', (0.024, 0.036, 0.055), (0.016, 0.0, SNK_T + 0.07), '#cbc5b9', 0.7, 0.006))
    return kit


# His white backpack (art/portfolio-room/backpack.py build_v2_backpack: the bag he wears, re-dressed with slack straps; the
# same one as in the lecture hall): set down against the right side of the
# desk's pedestal, front pocket toward the room, its loose straps slumping off
# both sides onto the floor.
import sys
sys.path.insert(0, str(ROOT / 'art/portfolio-room'))
from backpack import build_v2_backpack
# Not tipped as a rigid block: the soft bag sits flat on the floor and sags
# back against the pedestal's side, its top pressed flat where it touches.
BAG_GAP = 0.1  # bag origin to the pedestal side
bag = build_v2_backpack(ROOT / 'art/portfolio-room/backpack-v2/source.glb', 'Backpack', height=0.74,
                          slump=0.13, wall_x=-BAG_GAP + 0.006, show_side=-1)
bag.location = (DX1 + BAG_GAP, back_y - 0.72, 0.02)  # on the rug (0.02 m thick)
bag.rotation_euler = (0.0, 0.0, 0.0)

shoe_x = BC_X + BC_W / 2 + 0.3
for nm_, (sx_, sy_, rz_) in (('Sneaker L', (shoe_x, back_y - 0.5, -76)),
                             ('Sneaker R', (shoe_x + 0.19, back_y - 0.58, -104))):
    m_ = Matrix.Translation((sx_, sy_, 0.0)) @ Matrix.Rotation(math.radians(rz_), 4, 'Z') @ Matrix.Translation((-SNK_L / 2, 0, 0))
    for o_ in sneaker(nm_):
        o_.matrix_world = m_ @ o_.matrix_world
        lit(o_, 0.05)

# Rug: minimal handwoven oatmeal wool, no pattern, just a chunky knit texture
# (rows of V-shaped stitches), sized to sit under the desk and the rolled-back
# chair. Drawn here (numpy) and embedded in the GLB; a copy is saved for review.
import numpy as np
RUG_W, RUG_D = 2.4, 2.1  # x, y (metres)
TW, TH = 2048, int(2048 * RUG_D / RUG_W)
rng = np.random.default_rng(7)
u = (np.arange(TW) + 0.5) / TW
v = (np.arange(TH) + 0.5) / TH
U, V = np.meshgrid(u * RUG_W, v * RUG_D)  # texel positions in metres
cream = np.array([0.88, 0.85, 0.79])
# Wool: soft blotches plus a fine woven grain.
def smooth_noise(cells_x, cells_y):
    """Low-frequency noise, bilinearly upsampled to the texture (no blocks)."""
    low = rng.normal(0, 1, (cells_y + 1, cells_x + 1))
    xs = np.linspace(0, cells_x, TW)
    ys = np.linspace(0, cells_y, TH)
    rows = np.array([np.interp(xs, np.arange(cells_x + 1), r) for r in low])
    return np.array([np.interp(ys, np.arange(cells_y + 1), col) for col in rows.T]).T


blotch = 0.7 * smooth_noise(14, 12) + 0.3 * smooth_noise(40, 35)
shade = 1 + 0.02 * blotch + rng.normal(0, 0.015, U.shape)
img = cream[None, None, :] * shade[..., None]


# Chunky knit: rows across the short side; each stitch is a V (two slanted
# loops), shaded like a rounded bump so it reads at a distance.
ROW, STITCH = 0.028, 0.024  # metres
ry = (V / ROW) % 1.0
sx = (U / STITCH) % 1.0
half = np.where(sx < 0.5, sx * 2, (1 - sx) * 2)  # 0 at stitch edges, 1 at centre
lean = np.where(sx < 0.5, 1, -1)
loop = ((ry + 0.35 * lean * (half - 0.5)) % 1.0)
bump = np.sin(np.pi * loop) ** 0.7 * (0.55 + 0.45 * np.sin(np.pi * half))
groove = np.clip(1 - np.abs(sx - 0.5) / 0.06, 0, 1) * 0.5  # line between V halves
knit = 0.86 + 0.2 * bump - 0.08 * groove
# Slightly darker, tighter selvedge band along the edges.
edge = np.minimum(np.minimum(U, RUG_W - U), np.minimum(V, RUG_D - V))
selvedge = np.clip(1 - (edge - 0.035) / 0.01, 0, 1) * 0.06
img = img * (knit - selvedge)[..., None]
img = np.clip(img, 0, 1)
rug_img = bpy.data.images.new('Rug wool', TW, TH, alpha=False)
rug_img.pixels[:] = np.dstack([img, np.ones((TH, TW))]).astype(np.float32).ravel()
rug_img.filepath_raw = str(ROOT / 'art/portfolio-room/rug.png')
rug_img.file_format = 'PNG'
rug_img.save()
rug_img.pack()

bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.75, 1.25, 0.0))
rug = bpy.context.object
rug.name = 'Rug'
rug.scale = (RUG_W, RUG_D, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
solid = rug.modifiers.new('Thickness', 'SOLIDIFY')
solid.thickness, solid.offset = 0.02, 1.0
bpy.ops.object.modifier_apply(modifier=solid.name)
soft = rug.modifiers.new('Soft edge', 'BEVEL')
soft.width, soft.segments, soft.limit_method = 0.009, 3, 'ANGLE'
bpy.ops.object.modifier_apply(modifier=soft.name)
for poly in rug.data.polygons:
    poly.use_smooth = True
rug_mat = bpy.data.materials.new('Rug wool')
rug_mat.use_nodes = True
bsdf = next(n for n in rug_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
tex = rug_mat.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = rug_img
rug_mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.95
rug.data.materials.append(rug_mat)
lamp, lamp_size = place('lampRoundFloor', -W / 2 + 0.45, back_y - 0.45, rot=0, name='Floor lamp')

# Wall outlet under the desk: a US duplex outlet on the back wall, set so only
# it sits just under the desk's back panel. The floor lamp is plugged
# into its lower receptacle; the cord drops to the floor, hugs the skirting and
# runs to the lamp base.
panel_bottom = under - 0.25 - 0.45 / 2
OUT_W, OUT_H = 0.097, 0.157            # 7 x 11.4 cm plate at the scene's 1.38x
out_x = -1.3
# Top edge tucked just under the panel; from the usual camera height the
# panel still hides the upper part, so the plug and lower receptacle show.
out_z = panel_bottom - 0.005 - OUT_H / 2
outlet = bpy.data.objects.new('Outlet', None)
scene.collection.objects.link(outlet)
plate = slab('Outlet plate', (OUT_W, 0.008, OUT_H), (out_x, back_y - 0.004, out_z), '#f1eee6', 0.4, 0.003)
plate.parent = outlet
recept_z = []
for k, rz in enumerate((0.27, 0.73)):
    z = out_z - OUT_H / 2 + OUT_H * rz
    recept_z.append(z)
    face = slab(f'Outlet receptacle {k}', (0.05, 0.006, 0.044), (out_x, back_y - 0.01, z), '#e9e5db', 0.45, 0.004)
    face.parent = outlet
    for side in (-1, 1):  # vertical slots
        slot = box(f'Outlet slot {k}{side}', (0.004, 0.004, 0.012), (out_x + side * 0.011, back_y - 0.0135, z + 0.004), '#2a2826', 0.8)
        slot.parent = outlet
    ground = box(f'Outlet ground {k}', (0.007, 0.004, 0.006), (out_x, back_y - 0.0135, z - 0.012), '#2a2826', 0.8)
    ground.parent = outlet
screw = box('Outlet screw', (0.006, 0.004, 0.006), (out_x, back_y - 0.0095, out_z), '#cfcbc2', 0.4)
screw.parent = outlet
# Plug in the lower receptacle.
plug_z = recept_z[0]
plug = slab('Lamp plug', (0.032, 0.03, 0.038), (out_x, back_y - 0.03, plug_z), '#e6e1d6', 0.5, 0.004)
plug.parent = outlet

# Monitor plug in the upper receptacle; its cord rises behind the desk's back
# panel, out of sight.
mplug = slab('Monitor plug', (0.03, 0.028, 0.036), (out_x, back_y - 0.029, recept_z[1]), '#1d1d1f', 0.5, 0.004)
mplug.parent = outlet


def tube(name, pts, radius, hexcolor):
    """A cable through explicit points (a dense poly spline; no overshoot)."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spl = curve.splines.new('POLY')
    spl.points.add(len(pts) - 1)
    for sp, co in zip(spl.points, pts):
        sp.co = (*co, 1)
    o = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.data.materials.append(material(name, hexcolor, 0.6))
    return o


def arc(c, r, a0, a1, plane, n=8):
    """Points on a quarter-ish arc around centre c in the given axis plane."""
    out = []
    for k in range(n + 1):
        a = a0 + (a1 - a0) * k / n
        p = list(c)
        p[plane[0]] += r * math.cos(a)
        p[plane[1]] += r * math.sin(a)
        out.append(tuple(p))
    return out


# Monitor power cable: out of the back of the stand's neck, down onto the desk
# behind the foot, back to the desk's rear edge, over it into the gap at the
# wall, down behind the back panel and across to the black plug. Mostly hidden
# by the monitor; it peeks out as the camera swings around.
MR = 0.0035
port_z = MON_Z - 0.2                     # power port, low on the panel's back
back_face = MON_Y + 0.018                # rear of the monitor shell
cx0 = MON_X - 0.15                       # left of the stand, above the outlet side
conn = slab('Monitor power connector', (0.03, 0.026, 0.022), (cx0, back_face + 0.012, port_z), '#1d1d1f', 0.5, 0.004)
# Never touches the desk: from the port the cable spans straight back to the
# wall with a slight sag, bends down, runs straight down the wall through the
# gap behind the desk, then behind the back panel into the black plug.
wall_y = back_y - MR - 0.001
y0, z0 = back_face + 0.024, port_z
mon_cord = []
for t in np.linspace(0, 1, 14):
    mon_cord.append((cx0, y0 + (wall_y - 0.03 - y0) * t, z0 - 0.025 * math.sin(math.pi * t)))
for a_ in np.linspace(0, math.pi / 2, 6)[1:]:          # rounded bend onto the wall
    mon_cord.append((cx0, wall_y - 0.03 * math.cos(a_), z0 - 0.03 * math.sin(a_)))
behind_y = back_y - 0.035
mon_cord += [(cx0, wall_y, under - 0.05),
             (cx0, behind_y, under - 0.12),
             (out_x + 0.03, behind_y, panel_bottom + 0.05),
             (out_x + 0.01, back_y - 0.03, recept_z[1] + 0.06),
             (out_x, back_y - 0.03, recept_z[1] + 0.018)]
tube('Monitor cord', mon_cord, MR, '#1a1a1c')

# Lamp cord (cream): out of the plug's bottom, down the wall, over the skirting,
# along the floor at the foot of the wall, then in under the back of the lamp
# base, the way a floor lamp's cord leaves its base at floor level.
R = 0.0045
skirt_top, skirt_front = 0.18, back_y - 0.06
wall_y = back_y - 0.045          # cord against the wall above the skirting
run_y = skirt_front - R - 0.004  # cord along the floor in front of the skirting
lamp_x, lamp_y = -W / 2 + 0.45, back_y - 0.45
pts = [(out_x, wall_y, plug_z - 0.02), (out_x, wall_y, skirt_top + 0.03)]
# Bend out over the skirting top edge.
pts += arc((out_x, wall_y - 0.0, skirt_top + 0.012), 0.016, math.pi / 2 + 0.3, -0.1, (1, 2), 6)[1:]
pts = [(x, min(y, wall_y), z) for x, y, z in pts]
pts += [(out_x, run_y, skirt_top - 0.01), (out_x, run_y, 0.05)]
# Down to the floor and turn toward the lamp.
pts += [(out_x - 0.02 * (1 - math.cos(a)), run_y, R + 0.05 * (1 - math.sin(a)))
        for a in np.linspace(0, math.pi / 2, 7)][1:]
pts += [(lamp_x + 0.2, run_y, R)]
# Curve from the wall to under the back of the lamp base.
for k in np.linspace(0, 1, 10)[1:]:
    x = lamp_x + 0.2 - 0.2 * k
    y = run_y + (lamp_y + 0.02 - run_y) * (k * k * (3 - 2 * k))
    pts.append((x, y, R))
tube('Lamp cord', pts, R, '#d6cfc1')
print('OUTLET z', round(out_z - OUT_H / 2, 3), round(out_z + OUT_H / 2, 3), 'panel bottom', round(panel_bottom, 3))
# Two vintage-finished prints in slim pine frames above the bookcase.
# Prints are drawn here (numpy) and saved under art/portfolio-room/prints/.
PRINT_W, PRINT_H = 0.5, 0.7  # print size (m)


def sea_print(w=800, h=1120):
    """Blue-hour beach: deep blue sky warming to an orange-pink band at the
    horizon, a small low sun, calm sea, a line of white surf curving in, and
    wet dark sand mirroring the sun with scattered glints."""
    g = np.random.default_rng(3)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xx / w, yy / h
    horizon = 0.5
    sx, sy = 0.5, horizon - 0.004
    t = np.clip(v / horizon, 0, 1)
    sky = np.stack([0.10 + 0.30 * t ** 2.2, 0.24 + 0.32 * t ** 2.0, 0.66 + 0.22 * t], -1)
    warm = np.exp(-((horizon - v) / 0.06) ** 2) * (v < horizon)
    sky = sky * (1 - warm[..., None] * 0.7) + np.array([1.0, 0.55, 0.42]) * warm[..., None] * 0.75
    sun_d = np.hypot((u - sx) * w / h, v - sy)
    sky += (np.exp(-(sun_d / 0.06) ** 2) * 0.35 + np.exp(-(sun_d / 0.012) ** 2) * 1.2)[..., None] * np.array([1.0, 0.8, 0.45])
    # Thin wispy clouds.
    def low(ny, nx):
        c = g.normal(0, 1, (ny + 1, nx + 1))
        xs, ys = np.linspace(0, nx, w), np.linspace(0, ny, h)
        rows = np.array([np.interp(xs, np.arange(nx + 1), r) for r in c])
        return np.array([np.interp(ys, np.arange(ny + 1), col) for col in rows.T]).T
    wisp = np.clip(low(40, 3) * 0.8 - 0.5, 0, 1) * np.exp(-((v - 0.36) / 0.08) ** 2)
    sky = sky + wisp[..., None] * np.array([0.35, 0.3, 0.25])
    img = sky
    # Sea between the horizon and the shore line.
    shore = 0.68 + 0.08 * np.sin(u * 2.4 + 0.6) - 0.06 * u
    d = np.clip((v - horizon) / 0.2, 0, 1)
    sea = (v >= horizon) & (v < shore)
    sea_col = np.stack([0.14 + 0.06 * (1 - d), 0.24 + 0.10 * (1 - d), 0.58 + 0.08 * (1 - d)], -1)
    wave = 0.08 * np.sin(yy * (0.5 + d * 0.9) + np.sin(xx * 0.04 + yy * 0.08) * 2.2)
    sea_col = sea_col * (1 + wave[..., None])
    glitter = np.exp(-((u - sx) / (0.02 + 0.08 * d)) ** 2) * (g.random((h, w)) > 0.6) * (1 - d * 0.6)
    sea_col += glitter[..., None] * np.array([1.0, 0.75, 0.45]) * 0.6
    img = np.where(sea[..., None], sea_col, img)
    # Surf: the wave's leading edge is a bright, broken foam line; behind it a
    # soft, translucent wash; in front a thin glossy film on the wet sand.
    edge = shore + 0.01 * np.sin(u * 9 + 1) + 0.006 * np.sin(u * 23 + 2) + 0.003 * np.sin(u * 51)
    fd = (v - edge) / 0.02
    crest = np.clip(1 - np.abs(fd) * 0.9, 0, 1) ** 1.2
    wash = np.clip(1 + fd / 4.0, 0, 1) * (fd < 0) * 0.45
    holes = blur((g.random((h, w, 1)) > 0.5).astype(np.float32), 2)[..., 0]
    foam = np.clip(crest * (0.55 + 0.6 * holes) + wash * holes, 0, 1) * np.clip((u - 0.04) / 0.1, 0, 1)
    # Wet sand below: dark blue, mirroring the sky and sun, sparse glints.
    sand = v >= edge
    sd = np.clip((v - shore) / (1 - shore.min()), 0, 1)
    sand_col = np.stack([0.07 + 0.05 * sd, 0.11 + 0.05 * sd, 0.32 - 0.10 * sd], -1)
    film = np.exp(-np.clip(v - edge, 0, None) / 0.05)
    sand_col = sand_col + film[..., None] * np.array([0.10, 0.14, 0.24])
    mirror = np.exp(-((u - sx) / 0.025) ** 2) * np.exp(-((v - edge - 0.05) / 0.04) ** 2)
    sand_col += mirror[..., None] * np.array([1.0, 0.7, 0.35]) * 0.8
    dots = (g.random((h, w)) > 0.9985) & sand & (v > edge + 0.03)
    dots = np.clip(blur(dots[..., None].astype(np.float32), 1)[..., 0] * 8, 0, 1)
    sand_col += dots[..., None] * np.array([0.9, 0.6, 0.45]) * 0.45
    img = np.where(sand[..., None], sand_col, img)
    img = img * (1 - foam[..., None]) + np.array([0.85, 0.88, 0.97]) * foam[..., None]
    return np.clip(img, 0, 1)


def family_print(w=800, h=1120):
    """A family of four (father, mother, son, daughter) holding hands on a
    grassy rise at golden hour, backlit so they read as warm silhouettes with
    a rim of light; no faces."""
    g = np.random.default_rng(9)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xx / w, yy / h
    # Golden-hour sky: soft blue above, peach and gold toward the low sun.
    t = np.clip(v / 0.75, 0, 1)
    img = np.stack([0.55 + 0.42 * t ** 1.5, 0.62 + 0.24 * t ** 1.5, 0.80 - 0.30 * t ** 1.5], -1)
    sx, sy = 0.5, 0.66
    sd = np.hypot((u - sx) * w / h, v - sy)
    img += (np.exp(-(sd / 0.18) ** 2) * 0.35 + np.exp(-(sd / 0.035) ** 2) * 0.9)[..., None] * np.array([1.0, 0.82, 0.5])
    # Grassy rise.
    ground = 0.74 + 0.05 * (u - 0.5) ** 2 * 4 - 0.01 * np.sin(u * 5)
    hill = v > ground
    gd = np.clip((v - ground) / 0.25, 0, 1)
    grass = np.stack([0.42 - 0.22 * gd, 0.40 - 0.18 * gd, 0.16 - 0.06 * gd], -1)
    grass *= 1 + (0.12 * g.normal(0, 1, (h, w)) * (0.3 + gd))[..., None]
    grass += (np.exp(-((v - ground) / 0.015) ** 2))[..., None] * np.array([0.5, 0.35, 0.12])
    img = np.where(hill[..., None], grass, img)

    # Figures as a smooth signed-distance field (capsules blended with a smooth
    # minimum), so joints flow into each other like real silhouettes.
    asp = w / h
    P = np.stack([u * asp, v], -1)
    field = np.full((h, w), 9.0, np.float32)

    def smin(a, b, k):
        hh = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
        return b * (1 - hh) + a * hh - k * hh * (1 - hh)

    def capsule(x0, y0, x1, y1, r0, r1=None, k=0.012):
        nonlocal field
        r1 = r0 if r1 is None else r1
        a = np.array([x0 * asp, y0]); b = np.array([x1 * asp, y1])
        pa, ba = P - a, b - a
        t = np.clip((pa @ ba) / (ba @ ba), 0, 1)
        d = np.linalg.norm(pa - t[..., None] * ba, axis=-1) - (r0 + (r1 - r0) * t)
        field = smin(field, d.astype(np.float32), k)

    def ground_at(x):
        return 0.74 + 0.05 * (x - 0.5) ** 2 * 4 - 0.01 * np.sin(x * 5)

    people = [(0.25, 0.40, 'man'), (0.44, 0.25, 'boy'), (0.59, 0.21, 'girl'), (0.76, 0.36, 'woman')]
    joints = []
    for x, H, kind in people:
        fy = ground_at(x) + 0.004
        child = kind in ('boy', 'girl')
        female = kind in ('woman', 'girl')
        hr = H * (0.085 if child else 0.064)
        hy = fy - H + hr
        neck = hy + hr * 1.1
        sh = neck + H * 0.035
        hip = fy - H * (0.43 if child else 0.47)
        sw = H * {'man': 0.115, 'woman': 0.09, 'boy': 0.085, 'girl': 0.08}[kind]
        capsule(x, hy, x, hy + hr * 0.15, hr, k=0.006)                    # head
        capsule(x, hy + hr, x, sh, H * 0.025)                             # neck
        capsule(x - sw * 0.75, sh, x + sw * 0.75, sh, H * 0.035)          # shoulders
        capsule(x, sh, x, hip, sw * 0.62, sw * (0.5 if not female else 0.42))  # torso
        for side in (-1, 1):                                              # legs
            capsule(x + side * sw * 0.28, hip, x + side * sw * 0.36, fy - H * 0.25, H * 0.04, H * 0.03)
            capsule(x + side * sw * 0.36, fy - H * 0.25, x + side * sw * 0.4, fy - H * 0.02, H * 0.03, H * 0.022)
            capsule(x + side * sw * 0.4, fy - H * 0.015, x + side * sw * 0.4 + side * H * 0.035, fy, H * 0.018)
        if female:
            capsule(x, hip - H * 0.04, x, hip + H * 0.16, sw * 0.45, sw * 1.15, k=0.006)  # A-line skirt
            capsule(x + hr * 0.2, hy - hr * 0.2, x + hr * 0.55, hy + H * 0.14, hr * 0.75, hr * 0.5)  # hair
            capsule(x - hr * 0.2, hy - hr * 0.2, x - hr * 0.5, hy + H * 0.1, hr * 0.7, hr * 0.45)
        if kind == 'girl':
            capsule(x + hr * 1.0, hy - hr * 0.4, x + hr * 1.5, hy + hr * 0.4, hr * 0.32, hr * 0.2)  # ponytail
        joints.append((x, sh, sw, H))
    # Arms: inner arms meet the neighbour's hand at a slight dip; outer arms hang.
    for i, (x, sh, sw, H) in enumerate(joints):
        for side in (-1, 1):
            j = i + side
            sx_ = x + side * sw * 0.72
            if 0 <= j < len(joints):
                nx_, nsh, nsw, nH = joints[j]
                hand = ((sx_ + nx_ - side * nsw * 0.72) / 2, max(sh, nsh) + 0.5 * (H + nH) * 0.24)
                elbow = ((sx_ + hand[0]) / 2 + side * 0.004, (sh + hand[1]) / 2 + 0.012)
                capsule(sx_, sh, elbow[0], elbow[1], H * 0.026, H * 0.022)
                capsule(elbow[0], elbow[1], hand[0], hand[1], H * 0.022, H * 0.018)
            else:
                capsule(sx_, sh, sx_ + side * H * 0.03, sh + H * 0.2, H * 0.026, H * 0.022)
                capsule(sx_ + side * H * 0.03, sh + H * 0.2, sx_ + side * H * 0.04, sh + H * 0.38, H * 0.022, H * 0.018)
    sil = np.clip(-field * h / 1.4, 0, 1).astype(np.float32)
    # Backlit: dark warm silhouettes with a glowing rim on the edges.
    # Thin rim where the sun wraps around the edges (strongest near the sun).
    edge = np.clip(1 - np.abs(field) * h / 3.0, 0, 1) * (field > -0.001)
    near_sun = np.exp(-(np.hypot((u - 0.5) * asp, v - 0.66) / 0.35) ** 2)
    img = img * (1 - sil[..., None]) + np.array([0.04, 0.03, 0.03]) * sil[..., None]
    img += (edge * (0.35 + 0.9 * near_sun))[..., None] * np.array([1.0, 0.72, 0.38])
    # Light haze and floating seeds in the sun.
    seeds = ((g.random((h, w)) > 0.99985) & (np.hypot(u - 0.5, v - 0.62) < 0.3)).astype(np.float32)
    img += blur(seeds[..., None], 1) * 4 * np.array([1.0, 0.85, 0.5])
    return np.clip(img, 0, 1)



def namsan_print(w=800, h=1120):
    """N Seoul Tower from below at blue hour: green-lit column, observation
    pod and antenna, above the curved roof of a traditional pavilion with
    dancheong eaves, red pillars and warm light, framed by bare branches."""
    g = np.random.default_rng(21)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xx / w, yy / h
    img = np.stack([0.12 + 0.20 * v, 0.24 + 0.30 * v, 0.62 + 0.28 * v], -1)

    def paint(mask, col, a=1.0):
        nonlocal img
        m = np.clip(mask, 0, 1)[..., None] * a
        img = img * (1 - m) + np.asarray(col) * m

    def soft(d, px=1.2):
        return np.clip(0.5 - d / px, 0, 1)  # d: signed distance in pixels

    # --- Tower --------------------------------------------------------------
    tx = 0.36 * w
    col_top, col_bot = 0.405 * h, 0.75 * h
    half = np.interp(yy, [col_top, col_bot], [0.028 * w, 0.042 * w])
    column = soft(np.abs(xx - tx) - half) * (yy > col_top) * (yy < col_bot)
    shade = 0.75 + 0.35 * np.clip(1 - np.abs(xx - tx + half * 0.25) / np.maximum(half, 1), 0, 1)
    rings = 0.94 + 0.06 * np.sin(yy * 0.35)
    green = np.stack([0.30 * shade * rings, 0.95 * shade * rings, 0.62 * shade * rings], -1)
    glow = blur((column > 0.5).astype(np.float32)[..., None], 18)[..., 0]
    img += glow[..., None] * np.array([0.08, 0.40, 0.24])
    img = img * (1 - column[..., None]) + green * column[..., None]
    # Observation pod: green bowl below, dark glass band with lit windows above.
    pod_y, pod_rx = 0.36 * h, 0.105 * w
    bowl = ((xx - tx) / pod_rx) ** 2 + ((yy - pod_y) / (0.055 * h)) ** 2
    bowl_m = soft((np.sqrt(bowl) - 1) * pod_rx) * (yy > pod_y)
    paint(bowl_m, (0.28, 0.80, 0.42))
    paint(bowl_m * (np.abs(((xx - tx) % 14) - 7) < 1.2) * 0.4, (0.12, 0.45, 0.25))
    band = soft(np.abs(xx - tx) - pod_rx * np.interp(yy, [0.27 * h, pod_y], [0.82, 1.0])) * (yy > 0.27 * h) * (yy <= pod_y)
    paint(band, (0.10, 0.14, 0.28))
    win = band * (np.abs(((yy - 0.27 * h) % 26) - 13) < 4) * (np.abs(((xx - tx) % 11) - 5.5) < 3.2)
    paint(win * (g.random((h, w)) > 0.25), (0.98, 0.88, 0.62))
    rim = soft(np.abs(yy - 0.27 * h) - 2.5) * (np.abs(xx - tx) < pod_rx * 0.84)
    paint(rim, (0.40, 0.95, 0.55))
    # Antenna: tapered lattice with lights, red beacon on top.
    at, ab = 0.04 * h, 0.27 * h
    ahalf = np.interp(yy, [at, ab], [0.004 * w, 0.03 * w])
    mast = soft(np.abs(xx - tx) - ahalf) * (yy > at) * (yy < ab)
    lattice = 0.55 + 0.45 * ((np.abs(((yy + (xx - tx) * 1.2) % 18) - 9) < 1.4) | (np.abs(((yy - (xx - tx) * 1.2) % 18) - 9) < 1.4))
    paint(mast, (0.86, 0.80, 0.78))
    paint(mast * (1 - lattice), (0.25, 0.28, 0.45))
    for k, ly in enumerate(np.linspace(at + 30, ab - 10, 9)):
        lw = np.interp(ly, [at, ab], [0.004 * w, 0.03 * w])
        dot = np.exp(-(((xx - tx) / (lw * 0.7 + 3)) ** 2 + ((yy - ly) / 3.5) ** 2))
        img += dot[..., None] * np.array([1.0, 0.62, 0.3]) * 0.9
    beacon = np.exp(-(((xx - tx) / 5) ** 2 + ((yy - at + 4) / 5) ** 2))
    img += beacon[..., None] * np.array([1.0, 0.25, 0.2]) * 1.6

    # --- Bare branches (behind the pavilion) --------------------------------
    br = np.zeros((h, w), np.float32)

    def branch(x, y, ang, length, width, depth):
        if depth == 0 or length < 6:
            return
        x2, y2 = x + math.cos(ang) * length, y + math.sin(ang) * length
        x0_, x1_ = int(max(0, min(x, x2) - width - 2)), int(min(w, max(x, x2) + width + 3))
        y0_, y1_ = int(max(0, min(y, y2) - width - 2)), int(min(h, max(y, y2) + width + 3))
        if x0_ < x1_ and y0_ < y1_:
            px, py = xx[y0_:y1_, x0_:x1_] - x, yy[y0_:y1_, x0_:x1_] - y
            dx, dy = x2 - x, y2 - y
            t = np.clip((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1)
            d = np.hypot(px - t * dx, py - t * dy) - width
            np.maximum(br[y0_:y1_, x0_:x1_], soft(d, 1.0), out=br[y0_:y1_, x0_:x1_])
        for _ in range(2 if depth > 2 else 3):
            branch(x2, y2, ang + g.uniform(-0.6, 0.6), length * g.uniform(0.62, 0.8), width * 0.68, depth - 1)

    branch(0.98 * w, 0.98 * h, -1.75, 230, 9, 7)
    branch(1.04 * w, 0.55 * h, -2.2, 170, 6, 6)
    branch(-0.03 * w, 0.8 * h, -1.25, 160, 6, 6)
    branch(1.03 * w, 0.25 * h, -2.5, 140, 5, 6)
    branch(1.03 * w, 0.78 * h, -2.4, 180, 6, 6)
    # Keep branches to the sides, clear of the tower.
    keep = np.clip((u - 0.58) / 0.14, 0, 1) + np.clip((0.17 - u) / 0.1, 0, 1)
    paint(br * np.clip(keep, 0, 1), (0.06, 0.08, 0.20), 0.9)

    # --- Pavilion ------------------------------------------------------------
    cx = 0.47 * w
    eave = 0.73 * h
    span = 0.44 * w
    xn = (xx - cx) / span
    lift = 0.07 * h * np.clip(np.abs(xn) - 0.55, 0, None) ** 2 / 0.2 ** 2 * 0.25
    roof_top = 0.655 * h + 0.045 * h * xn ** 2 - lift
    roof_bot = eave - lift
    inside = np.abs(xn) < 1.0
    roof = soft(roof_top - yy) * soft(yy - roof_bot) * inside
    paint(roof, (0.10, 0.12, 0.22))
    paint(roof * (np.abs(((xx - cx) % 9) - 4.5) < 1.0) * (yy > roof_top + 6), (0.16, 0.18, 0.30))
    # Ridge finial.
    paint(soft(np.abs(xx - cx) - 7) * (yy > 0.6 * h) * (yy < 0.66 * h), (0.10, 0.12, 0.22))
    paint(np.exp(-(((xx - cx) / 9) ** 2 + ((yy - 0.6 * h) / 9) ** 2)) > 0.5, (0.10, 0.12, 0.22))
    # Dancheong band under the eaves: green/teal with red, orange and white motifs.
    under_top, under_bot = roof_bot, roof_bot + 0.05 * h
    band = soft(under_top - yy) * soft(yy - under_bot) * (np.abs(xn) < 0.97)
    paint(band, (0.11, 0.40, 0.38))
    # Rafter ends: a row of round ends with orange/white rings, then fine stripes.
    rafter_y = under_top + 0.014 * h
    rx_ = ((xx - cx) % 22) - 11
    ring = np.hypot(rx_, yy - rafter_y)
    paint(band * (ring < 7), (0.95, 0.72, 0.38))
    paint(band * (ring < 4), (0.85, 0.30, 0.20))
    stripe = (np.abs(((xx - cx) % 22) - 11) < 2) * (yy > rafter_y + 9)
    paint(band * stripe, (0.20, 0.62, 0.52), 0.8)
    paint(band * (np.abs(yy - (under_bot - 5)) < 2.5), (0.85, 0.30, 0.20))
    warm = np.exp(-((yy - under_bot) / (0.06 * h)) ** 2) * (np.abs(xn) < 0.9) * (yy > under_bot)
    img += warm[..., None] * np.array([1.0, 0.62, 0.25]) * 0.25
    # Beam and red pillars down to the frame bottom.
    beam = soft(np.abs(yy - (under_bot + 0.02 * h)) - 0.012 * h) * (np.abs(xn) < 0.9)
    paint(beam, (0.70, 0.22, 0.14))
    for px_ in (-0.62, -0.08, 0.5, 0.78):
        pil = soft(np.abs(xx - (cx + px_ * span)) - 0.018 * w) * (yy > under_bot)
        lit = 0.75 + 0.35 * np.clip(1 - (xx - (cx + px_ * span) + 0.01 * w) ** 2 / (0.018 * w) ** 2, 0, 1)
        paint(pil, np.array([0.78, 0.24, 0.14]))
        img = img * (1 + (pil * (lit - 1))[..., None] * 0.6)
    # Warm interior glow between the pillars.
    inner = np.exp(-(((xx - cx) / (0.3 * w)) ** 2 + ((yy - 0.95 * h) / (0.12 * h)) ** 2)) * (yy > under_bot)
    img += inner[..., None] * np.array([1.0, 0.6, 0.3]) * 0.18
    img *= 1 + 0.01 * g.normal(0, 1, (h, w))[..., None]
    return np.clip(img, 0, 1)


def blur(a, k):
    """Separable box blur (two passes ~ gaussian) over the first two axes."""
    for _ in range(2):
        for axis in (0, 1):
            pad = [(0, 0)] * a.ndim
            pad[axis] = (k + 1, k)
            c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis)
            hi = np.take(c, np.arange(2 * k + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, np.arange(0, c.shape[axis] - 2 * k - 1), axis=axis)
            a = (hi - lo) / (2 * k + 1)
    return a


def golf_print(w=800, h=1120):
    """A summer green, low and close: blue sky with soft clouds, out-of-focus
    woods on both sides, a white flag pin far away and a sharp white ball in
    the foreground (no people)."""
    g = np.random.default_rng(5)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xx / w, yy / h
    horizon = 0.53
    # Sky: deeper blue at the top, paler toward the horizon.
    t = np.clip(v / horizon, 0, 1)
    img = np.stack([0.42 + 0.28 * t, 0.62 + 0.20 * t, 0.90 + 0.04 * t], -1)
    # Soft clouds: thresholded, blurred noise bands.
    def low(ny, nx):
        """Smooth noise from a coarse grid, bilinearly upsampled."""
        c = g.normal(0, 1, (ny + 1, nx + 1))
        xs, ys = np.linspace(0, nx, w), np.linspace(0, ny, h)
        rows = np.array([np.interp(xs, np.arange(nx + 1), r) for r in c])
        return np.array([np.interp(ys, np.arange(ny + 1), col) for col in rows.T]).T

    n = 0.65 * low(5, 4) + 0.35 * low(12, 9)  # wide, flat cumulus shapes
    band = np.exp(-((v - 0.3) / 0.08) ** 2) + 0.6 * np.exp(-((v - 0.44) / 0.04) ** 2)
    cloud = np.clip((n * 0.8 + band * 1.3 - 0.95) * 1.4, 0, 1)
    cloud = blur(cloud[..., None], 6)[..., 0]
    img = img * (1 - cloud[..., None]) + np.array([0.97, 0.97, 0.98]) * cloud[..., None]
    # Woods: dense on the right, lower on the left, opening in the middle.
    right = horizon - 0.05 - 0.26 * np.clip((u - 0.6) / 0.4, 0, 1) ** 0.8
    left = horizon - 0.02 - 0.15 * np.clip((0.35 - u) / 0.35, 0, 1)
    crown = 0.012 * np.sin(u * 15) + 0.008 * np.sin(u * 31 + 2)
    top = np.minimum(np.where(u > 0.5, right, left), horizon - 0.015) + crown
    woods = (v > top) & (v < horizon + 0.01)
    shade = 0.75 + 0.25 * np.clip((0.5 - u) * 2, 0, 1)  # right side darker
    wood_col = np.array([0.20, 0.36, 0.17]) * shade[..., None] * (1 + 0.15 * g.normal(0, 1, (h, w))[..., None])
    img = np.where(woods[..., None], wood_col, img)
    # Grass: light far fairway, richer green near.
    grass = v >= horizon
    d = np.clip((v - horizon) / (1 - horizon), 0, 1)
    gcol = np.stack([0.58 - 0.24 * d, 0.68 - 0.18 * d, 0.30 - 0.14 * d], -1)
    noise = g.normal(0, 1, (h, w)).astype(np.float32)
    gcol = gcol * (1 + ((0.03 + 0.14 * d) * noise)[..., None])
    # Long soft shadow bands across the green (trees behind the camera).
    stripe = 0.5 + 0.5 * np.sin((v - horizon) * 60 / (0.15 + d))
    gcol = gcol * (1 - 0.12 * stripe * (d < 0.6))[..., None]
    img = np.where(grass[..., None], gcol, img)
    # Flag pin: thin pole and a small white flag, far away.
    px = 0.47
    pole = (np.abs(u - px) < 0.0045) & (v > 0.16) & (v < horizon + 0.012)
    img = np.where(pole[..., None], np.array([0.85, 0.80, 0.70]), img)
    flag = (u > px - 0.055) & (u < px) & (v > 0.15 + (px - u) * 0.25) & (v < 0.22 - (px - u) * 0.1)
    img = np.where(flag[..., None], np.array([0.97, 0.96, 0.92]), img)
    # Depth of field: everything beyond the near grass is soft.
    far = np.clip((0.72 - v) / 0.12, 0, 1)[..., None]
    img = img * (1 - far) + blur(img, 12) * far
    # Ball: sharp, lit from the upper left, with dimples and a contact shadow.
    bx, by, br = 0.4, 0.72, 0.13
    asp = w / h
    sh = (((u - bx - 0.03) / 0.14) ** 2 + ((v - by - br * asp * 0.85) / 0.03) ** 2) < 1
    img = np.where(sh[..., None], img * 0.5, img)
    nx, ny = (u - bx) / br, (v - by) / (br * asp)
    db = np.sqrt(nx ** 2 + ny ** 2)
    ball = db < 1
    nz = np.sqrt(np.clip(1 - db ** 2, 0, 1))
    light = np.clip(0.35 + 0.75 * (-0.45 * nx - 0.55 * ny + 0.7 * nz), 0.45, 1.05)
    # Dimples: tightly packed hexagonal dishes on the sphere (lon/lat lattice).
    # Inside each dish the face toward the light is shaded and the far side
    # catches it; thin bright ridges separate neighbours.
    lon = np.arctan2(nx, np.maximum(nz, 1e-3))
    lat = np.arcsin(np.clip(-ny, -1, 1))
    sp = 0.24
    gx, gy = lon * np.cos(lat) / sp, lat / (sp * 0.866)
    # Nearest lattice centre: compare the nearest centre in the rows above and below.
    best = None
    for row in (np.floor(gy), np.floor(gy) + 1):
        off = 0.5 * (row % 2)
        cx = np.round(gx - off) + off
        cu, cv = (gx - cx) * sp, (gy - row) * sp * 0.866
        dd = cu ** 2 + cv ** 2
        if best is None:
            best, du, dv = dd, cu, cv
        else:
            closer = dd < best
            best = np.where(closer, dd, best)
            du, dv = np.where(closer, cu, du), np.where(closer, cv, dv)
    rad = sp * 0.5
    hexd = np.maximum.reduce([np.abs(du), np.abs(du * 0.5 + dv * 0.866), np.abs(du * 0.5 - dv * 0.866)]) / rad  # pointy-top cells
    inside = hexd < 0.9
    tilt = (du * -0.6 + dv * 0.75) / rad  # toward the light (upper left)
    dish = np.where(inside, -0.30 * tilt * np.clip(1 - hexd, 0, 1) ** 0.5 - 0.06, 0.0)
    ridge = 0.10 * np.clip((hexd - 0.85) / 0.15, 0, 1) * (hexd < 1.05)
    dimple = (dish + ridge) * np.clip(nz * 1.8, 0, 1)  # fade toward the silhouette
    ball_col = np.array([0.96, 0.96, 0.95]) * (light + dimple)[..., None]
    ball_col += (np.clip(db - 0.85, 0, 1) * 1.2 * (ny > 0.2))[..., None] * np.array([-0.15, -0.05, -0.15])
    img = np.where(ball[..., None], np.clip(ball_col, 0, 1), img)
    img *= 1 + 0.01 * g.normal(0, 1, (h, w))[..., None]
    return np.clip(img, 0, 1)

def vintage(img, seed=0):
    """Old print look: faded blacks, warm muted colour, soft bloom, film grain,
    and a vignette."""
    vg = np.random.default_rng(seed + 100)
    h, w, _ = img.shape
    lum = img.mean(2, keepdims=True)
    img = lum + (img - lum) * 0.78                      # desaturate a little
    img = img * np.array([1.03, 1.0, 0.92]) + np.array([0.02, 0.012, 0.0])  # warm
    img = 0.07 + img * 0.88                             # lifted, faded blacks
    img = img * 0.82 + blur(img, 3) * 0.18              # slight lens softness
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((xx / w - 0.5) / 0.55, (yy / h - 0.5) / 0.55)
    img = img * (1 - 0.28 * np.clip(r - 0.45, 0, 1) ** 1.4)[..., None]
    grain = blur(vg.normal(0, 1, (h, w, 1)).astype(np.float32), 1)
    img = img + grain * 0.035
    return np.clip(img, 0, 1)



def load_print(filename):
    """An RGB image from art/portfolio-room/prints/ as a top-down float array."""
    im = bpy.data.images.load(str(ROOT / 'art/portfolio-room/prints' / filename))
    w, h = im.size
    px = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3]
    bpy.data.images.remove(im)
    return px


def print_material(name, pixels):
    pixels = vintage(pixels, seed=len(name))
    h, w, _ = pixels.shape
    im = bpy.data.images.new(name, w, h, alpha=False)
    im.pixels[:] = np.dstack([pixels[::-1], np.ones((h, w))]).astype(np.float32).ravel()
    (ROOT / 'art/portfolio-room/prints').mkdir(exist_ok=True)
    im.filepath_raw = str(ROOT / f'art/portfolio-room/prints/{name}.png')
    im.file_format = 'PNG'
    im.save()
    im.pack()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    t = m.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = im
    m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    # A little self-light so the print still reads on the dim right wall.
    m.node_tree.links.new(t.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.2
    b.inputs['Roughness'].default_value = 0.9
    return m


def gallery_frame(i, px, pz, art):
    """Medium oak frame with depth: a stepped profile (outer moulding, inner
    lip), the print recessed inside, the whole frame leaning off the wall at
    the top as if hung on a wire, so it casts a shadow."""
    bar, depth = 0.032, 0.05
    fw, fh = PRINT_W + 2 * bar, PRINT_H + 2 * bar
    frame = bpy.data.objects.new(f'Frame {i}', None)
    scene.collection.objects.link(frame)
    parts = []
    for name, size, loc in [
        ('top', (fw, depth, bar), (0, 0, fh / 2 - bar / 2)),
        ('bottom', (fw, depth, bar), (0, 0, -fh / 2 + bar / 2)),
        ('left', (bar, depth, fh - 2 * bar), (-fw / 2 + bar / 2, 0, 0)),
        ('right', (bar, depth, fh - 2 * bar), (fw / 2 - bar / 2, 0, 0)),
    ]:
        parts.append(slab(f'Frame {i} {name}', size, loc, '#b08660', 0.55, 0.006))
    lip, ld = 0.008, 0.03  # inner lip, a step back from the face
    for name, size, loc in [
        ('lip top', (PRINT_W, ld, lip), (0, 0.008, PRINT_H / 2 - lip / 2)),
        ('lip bottom', (PRINT_W, ld, lip), (0, 0.008, -PRINT_H / 2 + lip / 2)),
        ('lip left', (lip, ld, PRINT_H), (-PRINT_W / 2 + lip / 2, 0.008, 0)),
        ('lip right', (lip, ld, PRINT_H), (PRINT_W / 2 - lip / 2, 0.008, 0)),
    ]:
        parts.append(slab(f'Frame {i} {name}', size, loc, '#97704e', 0.6, 0.0))
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.018, 0), rotation=(math.pi / 2, 0, 0))
    p = bpy.context.object
    p.name = f'Print {i}'
    p.scale = (PRINT_W - 2 * lip, PRINT_H - 2 * lip, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    p.data.materials.append(art if not isinstance(art, str) else material(f'Print {i}', art, 0.9))
    parts.append(p)
    back = slab(f'Frame {i} back', (fw - 0.01, 0.006, fh - 0.01), (0, depth / 2 - 0.003, 0), '#4a3424', 0.8, 0.0)
    parts.append(back)
    # Medium oak like the floor; a touch of self-light keeps it from going muddy.
    for o in parts:
        o.parent = frame
        for m in o.data.materials:
            if m.name.startswith(f'Frame {i}') and 'back' not in m.name:
                b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
                b.inputs['Emission Color'].default_value = b.inputs['Base Color'].default_value
                b.inputs['Emission Strength'].default_value = 0.06
    # Hang: bottom edge near the wall, top leaning out ~3 degrees.
    frame.rotation_euler.x = math.radians(3)
    frame.location = (px, back_y - depth / 2 - 0.006 - math.sin(math.radians(3)) * fh / 2, pz)

gallery_frame(0, 1.3, 3.05, print_material('print-blossom', load_print('blossom-photo.png')))
gallery_frame(1, 2.05, 2.85, print_material('print-jeju', load_print('jeju-photo.png')))

bpy.context.view_layer.update()
print('DESK_TOP', round(desk_top, 3), 'CHAIR', tuple(round(v, 3) for v in chair.location))

# Export the room (everything currently in the scene), Draco compressed:
# positions and UVs at 16 bits, normals at 12 (nothing moves by more than
# 0.05 mm or a 50th of a texel; 6.6 MB uncompressed, 3.0 MB). The committed
# file was compressed with glTF-Transform at the same settings (2026-11-25).
out = ROOT / 'public/models/portfolio-room/room.glb'
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True,
                          export_apply=True, export_lights=False, export_cameras=False,
                          export_image_format='WEBP', export_image_quality=85,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=16,
                          export_draco_normal_quantization=12,
                          export_draco_texcoord_quantization=16)
print('ROOM_DONE', out.stat().st_size)

preview = os.environ.get('PREVIEW')
if preview:
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/models/boy/jongwoo-student-story.glb'))
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    rig.animation_data.action = bpy.data.actions['SitType']
    rig.rotation_euler.z += float(os.environ.get('FACE', '0'))
    rig.location = (-0.9, back_y - 1.45, float(os.environ.get('SEAT_DROP', '0')))
    scene.frame_set(5)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = Vector(map(float, os.environ.get('CAM', '4.2,-7.4,4.6').split(',')))
    cam.rotation_euler = (Vector((-0.4, 0.6, 1.3)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 30
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.2
    sun.data.color = srgb('#ffe1b8')
    sun.rotation_euler = (math.radians(55), 0, math.radians(200))
    scene.collection.objects.link(sun)
    w = bpy.data.worlds.new('w')
    scene.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (*srgb('#dfe6d6'), 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'AgX'
    scene.render.resolution_x, scene.render.resolution_y = 1280, 800
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
