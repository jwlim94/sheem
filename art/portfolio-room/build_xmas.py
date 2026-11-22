"""Christmas in his room, for the story's ending (2026-11-22, the user's call:
back to the room, dressed for Christmas and winter, a Christmas song to close
on). Kenney's Holiday Kit (CC0, art/portfolio-room/kenney-holiday) in the
room of build_room.py, in its style:
- a tree in the front-left of the room, by the left wall, slimmed a little,
  with baubles (red, gold, cream) set on its tiers and a gold star on top
  (its fairy lights are live on the page: Christmas.tsx, at the points this
  writes to src/portfolio/room/xmasLights.ts);
- presents under it; two stockings hung from the bookcase's top; a wreath
  on the back wall; a small snowman on the bookcase.
Run: Blender -b --factory-startup --python art/portfolio-room/build_xmas.py
Writes public/models/portfolio-room/xmas.glb (Draco).

Positions are three.js (x, y, z) as the page has them (the room's floor at
y 0, its back wall's face at z -2.6, its left wall's at x -3.1).
"""
import bpy, bmesh, math, random
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
KIT = ROOT / 'art/portfolio-room/kenney-holiday'
OUT = ROOT / 'public/models/portfolio-room/xmas.glb'
LIGHTS = ROOT / 'src/portfolio/room/xmasLights.ts'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = random.Random(12)

# The room (build_room.py): its walls and the bookcase.
WALL_X, WALL_Z = -3.1, -2.6
BC_X, BC_W, BC_D, BC_H = 1.68, 1.2, 0.42, 1.5
BC_FRONT = WALL_Z + 0.01 + BC_D

# The tree: where it stands, how tall, how much slimmer than Kenney's.
TREE_AT = (-2.15, 0.0, 0.55)
TREE_H, TREE_SLIM = 2.9, 0.8


def B(x, y, z):
    """three.js to Blender."""
    return Vector((x, -z, y))


def T(v):
    """Blender to three.js."""
    return (v.x, v.z, -v.y)


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def material(name, hexcolor, rough=0.5, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*srgb(hexcolor), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = (*srgb(hexcolor), 1)
        p.inputs['Emission Strength'].default_value = emit
    return m


def piece(name, at, height=None, width=None, yaw=0.0, slim=1.0, label=None):
    """A kit piece, its footprint centred on `at` (its base there), scaled to
    a height or a width, turned by yaw (about y), slimmed across."""
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(KIT / f'{name}.glb'))
    new = [o for o in scene.objects if o not in before]
    root = bpy.data.objects.new(label or name, None)
    scene.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    meshes = [o for o in new if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    size = hi - lo
    s = height / size.z if height else width / max(size.x, size.y)
    pivot = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for o in new:
        if o.parent == root:
            o.location -= pivot
    root.scale = (s * slim, s * slim, s)
    root.rotation_euler.z = yaw
    root.location = B(*at)
    bpy.context.view_layer.update()
    return meshes


def bvh(meshes):
    """One ray-cast tree over the meshes, in world space."""
    verts, polys = [], []
    for o in meshes:
        m = o.matrix_world
        base = len(verts)
        verts += [m @ v.co for v in o.data.vertices]
        polys += [[base + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, polys)


# ------------------------------------------------------------------ the tree
tree = piece('tree', TREE_AT, height=TREE_H, slim=TREE_SLIM, yaw=0.4)
hit = bvh(tree)
base = B(*TREE_AT)


def on_tree(angle, y, off):
    """Where a ray in toward the trunk at height y, from `angle`, meets the
    tree's surface; off it by `off` along the surface's normal (three.js)."""
    d = Vector((math.cos(angle), math.sin(angle), 0))
    start = base + Vector((0, 0, y)) + d * 3
    loc, nrm, _, _ = hit.ray_cast(start, -d, 4)
    if loc is None:
        return None
    return T(loc + nrm.normalized() * off), nrm


# Fairy lights: a spiral up the tree, five turns, about 110 bulbs; each
# where the spiral meets the branches (the tiers' rims stick out, so the
# rays catch them, as a string draped over them would).
bulbs = []
N, TURNS = 116, 5.2
for k in range(N):
    t = k / (N - 1)
    y = 0.42 + t * (TREE_H - 0.72)
    a = t * TURNS * 2 * math.pi + 0.35
    p = on_tree(a, y, 0.03)
    if p:
        bulbs.append(p[0])

# Baubles: on the tiers, outward-facing, spaced apart.
balls = []
mats = {
    'red': material('Bauble red', '#a5262b', 0.28, 0.35),
    'gold': material('Bauble gold', '#d4a24c', 0.25, 0.85),
    'cream': material('Bauble cream', '#efe7d4', 0.35, 0.1),
}
tries = 0
while len(balls) < 26 and tries < 2000:
    tries += 1
    y = rng.uniform(0.45, TREE_H - 0.55)
    a = rng.uniform(0, 2 * math.pi)
    p = on_tree(a, y, 0.06)
    if not p:
        continue
    at, nrm = p
    if nrm.z > 0.75:  # on a tier's top, not hanging at its rim
        continue
    if any((Vector(at) - Vector(b)).length < 0.34 for b, _ in balls):
        continue
    balls.append((at, rng.choice(list(mats))))
for at, kind in balls:
    r = 0.075 if kind != 'cream' else 0.065
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=r, location=B(*at))
    o = bpy.context.object
    o.name = f'Bauble {kind}'
    o.data.materials.append(mats[kind])
    bpy.ops.object.shade_smooth()
    # Its cap and hook, gold.
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=r * 0.3, depth=r * 0.35,
                                        location=B(at[0], at[1] + r * 0.95, at[2]))
    bpy.context.object.data.materials.append(mats['gold'])

# The star on top: five points, gold, a little self-lit.
top = max((o.matrix_world @ Vector(c)).z for o in tree for c in o.bound_box)
bm = bmesh.new()
outer, inner, depth = 0.2, 0.085, 0.05
ring = []
for k in range(10):
    a = math.pi / 2 + k * math.pi / 5
    r = outer if k % 2 == 0 else inner
    ring.append((r * math.cos(a), r * math.sin(a)))
front = [bm.verts.new((x, -depth / 2, y)) for x, y in ring]
back = [bm.verts.new((x, depth / 2, y)) for x, y in ring]
cf, cb = bm.verts.new((0, -depth, 0)), bm.verts.new((0, depth, 0))
for k in range(10):
    j = (k + 1) % 10
    bm.faces.new((cf, front[k], front[j]))
    bm.faces.new((cb, back[j], back[k]))
    bm.faces.new((front[k], back[k], back[j], front[j]))
me = bpy.data.meshes.new('Star')
bm.to_mesh(me)
bm.free()
star = bpy.data.objects.new('Tree star', me)
scene.collection.objects.link(star)
star.data.materials.append(material('Star gold', '#f2c661', 0.3, 0.6, emit=1.2))
star.location = base + Vector((0, 0, top - base.z + outer * 0.8))
star.rotation_euler.z = 0.55  # toward the camera
star_at = T(star.location)

# --------------------------------------------------- presents, stockings
piece('present-b-rectangle', (-1.3, 0, 1.25), width=0.62, yaw=0.35)
piece('present-a-cube', (-1.72, 0, 1.68), width=0.44, yaw=-0.3)
piece('present-a-round', (-2.62, 0, 1.55), width=0.4, yaw=0.5)
piece('present-b-cube', (-1.05, 0, 0.78), width=0.36, yaw=0.9)

# Hung from the bookcase's top, its front edge: the cuff just over it.
for x, name in ((BC_X - 0.33, 'sock-red'), (BC_X + 0.25, 'sock-green')):
    piece(name, (x, BC_H - 0.42, BC_FRONT + 0.06), height=0.46, yaw=0.0)
piece('snowman', (BC_X + 0.38, BC_H, WALL_Z + 0.24), height=0.36, yaw=-0.35)

# The wreath on the back wall, right of the window.
piece('wreath', (0.62, 2.62, WALL_Z + 0.07), height=0.62, yaw=0.0)

# ------------------------------------------------------------------ export
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = next(o for o in scene.objects if o.type == 'MESH')
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.ops.object.join()
bpy.context.object.name = 'Christmas'
for o in [o for o in scene.objects if o.type == 'EMPTY']:
    bpy.data.objects.remove(o)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_yup=True, export_apply=True,
                          export_lights=False, export_cameras=False, export_image_format='WEBP',
                          export_image_quality=90, export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6)

# The fairy lights' points, for the page.
with open(LIGHTS, 'w') as f:
    f.write('// Generated by art/portfolio-room/build_xmas.py: do not edit.\n')
    f.write('// The tree\'s fairy lights (three.js, his room\'s frame), up its spiral,\n')
    f.write('// and its star\'s middle.\n')
    f.write('export const TREE_BULBS: [number, number, number][] = [\n')
    for b in bulbs:
        f.write(f'  [{b[0]:.3f}, {b[1]:.3f}, {b[2]:.3f}],\n')
    f.write('];\n')
    f.write(f'export const TREE_STAR: [number, number, number] = [{star_at[0]:.3f}, {star_at[1]:.3f}, {star_at[2]:.3f}];\n')
import subprocess
subprocess.run(['npx', 'prettier', '--write', str(LIGHTS)], cwd=ROOT, check=False)
print('XMAS_DONE', OUT.stat().st_size, 'bulbs', len(bulbs), 'baubles', len(balls))
