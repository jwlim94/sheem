"""CS 142's auditorium for /portfolio/7, chapter 1 (BYU, Fall 2019).
Run: Blender -b --factory-startup --python art/portfolio-school/build_school.py
Writes public/models/portfolio-school/school.glb.

A big, dim, windowless, fan-shaped hall like the real one (from the user's
photos and memory), as a cut-away diorama in the room's soft style:
- ten raked rows in three sections (9 seats in the centre, 6 each side,
  seats sized for the 1.38x hero): the centre runs straight, the left and
  right sections turn toward the stage, so the stepped aisles between them
  are wide at the back and narrow at the front (warm step lights);
- side walls following the side sections, densely covered in black pyramid
  acoustic foam (drawn live), capped by a wooden rail; a wide flat front floor and a raised stage with steps at both
  ends; three long whiteboards above it (the CS 142 slide is projected live
  in SchoolScene.tsx), the lectern on the left;
- at the back, a deep walkway at the top row's height (room to stand), a
  doorway at the top of each aisle onto a long, bright, roofed entrance
  corridor, and the projection booth in the middle
  (tinted window, glowing monitors, console, the projector behind the glass,
  doorways in its sides always open).
The seats are not baked in: one seat ('SeatTemplate') and its folded tablet
arm ('SeatTablet') are exported at the origin and instanced by Seats.tsx.
Layout numbers mirror src/portfolio/room/hall.ts.
"""
import bpy, bmesh, math
from mathutils import Matrix
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/portfolio-school/school.glb'

# Mirrors src/portfolio/room/hall.ts.
PITCH, RISE, ROWS = 1.5, 0.34, 10
ANGLE = 0.24  # side sections' turn toward the stage
FRONT_X, BACK_X = 9.8, -18.7
ROW0_FRONT = 0.75
STAGE_X0, STAGE_H = 5.6, 0.55
WALL_H = 9.4  # above the front floor (the back walkway is 3.06 up)
SEAT_W = 0.98  # seat spacing, sized for the 1.38x hero
CENTRE_Z, AISLE, SIDE_W = 4.5, 1.5, 6 * SEAT_W + 0.3
# The Typing clip comes from the room's tall desk chair: seated, its feet
# hang 0.23 m up. Here he sits 0.17 m lower and 0.15 m further back than a
# seat's centre (hall.ts SCHOOL_SEAT), so his slippers reach the floor and his
# back meets the backrest; the cushion sits just under his hips (hip sockets
# 0.42 m up), and his desk stays at his hands (0.75 m).
SEAT_TOP, DESK_TOP = 0.37, 0.72  # DESK_TOP: hall.ts SCHOOL_DESK_Y (0.89 above the hero's seat, which sits 0.17 low)
HERO_BACK, HERO_DROP = 0.15, 0.17
HERO_ROW = 3
HERO = (-PITCH * HERO_ROW - HERO_BACK, RISE * HERO_ROW, SEAT_W * 4)  # centre section, by the right aisle
BACK_WALK_X, DOOR_Z, DOOR_W, DOOR_H = -14.6, 7.0, 1.8, 3.3
BOARDS, BOARD_Y = [(-9.0, -3.15), (-2.95, 2.95), (3.15, 9.0)], (1.75, 5.35)
LECTERN = (STAGE_X0 - 1.6, 0.0, -10.4)  # on the floor by the left stage steps
BOOTH_X1, BOOTH_Z = BACK_X + 2.0, 2.6
BOOTH_FLOOR = RISE * (ROWS - 1)
C, S = math.cos(ANGLE), math.sin(ANGLE)


def side_frame(side):
    """Pivot (front inner corner), back and out directions (three.js x, z), yaw."""
    return (ROW0_FRONT, side * (CENTRE_Z + AISLE)), (-C, side * S), (S, side * C), side * ANGLE


def wall_line(side):
    """The side wall's face: the side section's outer edge plus a 0.9 m walk."""
    (px, pz), (bx, bz), (ox, oz), _ = side_frame(side)
    fx, fz = px + ox * (SIDE_W + 0.9), pz + oz * (SIDE_W + 0.9)
    t_front, t_back = -(FRONT_X - fx) / C, (fx - BACK_X) / C
    return (fx + bx * t_front, fz + bz * t_front), (fx + bx * t_back, fz + bz * t_back)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


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


def box(name, size, pos, color, rough=0.75, radius=0.0, mat=None, tilt_z=0.0, yaw=0.0):
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
    for poly in o.data.polygons:
        poly.use_smooth = True
    if tilt_z:
        o.rotation_euler.y = -tilt_z  # three.js rotation about z (pitch back)
    if yaw:
        o.rotation_euler.z = yaw  # three.js rotation about y
    o.data.materials.append(mat or material(name, color, rough))
    return o


# Palette (after the real room): beige plaster, a wooden rail, grey upholstered
# seats with wooden tablet arms, blue-grey carpet.
PLASTER = '#cdc5b3'
WOOD, WOOD_DARK = '#c09062', '#8d6644'
SEAT, SEAT_BACK, FRAME = '#7b8088', '#868b93', '#3d4148'
CARPET = '#4e5769'
wood = material('Wood', WOOD, 0.55)
wood_dark = material('Wood trim', WOOD_DARK, 0.6)
seat_m = material('Seat fabric', SEAT, 0.95)
back_m = material('Seat back', SEAT_BACK, 0.95)
frame_m = material('Seat frame', FRAME, 0.5)
carpet = material('Carpet', CARPET, 0.97)
aisle_m = material('Aisle carpet', '#475064', 0.97)
wall = material('Wall', PLASTER, 0.9)
step_light = material('Step light', '#ffcf8a', 0.4, emit=2.0)
TOP = RISE * (ROWS - 1)
(_, LBZ) = wall_line(-1)[1]
HALF_W = -LBZ + 0.3  # half width at the back

# The front floor (and everything under the tiers).
box('Floor', (FRONT_X - BACK_X + 0.4, 0.1, 2 * HALF_W + 0.4), ((FRONT_X + BACK_X) / 2, -0.05, 0), CARPET, mat=carpet)

# Centre section tiers (the last one runs back to the walkway).
for i in range(1, ROWS):
    x1 = ROW0_FRONT - PITCH * i
    x0 = BACK_WALK_X if i == ROWS - 1 else x1 - PITCH
    box(f'Tier C{i}', (x1 - x0, RISE * i, 2 * CENTRE_Z), ((x0 + x1) / 2, RISE * i / 2, 0), CARPET, mat=carpet)

# Side section tiers: the same bands, turned toward the stage about the front
# inner corner (the last one runs on under the walkway).
for side in (-1, 1):
    (px, pz), (bx, bz), (ox, oz), yaw = side_frame(side)
    for i in range(1, ROWS):
        a0, a1 = PITCH * i, PITCH * (i + 1) if i < ROWS - 1 else PITCH * i + 4.2
        a, b = (a0 + a1) / 2, SIDE_W / 2
        cx, cz = px + bx * a + ox * b, pz + bz * a + oz * b
        # The last one runs on under the walkway, a little lower so the two
        # never share a plane (that flickers at a distance).
        h = RISE * i - (0.02 if i == ROWS - 1 else 0.0)
        box(f'Tier S{side}{i}', (a1 - a0, h, SIDE_W), (cx, h / 2, cz), CARPET, mat=carpet, yaw=yaw)
    # The aisle between it and the centre: straight steps, a hair lower so the
    # turned tiers win where they overlap, wide at the back, narrow in front.
    for i in range(1, ROWS):
        x1 = ROW0_FRONT - PITCH * i
        x0 = BACK_WALK_X if i == ROWS - 1 else x1 - PITCH
        z_out = CENTRE_Z + AISLE + (ROW0_FRONT - x0) * math.tan(ANGLE) + 0.5
        h = RISE * i - 0.02
        box(f'Aisle {side}{i}', (x1 - x0, h, z_out - CENTRE_Z), ((x0 + x1) / 2, h / 2, side * (CENTRE_Z + z_out) / 2),
            '#475064', mat=aisle_m)
        for zz in (CENTRE_Z + 0.25,):
            box(f'Step light {side}{i}', (0.02, 0.05, 0.22), (x1 + 0.011, h - 0.08, side * zz), '#ffcf8a', mat=step_light)

# The back walkway at the top row's height, across the full width.
box('Back walkway', (BACK_WALK_X - BACK_X, TOP, 2 * HALF_W), ((BACK_WALK_X + BACK_X) / 2, TOP / 2, 0), CARPET,
    mat=carpet)

# The stage along the front wall, with steps up at both ends.
FW = -wall_line(-1)[0][1]  # half width at the front wall
box('Stage', (FRONT_X - STAGE_X0, STAGE_H, 2 * FW), ((FRONT_X + STAGE_X0) / 2, STAGE_H / 2, 0), CARPET, mat=carpet)
# A dark rubber nosing along its front edge, as on real stages (a wood strip
# here caught the stage light as a glowing orange line, striped by shadow
# acne along its thin face). It wraps the edge, standing 4 mm proud of the
# stage's top and front: faces flush with them flickered (z-fighting).
box('Stage edge', (0.052, 0.056, 2 * FW + 0.01), (STAGE_X0 + 0.014, STAGE_H - 0.024, 0), '#25272c',
    mat=material('Stage nosing', '#25272c', 0.92))
for side in (-1, 1):
    zc = side * (FW - 1.4)
    box(f'Stage step low {side}', (0.7, STAGE_H / 3, 1.6), (STAGE_X0 - 0.35, STAGE_H / 6, zc), CARPET, mat=carpet)
    box(f'Stage step high {side}', (0.35, 2 * STAGE_H / 3, 1.6), (STAGE_X0 - 0.175, STAGE_H / 3, zc), CARPET, mat=carpet)

# Side walls along the side sections (the right side is left open for the
# camera): plaster under black acoustic foam (drawn live in SchoolScene.tsx),
# capped by a wooden rail.
T = 0.25
(fx, fz), (bx2, bz2) = wall_line(-1)
length = math.hypot(fx - bx2, fz - bz2)
wyaw = math.atan2(-(fz - bz2), fx - bx2)  # along the wall, front to back
box('Side wall', (length, WALL_H, T), ((fx + bx2) / 2, WALL_H / 2, (fz + bz2) / 2 - T / 2), PLASTER, mat=wall, yaw=wyaw)
box('Side rail', (length, 0.1, 0.06), ((fx + bx2) / 2, 9.33, (fz + bz2) / 2 + 0.04), WOOD_DARK, mat=wood_dark, yaw=wyaw)

# Front wall: plaster, three long whiteboards over the stage (the slide is
# projected on the middle one), a marker tray and a baseboard.
box('Front wall', (T, WALL_H, 2 * FW), (FRONT_X + T / 2, WALL_H / 2, 0), PLASTER, mat=wall)
board = material('Whiteboard', '#efefeb', 0.6)  # satin, so lights don't flare on it
trim = material('Board trim', '#b4b7bb', 0.35)
for z0, z1 in BOARDS:
    w, h, yc = z1 - z0, BOARD_Y[1] - BOARD_Y[0], (BOARD_Y[0] + BOARD_Y[1]) / 2
    box(f'Whiteboard {z0}', (0.03, h, w), (FRONT_X - 0.015, yc, (z0 + z1) / 2), '#efefeb', mat=board)
    box(f'Whiteboard frame {z0}', (0.04, h + 0.08, w + 0.06), (FRONT_X - 0.005, yc, (z0 + z1) / 2), '#b4b7bb', mat=trim)
    # A deeper aluminium tray with a front lip, to hold the markers.
    ty = BOARD_Y[0] - 0.06
    box(f'Marker tray {z0}', (0.16, 0.035, w), (FRONT_X - 0.08, ty, (z0 + z1) / 2), '#b4b7bb', radius=0.006, mat=trim)
    box(f'Marker tray lip {z0}', (0.015, 0.05, w), (FRONT_X - 0.155, ty + 0.025, (z0 + z1) / 2), '#b4b7bb', mat=trim)

# Markers and an eraser on the side boards' trays (sized for the 1.38x hero).
marker_cap = {'black': '#1e1f22', 'blue': '#2f5fb8', 'red': '#c23b32', 'green': '#2f8a4a'}
def marker(name, color, x, y, z, yaw):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.012, depth=0.15, location=(x, -z, y),
                                        rotation=(math.pi / 2, 0, yaw))
    b = bpy.context.object
    b.name = f'Marker {name}'
    b.data.materials.append(material('Marker body', '#efefeb', 0.4))
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0135, depth=0.045,
                                        location=(x - 0.07 * math.sin(yaw), -(z + 0.07 * math.cos(yaw)), y),
                                        rotation=(math.pi / 2, 0, yaw))
    c = bpy.context.object
    c.name = f'Marker cap {name}'
    c.data.materials.append(material(f'Marker cap {color}', marker_cap[color], 0.35))
    for o in (b, c):
        for poly in o.data.polygons:
            poly.use_smooth = True
tray_y = BOARD_Y[0] - 0.06 + 0.03
for zb, items in ((BOARDS[0], ('black', 'blue', 'red')), (BOARDS[2], ('black', 'green'))):
    zc0 = zb[0] + 0.9
    for k, col in enumerate(items):
        marker(f'{zb[0]} {k}', col, FRONT_X - 0.08, tray_y, zc0 + k * 0.22, 0.12 * (k - 1))
    # The eraser: a dark felt base under a grey block.
    ez = zb[1] - 1.1
    box(f'Eraser {zb[0]}', (0.07, 0.04, 0.17), (FRONT_X - 0.08, tray_y + 0.035, ez), '#5d6168', radius=0.01,
        mat=material('Eraser', '#5d6168', 0.6))
    box(f'Eraser felt {zb[0]}', (0.07, 0.015, 0.17), (FRONT_X - 0.08, tray_y + 0.008, ez), '#2a2b2e',
        mat=material('Eraser felt', '#2a2b2e', 0.95))

# A pull-down projection screen over the middle board: its case under the
# rail, the matte white fabric hanging in front of the board, a weighted bar
# at the bottom (the slide is projected on it live).
SCR_X, SCR_Y, SCR_W = FRONT_X - 0.17, (1.45, 5.5), 5.6  # hangs below the boards' line
box('Screen case', (0.2, 0.18, SCR_W + 0.3), (SCR_X, SCR_Y[1] + 0.09, 0), '#d8d8d4', radius=0.04)
box('Screen fabric', (0.01, SCR_Y[1] - SCR_Y[0], SCR_W), (SCR_X, sum(SCR_Y) / 2, 0), '#f1f1ee',
    mat=material('Screen fabric', '#f1f1ee', 0.95))
box('Screen bar', (0.035, 0.035, SCR_W + 0.04), (SCR_X, SCR_Y[0] - 0.015, 0), '#3d4148', radius=0.012, mat=frame_m)
box('Screen pull', (0.02, 0.18, 0.02), (SCR_X, SCR_Y[0] - 0.12, 0), '#3d4148', mat=frame_m)

# The instructor's lectern on the floor below the stage, by the left stage
# steps toward the side wall: a tall wooden podium, the professor's laptop
# open on it (screen toward the stage side, where he stands) and his notes.
lx, ly, lz = LECTERN
box('Lectern', (0.6, 1.12, 0.78), (lx, ly + 0.56, lz), WOOD_DARK, radius=0.02, mat=wood_dark)
box('Lectern top', (0.7, 0.04, 0.88), (lx - 0.02, ly + 1.14, lz), WOOD, radius=0.01, mat=wood)
alu_p = material('Professor laptop', '#b9bcc0', 0.35)
box('Professor laptop base', (0.24, 0.018, 0.34), (lx + 0.02, ly + 1.169, lz + 0.12), '#b9bcc0', radius=0.006,
    mat=alu_p)
box('Professor laptop lid', (0.012, 0.23, 0.34), (lx - 0.105, ly + 1.285, lz + 0.12), '#b9bcc0', radius=0.005,
    mat=alu_p, tilt_z=math.radians(14))
box('Professor laptop screen', (0.004, 0.2, 0.31), (lx - 0.097, ly + 1.285, lz + 0.12), '#a9bde6',
    mat=material('Professor screen', '#a9bde6', 0.4, emit=1.6), tilt_z=math.radians(14))
box('Professor notes', (0.22, 0.01, 0.3), (lx + 0.05, ly + 1.165, lz - 0.25), '#f1efe8', radius=0.003)

# The back wall with a doorway at the top of each aisle, and a long bright
# corridor beyond each.
bw_h = WALL_H
edges = [-HALF_W, -DOOR_Z - DOOR_W / 2, -DOOR_Z + DOOR_W / 2, DOOR_Z - DOOR_W / 2, DOOR_Z + DOOR_W / 2, HALF_W]
for z0, z1 in zip(edges[0::2], edges[1::2]):
    box(f'Back wall {z0:.1f}', (T, bw_h, z1 - z0), (BACK_X - T / 2, bw_h / 2, (z0 + z1) / 2), PLASTER, mat=wall)
switch_plate = material('Switch plate', '#efece4', 0.4)
switch_led = material('Switch led', '#7dff6a', 0.3, emit=3.0)
roof = material('Corridor roof', '#3a3b40', 0.9)
# The dim entrance passage: one even, quiet tone throughout.
def unlit(name, hexcolor, strength=1.0):
    """A flat, self-lit colour: black base, so the hall's lights and shadows
    don't fall on it (they cut odd diagonal bands across the passage)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0, 0, 0, 1)
    b.inputs['Emission Color'].default_value = (*srgb(hexcolor), 1)
    b.inputs['Emission Strength'].default_value = strength
    b.inputs['Roughness'].default_value = 1.0
    return m


def spill(name, near, far):
    """Like unlit(), but a gradient along the passage (an emissive strip
    texture, u 0 at the hall's door to 1 at the bright cross corridor): its
    own dim tone for most of the way, then warming and brightening over the
    last few metres as the corridor's light spills in. Without it the
    corridor's far wall sat behind the dark passage like a lit panel."""
    import numpy as np
    n = 256
    u = (np.arange(n) + 0.5) / n
    t = np.clip((u - 0.35) / 0.65, 0, 1)
    t = t * t * (3 - 2 * t)  # smoothstep
    t = t ** 1.4
    # Stored as sRGB bytes, as three.js reads an emissive map.
    hx = lambda h: np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])  # noqa: E731
    a, b = hx(near), hx(far)
    rgb = a[None] * (1 - t[:, None]) + b[None] * t[:, None]
    img = bpy.data.images.new(f'{name} spill', n, 2)
    px = np.ones((2, n, 4), dtype=np.float32)
    px[..., :3] = rgb[None]
    img.pixels.foreach_set(px.ravel())
    img.pack()
    m = unlit(name, '#ffffff')
    nt = m.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.extension = 'EXTEND'
    b_ = next(nd for nd in nt.nodes if nd.type == 'BSDF_PRINCIPLED')
    nt.links.new(tex.outputs['Color'], b_.inputs['Emission Color'])
    return m


def passage_uv(o, x_door, length):
    """u along the passage, from its door (0) to the cross corridor (1)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            co = o.matrix_world @ l.vert.co
            l[uv].uv = (min(1.0, max(0.0, (x_door - co.x) / length)), 0.5)
    bm.to_mesh(o.data)
    bm.free()
    return o


# Dim tones near the door; at the far end the warm white of the lit corridor
# (its walls glow about #c0bdb5 here), the floor catching the most.
passage_floor = spill('Passage floor', '#1c1d22', '#8a867e')
passage_ceiling = spill('Passage ceiling', '#141316', '#5e5b57')
passage_wall = spill('Passage wall', '#29272a', '#9a968e')
for side in (-1, 1):
    zc = side * DOOR_Z
    box(f'Back wall under door {side}', (T, TOP, DOOR_W), (BACK_X - T / 2, TOP / 2, zc), PLASTER, mat=wall)
    box(f'Back wall over door {side}', (T, bw_h - TOP - DOOR_H, DOOR_W), (BACK_X - T / 2, (TOP + DOOR_H + bw_h) / 2, zc),
        PLASTER, mat=wall)
    for dz in (-DOOR_W / 2, DOOR_W / 2):
        box(f'Door jamb {side} {dz}', (T + 0.04, DOOR_H, 0.08), (BACK_X - T / 2, TOP + DOOR_H / 2, zc + dz), FRAME,
            mat=frame_m)
        box(f'Door casing {side} {dz}', (0.03, DOOR_H + 0.06, 0.1), (BACK_X + 0.015, TOP + DOOR_H / 2, zc + dz * 1.08),
            '#6b5644', mat=wood_dark)
    box(f'Door casing head {side}', (0.03, 0.1, DOOR_W + 0.3), (BACK_X + 0.015, TOP + DOOR_H + 0.05, zc), '#6b5644',
        mat=wood_dark)
    # The light switches inside the door, on the wall toward the middle: a
    # three-gang plate (house lights, stage, projector) with a small dimmer,
    # and a keyed AV panel below it.
    sz = zc - side * (DOOR_W / 2 + 0.45)
    sy = TOP + 1.25
    box(f'Switch plate {side}', (0.012, 0.13, 0.22), (BACK_X + 0.006, sy, sz), '#efece4', radius=0.004,
        mat=switch_plate)
    for k, dzs in enumerate((-0.065, 0.0, 0.065)):
        # A dark gap around each rocker, so the three paddles read.
        box(f'Switch recess {side} {k}', (0.004, 0.085, 0.05), (BACK_X + 0.013, sy, sz + dzs), '#8f8a80',
            mat=material('Switch recess', '#8f8a80', 0.6))
        box(f'Switch rocker {side} {k}', (0.014, 0.075, 0.04), (BACK_X + 0.019, sy, sz + dzs), '#fbfaf6', radius=0.005,
            mat=material('Switch rocker', '#fbfaf6', 0.35), tilt_z=0.08 if k else -0.08)
    box(f'Switch led {side}', (0.004, 0.008, 0.008), (BACK_X + 0.02, sy - 0.045, sz - 0.065), '#7dff6a', mat=switch_led)
    box(f'AV panel {side}', (0.015, 0.2, 0.14), (BACK_X + 0.008, sy - 0.32, sz), '#2b2d31', radius=0.006, mat=frame_m)
    box(f'AV keyhole {side}', (0.004, 0.025, 0.025), (BACK_X + 0.017, sy - 0.27, sz), '#b9b6ae', radius=0.006)
    for k in range(2):
        box(f'AV button {side} {k}', (0.006, 0.03, 0.05), (BACK_X + 0.018, sy - 0.35 - k * 0.045, sz), '#5c6168',
            radius=0.005)
    # The entrance passage beyond: long, straight out from the door and dim
    # (dark carpet, dark walls, one faint downlight), brightening only near
    # its far end, where it meets the lit cross corridor (spill()).
    P, PW, PH = 6.0, 2.4, 3.4
    x0 = BACK_X - T
    xm = x0 - P / 2
    passage_uv(box(f'Passage floor {side}', (P, 0.06, PW), (xm, TOP - 0.03, zc), '#2b2d33', mat=passage_floor), x0, P)
    passage_uv(box(f'Passage ceiling {side}', (P, 0.08, PW), (xm, TOP + PH, zc), '#2a282b', mat=passage_ceiling),
               x0, P)
    for dz in (-1, 1):
        passage_uv(box(f'Passage wall {side} {dz}', (P, PH, 0.1), (xm, TOP + PH / 2, zc + dz * PW / 2), '#4a4540',
                       mat=passage_wall), x0, P)
        box(f'Passage base {side} {dz}', (P, 0.12, 0.13), (xm, TOP + 0.06, zc + dz * (PW / 2 - 0.02)), '#1f1e21',
            mat=frame_m)
    box(f'Passage downlight {side}', (0.25, 0.02, 0.25), (x0 - P * 0.45, TOP + PH - 0.05, zc), '#ffe2b8',
        mat=material('Passage downlight', '#ffe2b8', 0.3, emit=2.0))
    box(f'Passage roof {side}', (P + 0.1, 0.12, PW + 0.3), (x0 - P / 2, TOP + PH + 0.12, zc), '#3a3b40', mat=roof)

# The cross corridor the two passages open onto: running sideways (along z),
# bright, its far wall seen head-on at the end of each passage (pale plaster
# over a wood wainscot with a chair rail, classroom doors), light panels down
# its ceiling and a polished floor. Self-lit, no extra lights.
CX0 = BACK_X - T - 6.0  # its near wall (where the passages open)
CXW, CH, CZ = 3.2, 3.6, 2 * DOOR_Z + 9.0  # depth, height, length
cxc = CX0 - CXW / 2
def block_wall(name, emit, tint=(1.0, 0.99, 0.955), base=0.93):
    """Painted concrete-block wall, as in campus corridors: 0.4 x 0.2 m blocks in
    running bond with soft recessed joints and a faint mottle (one 1.6 m tile,
    drawn here, repeated by world-scaled UVs). Self-lit like the corridor."""
    import numpy as np
    n = 512
    rng = np.random.default_rng(11)
    yy, xx = np.mgrid[0:n, 0:n] / n * 1.6  # metres
    course = np.floor(yy / 0.2)
    bx = (xx + (course % 2) * 0.2) % 0.4
    by = yy % 0.2
    d = np.minimum(np.minimum(bx, 0.4 - bx), np.minimum(by, 0.2 - by))  # to the nearest joint
    joint = np.clip(1 - d / 0.012, 0, 1)
    edge = np.clip(1 - d / 0.03, 0, 1) * 0.04  # slightly rounded block edges
    blot = rng.normal(0, 1, (32, 32))
    blot = np.kron(blot, np.ones((16, 16)))
    v = base - 0.045 * base * joint - 0.4 * edge + 0.005 * blot + rng.normal(0, 0.004, (n, n))  # subtle
    rgb = np.stack([v * tint[0], v * tint[1], v * tint[2]], -1).clip(0, 1)
    rgba = np.concatenate([rgb, np.ones((n, n, 1))], -1)[::-1].astype(np.float32)
    img = bpy.data.images.new(f'{name} tex', n, n)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
    tex = m.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = img
    m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = emit
    bsdf.inputs['Roughness'].default_value = 0.85
    return m


def world_uv(o, size=1.6):
    """UVs in metres / size, projected per face along its main axis."""
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
    return o


cor_wall = block_wall('Cross wall', 0.75)


def vct_floor(name, emit):
    """Speckled vinyl tile, 0.3 m squares with fine seams and a few darker
    accent tiles (one 2.4 m tile), lightly glossy."""
    import numpy as np
    n = 512
    rng = np.random.default_rng(23)
    yy, xx = np.mgrid[0:n, 0:n] / n * 2.4
    tx, ty = np.floor(xx / 0.3), np.floor(yy / 0.3)
    tile = (tx * 8 + ty).astype(int)
    tone = rng.normal(0, 1, 64)[tile % 64] * 0.015
    accent = (rng.random(64)[tile % 64] < 0.08) * -0.18
    dx, dy = xx % 0.3, yy % 0.3
    seam = np.clip(1 - np.minimum(np.minimum(dx, 0.3 - dx), np.minimum(dy, 0.3 - dy)) / 0.003, 0, 1)
    speck = (rng.random((n, n)) < 0.06) * rng.normal(0, 0.12, (n, n))
    v = 0.78 + tone + accent + speck - 0.12 * seam
    rgb = np.stack([v, v * 0.985, v * 0.95], -1).clip(0, 1)
    rgba = np.concatenate([rgb, np.ones((n, n, 1))], -1).astype(np.float32)
    img = bpy.data.images.new(f'{name} tex', n, n)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
    t = m.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = img
    m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    m.node_tree.links.new(t.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = emit
    b.inputs['Roughness'].default_value = 0.35
    return m


cor_floor = vct_floor('Cross floor', 0.45)
world_uv(box('Cross floor', (CXW, 0.06, CZ), (cxc, TOP - 0.03, 0), '#cbc6bd', mat=cor_floor), 2.4)
box('Cross ceiling', (CXW, 0.08, CZ), (cxc, TOP + CH, 0), '#e6e3dc', mat=material('Cross ceiling', '#e6e3dc', 0.9, emit=0.55))
world_uv(box('Cross far wall', (0.1, CH - 1.05, CZ), (CX0 - CXW, TOP + 1.05 + (CH - 1.05) / 2, 0), '#eeebe4', mat=cor_wall))
world_uv(box('Cross far wainscot', (0.1, 1.05, CZ), (CX0 - CXW, TOP + 0.525, 0), '#eeebe4', mat=cor_wall))
# One warm wood band along the white wall at hip height (as in the real
# building).
box('Cross far rail', (0.05, 0.26, CZ), (CX0 - CXW + 0.075, TOP + 1.0, 0), '#c48d55', radius=0.012,
    mat=material('Wood band', '#c48d55', 0.5, emit=0.42))
box('Cross far base', (0.14, 0.1, CZ), (CX0 - CXW + 0.02, TOP + 0.05, 0), '#2e3036',
    mat=material('Cove base', '#2e3036', 0.6, emit=0.15))
for zz in (-CZ / 2, CZ / 2):
    world_uv(box(f'Cross end {zz}', (CXW, CH, 0.1), (cxc, TOP + CH / 2, zz), '#eeebe4', mat=cor_wall))
# Its near wall, with an opening for each passage.
nedges = [-CZ / 2, -DOOR_Z - 1.2, -DOOR_Z + 1.2, DOOR_Z - 1.2, DOOR_Z + 1.2, CZ / 2]
for z0, z1 in zip(nedges[0::2], nedges[1::2]):
    world_uv(box(f'Cross near wall {z0:.1f}', (0.1, CH, z1 - z0), (CX0, TOP + CH / 2, (z0 + z1) / 2), '#eeebe4', mat=cor_wall))
for zz in (-DOOR_Z, DOOR_Z):
    world_uv(box(f'Cross near over {zz}', (0.1, CH - 3.4, 2.4), (CX0, TOP + 3.4 + (CH - 3.4) / 2, zz), '#eeebe4', mat=cor_wall))
k = 0
for zl in range(int(-CZ / 2) + 1, int(CZ / 2), 2):
    box(f'Cross light {zl}', (0.9, 0.02, 0.6), (cxc, TOP + CH - 0.05, zl), '#fff6e6',
        mat=material('Corridor light', '#fff6e6', 0.3, emit=3.0))
# Classroom doors in the far wall, off the passages' axes.
for zd in (-DOOR_Z - 4.0, -DOOR_Z + 3.0, DOOR_Z - 3.0, DOOR_Z + 4.0):
    box(f'Cross door {zd}', (0.03, 2.35, 1.0), (CX0 - CXW + 0.09, TOP + 1.175, zd), '#6f5a45',
        mat=material('Cross door', '#6f5a45', 0.6, emit=0.25))
    box(f'Cross door frame {zd}', (0.02, 2.43, 1.12), (CX0 - CXW + 0.075, TOP + 1.215, zd), '#3a3633', mat=frame_m)
    box(f'Cross door plate {zd}', (0.012, 0.12, 0.18), (CX0 - CXW + 0.11, TOP + 1.6, zd + 0.72), '#d9d4c8',
        mat=material('Room plate', '#d9d4c8', 0.4, emit=0.4))
# A bulletin board on the far wall, facing the left passage.
box('Cross board', (0.03, 0.9, 1.4), (CX0 - CXW + 0.08, TOP + 1.75, -DOOR_Z), '#b48a5c',
    mat=material('Cork', '#b48a5c', 0.9, emit=0.3))
for k, (dy, dz, col) in enumerate(((0.15, -0.35, '#f3efe6'), (-0.1, 0.1, '#bcd2ea'), (0.18, 0.4, '#f2d36b'),
                                   (-0.2, -0.2, '#f3efe6'))):
    box(f'Cross flyer {k}', (0.01, 0.3, 0.22), (CX0 - CXW + 0.1, TOP + 1.75 + dy, -DOOR_Z + dz), col,
        mat=material(f'Flyer {col}', col, 0.8, emit=0.35))
box('Cross roof', (CXW + 0.3, 0.12, CZ + 0.2), (cxc, TOP + CH + 0.12, 0), '#3a3b40', mat=roof)

# The projection / AV booth at the back centre, on the walkway.
bf, bh = BOOTH_FLOOR, 3.1
booth = material('Booth', '#b9b1a0', 0.9)
box('Booth wall low', (0.2, 1.25, 2 * BOOTH_Z), (BOOTH_X1 - 0.1, bf + 0.625, 0), '#b9b1a0', mat=booth)
box('Booth wall high', (0.2, bh - 2.55, 2 * BOOTH_Z), (BOOTH_X1 - 0.1, bf + (2.55 + bh) / 2, 0), '#b9b1a0', mat=booth)
# Its sides stay open: a doorway in each side wall, always open (no door).
for side in (-1, 1):
    zw = side * (BOOTH_Z + 0.1)
    box(f'Booth side back {side}', (0.6, bh, 0.2), (BACK_X + 0.3, bf + bh / 2, zw), '#b9b1a0', mat=booth)
    box(f'Booth side front {side}', (BOOTH_X1 - BACK_X - 1.6, bh, 0.2), ((BOOTH_X1 + BACK_X + 1.6) / 2, bf + bh / 2, zw),
        '#b9b1a0', mat=booth)
    box(f'Booth lintel {side}', (1.0, bh - 2.2, 0.2), (BACK_X + 1.1, bf + (2.2 + bh) / 2, zw), '#b9b1a0', mat=booth)
box('Booth roof', (BOOTH_X1 - BACK_X + 0.2, 0.15, 2 * BOOTH_Z + 0.4), ((BOOTH_X1 + BACK_X) / 2, bf + bh + 0.075, 0),
    '#8f897d', mat=material('Booth roof', '#8f897d', 0.9))
glass = material('Booth glass', '#28303c', 0.15)
box('Booth glass', (0.03, 1.3, 2 * BOOTH_Z - 0.1), (BOOTH_X1 - 0.05, bf + 1.9, 0), '#28303c', mat=glass)
for zz in (-BOOTH_Z + 0.05, 0.0, BOOTH_Z - 0.05):
    box(f'Booth mullion {zz}', (0.06, 1.3, 0.06), (BOOTH_X1 - 0.02, bf + 1.9, zz), '#3d4148', mat=frame_m)
screen_glow = material('Booth monitor', '#6f8fd6', 0.4, emit=2.5)
box('Booth console', (0.7, 0.85, 3.6), (BOOTH_X1 - 0.75, bf + 0.425, 0), '#2e3137', radius=0.02, mat=frame_m)
for zz in (-1.2, -0.4, 0.8, 1.5):
    box(f'Booth monitor {zz}', (0.03, 0.34, 0.55), (BOOTH_X1 - 0.95, bf + 1.15, zz), '#6f8fd6', mat=screen_glow)
box('Projector', (0.55, 0.22, 0.48), (BOOTH_X1 - 0.45, bf + 2.1, 0), '#d9d9d4', radius=0.03)
box('Projector lens', (0.06, 0.11, 0.11), (BOOTH_X1 - 0.15, bf + 2.1, 0), '#1d1f23', radius=0.01)


# The seat to instance: grey upholstered, facing +X, its wooden tablet arm
# folded down beside the right armrest (a separate template, so his seat can
# go without it).
def seat_template():
    """Scaled for the 1.38x hero: a wide cushion, a tall back that holds his
    shoulders, armrests at his elbows."""
    parts = [
        box('cushion', (0.64, 0.13, 0.68), (-0.03, SEAT_TOP - 0.065, 0), SEAT, radius=0.055, mat=seat_m),
        box('back', (0.15, 0.98, 0.7), (-0.36, SEAT_TOP + 0.47, 0), SEAT_BACK, radius=0.06, mat=back_m,
            tilt_z=math.radians(9)),
        box('shell', (0.05, 0.92, 0.68), (-0.46, SEAT_TOP + 0.44, 0), FRAME, radius=0.018, mat=frame_m,
            tilt_z=math.radians(9)),
    ]
    for side in (-1, 1):
        parts.append(box(f'standard {side}', (0.62, SEAT_TOP + 0.24, 0.07), (-0.08, (SEAT_TOP + 0.24) / 2, side * 0.385),
                         FRAME, radius=0.015, mat=frame_m))
        parts.append(box(f'arm {side}', (0.62, 0.06, 0.1), (-0.05, SEAT_TOP + 0.27, side * 0.385), WOOD_DARK,
                         radius=0.02, mat=wood_dark))
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.context.view_layer.objects.active = parts[0]
    for o in parts:
        o.select_set(True)
    bpy.ops.object.join()
    t = bpy.context.object
    t.name = 'SeatTemplate'
    tab = box('SeatTablet', (0.5, 0.42, 0.03), (0.0, SEAT_TOP + 0.03, 0.45), WOOD, radius=0.012, mat=wood)
    return [t, tab]


templates = seat_template()

# His raised tablet arm and laptop (the screen is drawn live; no mouse: he
# only types on the laptop here).
hx, hy, hz = HERO
desk_y = hy + DESK_TOP
# The tablet swings up from the right armrest: its board runs from his lap
# over to the armrest line, and a hinge stem joins its right edge to the
# armrest's front tip (the seat is 0.15 m ahead of him, so the tip is at
# hx + 0.41), so it reads as one piece with the seat.
arm_tip_x, arm_z, arm_top = hx + 0.41, hz + 0.385, hy + SEAT_TOP + 0.30
box('Tablet arm', (0.66, 0.028, 0.80), (hx + 0.79, desk_y - 0.014, hz + 0.03), WOOD, radius=0.012, mat=wood)
box('Tablet hinge', (0.2, desk_y - 0.028 - arm_top + 0.02, 0.1),
    (arm_tip_x + 0.04, (desk_y - 0.028 + arm_top) / 2, arm_z), FRAME, radius=0.015, mat=frame_m)
box('Tablet pivot', (0.07, 0.07, 0.12), (arm_tip_x - 0.02, arm_top + 0.01, arm_z), WOOD_DARK, radius=0.02,
    mat=wood_dark)
alu = material('Laptop', '#c8cacd', 0.35)
# Under his fingertips (hall.ts LAPTOP, SCHOOL_HINGE_X: the hinge 0.90 m ahead
# of him, 0.525 x 0.36 m, centred 0.09 m to his left).
# His tumbler (art/portfolio-room/tumbler.py, the one on the room's bookcase)
# in the free corner of the tablet, right of the laptop.
import sys
sys.path.insert(0, str(ROOT / 'art/portfolio-room'))
from tumbler import build_tumbler
build_tumbler('Tumbler', (hx + 0.86, -(hz + 0.3), desk_y))
LAP_W, LAP_D, LAP_BASE, LAP_HINGE, LAP_Z = 0.525, 0.36, 0.02, hx + 0.9, hz - 0.09
lid_t = math.radians(14)
box('Laptop base', (LAP_D, LAP_BASE, LAP_W), (LAP_HINGE - LAP_D / 2, desk_y + LAP_BASE / 2, LAP_Z), '#c8cacd',
    radius=0.009, mat=alu)
box('Laptop lid', (0.014, LAP_D, LAP_W), (LAP_HINGE + math.sin(lid_t) * LAP_D / 2,
                                          desk_y + LAP_BASE + math.cos(lid_t) * LAP_D / 2, LAP_Z),
    '#c8cacd', radius=0.007, mat=alu, tilt_z=-lid_t)

def soft(name, size, pos, mat, radius, taper=0.0, level=2):
    """A soft, padded fabric volume: a bevelled box, optionally narrowing toward
    its top, smoothed by subdivision (three.js size/position)."""
    o = box(name, size, pos, '#ffffff', radius=radius, mat=mat)
    if taper:
        zs = [v.co.z for v in o.data.vertices]
        z0, z1 = min(zs), max(zs)
        for v in o.data.vertices:
            t = (v.co.z - z0) / max(z1 - z0, 1e-6)
            v.co.x *= 1 - 0.6 * taper * t
            v.co.y *= 1 - taper * t
    sub = o.modifiers.new('Soft', 'SUBSURF')
    sub.levels = sub.render_levels = level
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=sub.name)
    for poly in o.data.polygons:
        poly.use_smooth = True
    return o


def cord(name, pts, radius, mat):
    """A tube through three.js points (zips, straps, handles)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth, cu.bevel_resolution = radius, 3
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
    o = bpy.context.object
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def backpack(name, color, pos, lean=0.0, yaw=0.0):
    """A soft school backpack, built facing +X at the origin (three.js axes):
    a padded, slightly tapered body, a rounded front pocket with a small
    organiser pocket, zips over the top and across the pocket with pulls, a
    grab loop, padded shoulder straps and back panel, a stretch bottle pocket
    on one side and a darker base. Then leaned back by `lean` and turned by
    `yaw` (radians)."""
    fabric = material(f'{name} fabric', color, 0.9)
    shade = material(f'{name} panel', '#dcd9d1', 0.9)
    trim = material('Backpack trim', '#2a2c31', 0.7)
    base = material('Backpack base', '#34363b', 0.85)
    parts = [
        soft(f'{name} body', (0.24, 0.5, 0.36), (0, 0.27, 0), fabric, 0.09, taper=0.16),
        soft(f'{name} base', (0.2, 0.05, 0.3), (0.005, 0.03, 0), base, 0.025),
        soft(f'{name} pocket', (0.1, 0.25, 0.3), (0.12, 0.17, 0), fabric, 0.05),
        soft(f'{name} organiser', (0.05, 0.12, 0.2), (0.165, 0.2, 0), shade, 0.03),
        soft(f'{name} back panel', (0.035, 0.36, 0.26), (-0.12, 0.28, 0), shade, 0.016),
        # A flat stretch side pocket, sewn flush to the side panel.
        soft(f'{name} bottle pocket', (0.17, 0.19, 0.03), (0.0, 0.125, 0.171), shade, 0.012, level=1),
        box(f'{name} patch', (0.006, 0.035, 0.07), (0.192, 0.27, 0), '#2a2c31', radius=0.006, mat=trim),
    ]
    # The side pocket's elastic band along its open top, and the dark gap of
    # its opening just below.
    parts.append(cord(f'{name} pocket band', [(x, 0.215 - 0.01 * (x / 0.08) ** 2, 0.188) for x in
                                               [k * 0.01 - 0.08 for k in range(17)]], 0.007, trim))
    parts.append(box(f'{name} pocket mouth', (0.15, 0.012, 0.012), (0.0, 0.205, 0.181), '#1d1e21', mat=trim))
    # Main zip arcing over the top, front side, with two pulls.
    top = [(0.098 + 0.012 * math.cos(t), 0.37 + 0.13 * math.cos(t), 0.158 * math.sin(t)) for t in
           [math.radians(a) for a in range(-80, 81, 8)]]
    parts.append(cord(f'{name} zip', top, 0.0055, trim))
    for zz in (-0.04, 0.05):
        parts.append(box(f'{name} pull {zz}', (0.012, 0.045, 0.014), (0.115, 0.48, zz), '#2a2c31', radius=0.004,
                         mat=trim))
    # Pocket zip across its top, with a pull.
    pz = [(0.17 - 0.02 * abs(t), 0.29 - 0.015 * t * t, 0.13 * t) for t in [k / 8 for k in range(-8, 9)]]
    parts.append(cord(f'{name} pocket zip', pz, 0.005, trim))
    parts.append(box(f'{name} pocket pull', (0.012, 0.045, 0.014), (0.18, 0.265, 0.09), '#2a2c31', radius=0.004,
                     mat=trim))
    # Grab loop on top, toward the back.
    loop = [(-0.07, 0.52 + 0.05 * math.sin(t), 0.055 * math.cos(t)) for t in
            [math.radians(a) for a in range(0, 181, 15)]]
    parts.append(cord(f'{name} loop', loop, 0.011, trim))
    # Padded shoulder straps curving off the back.
    for sz in (-1, 1):
        strap = [(-0.13, 0.48, 0.07 * sz), (-0.17, 0.44, 0.08 * sz), (-0.2, 0.34, 0.095 * sz),
                 (-0.2, 0.22, 0.11 * sz), (-0.18, 0.11, 0.125 * sz), (-0.14, 0.05, 0.13 * sz)]
        parts.append(cord(f'{name} strap {sz}', strap, 0.02, trim))
    origin = parts[0].location.copy()  # the joined mesh is relative to this
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.data.transform(Matrix.Translation(origin))  # back to the backpack's own origin (its base)
    o.name = name
    x, y, z = pos
    o.location = (x, -z, y)
    # three.js: lean about z (top toward -X), then yaw about y.
    o.rotation_euler = (0.0, -lean, yaw)
    return o




# His white backpack (art/portfolio-room/backpack.py build_v2_backpack: the bag he wears, re-dressed with slack straps; the
# same one as in the room), set down on the floor by his seat.
import sys
sys.path.insert(0, str(ROOT / 'art/portfolio-room'))
from backpack import build_v2_backpack
# Leaning back-first against the outside of his seat's right standard (its
# outer face 0.42 m right of the seat's centre, armrest top 0.64 m up), as it
# leans on the desk in the room: its side, with the slipped strap, faces the
# stage (where the camera meets him), its front pocket the aisle; the top sags
# over the armrest.
BAG_GAP = 0.1  # the bag's origin to the seat's face
bag = build_v2_backpack(ROOT / 'art/portfolio-room/backpack-v2/source.glb', 'Backpack', height=0.7,
                          slump=0.12, wall_x=-BAG_GAP + 0.006, wall_top=SEAT_TOP + 0.28, show_side=1)
bag.location = (hx + 0.1, -(HERO[2] + 0.42 + BAG_GAP), hy)
bag.rotation_euler = (0.0, 0.0, -math.pi / 2)  # back (local -X) to the seat, local +Y to the stage

# Join everything static into one object (one draw call per material); the
# seat templates stay separate, at the origin, for instancing.
bpy.ops.object.select_all(action='DESELECT')
meshes = [o for o in scene.objects if o.type == 'MESH' and o not in templates]
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
bpy.context.object.name = 'Lecture hall'
bpy.context.view_layer.update()
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_yup=True, export_apply=True,
                          export_lights=False, export_cameras=False, export_image_format='WEBP',
                          export_image_quality=85)
print('SCHOOL_DONE', OUT.stat().st_size, 'objects', len(scene.objects))
