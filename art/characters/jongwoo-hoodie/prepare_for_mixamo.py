"""Cleans the Meshy Lite hoodie character and exports an FBX for Mixamo auto-rigging.
Run: Blender -b --python art/characters/jongwoo-hoodie/prepare_for_mixamo.py
Input:  source/meshy-lite.glb (Meshy AI, CC BY 4.0, generated from concept/front.png)
Output: source/basecolor-fixed.png  (green bleed on the back of the hair repainted)
        mixamo/jongwoo-hoodie-upload.fbx (feet on the ground, textures embedded)
Set PREVIEW=<dir> to render a back-of-head check before/after.
"""
import bpy, os, math
from pathlib import Path
from mathutils import Vector
import numpy as np

HERE = Path(__file__).resolve().parent
SRC = HERE / 'source/meshy-lite.glb'
HEAD_Z = 0.56  # source units: faces above the hood line belong to the head
HAIRLINE_Z = 0.8  # front-facing faces above this are fringe, below it the face
NECK_LO, NECK_HI, CHIN_HI = 0.5, 0.62, 0.68  # neck band and chin underside (below the mouth)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SRC))
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
me = obj.data
mat = me.materials[0]
base_node = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'
                 and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links))
img = base_node.image
W, H = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)

uv = me.uv_layers.active.data


def uv_mask(keep):
    """Texels covered by the UV triangles of polygons where keep(poly, centre)."""
    out = np.zeros((H, W), dtype=bool)
    for poly in me.polygons:
        if not keep(poly, obj.matrix_world @ poly.center):
            continue
        pts = np.array([uv[li].uv[:] for li in poly.loop_indices]) * [W, H]
        x0, y0 = np.floor(pts.min(0)).astype(int)
        x1, y1 = np.ceil(pts.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        a, b, c = pts[0], pts[1], pts[2]
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-9:
            continue
        l1 = ((b[1] - c[1]) * (gx - c[0]) + (c[0] - b[0]) * (gy - c[1])) / d
        l2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / d
        out[y0:y1 + 1, x0:x1 + 1] |= (l1 >= -0.02) & (l2 >= -0.02) & (1 - l1 - l2 >= -0.02)
    return out


# Head faces that look backwards or sideways; the face (-Y) keeps eyes and mouth.
mask = uv_mask(lambda poly, c: c.z >= HEAD_Z and not (poly.normal.y < -0.35 and c.z < HAIRLINE_Z))
# Grow the mask a few texels so island edges are covered too.
for _ in range(3):
    grown = mask.copy()
    grown[1:] |= mask[:-1]; grown[:-1] |= mask[1:]
    grown[:, 1:] |= mask[:, :-1]; grown[:, :-1] |= mask[:, 1:]
    mask = grown
r, g, b = px[..., 0], px[..., 1], px[..., 2]
skin = r > g * 1.15  # ears and neck stay untouched
greenish = mask & ~skin & (np.maximum(np.maximum(r, g), b) > 0.075)
hair = mask & ~skin & ~greenish
hair_rgb = np.median(px[hair][:, :3], axis=0) if hair.any() else np.array([0.02, 0.02, 0.02])
# Keep the green shading as luminance so hair strands stay readable.
lum = (0.3 * r + 0.59 * g + 0.11 * b)[greenish]
scale = np.clip(lum / max(lum.mean(), 1e-4), 0.7, 1.3)[:, None]
px[greenish, :3] = hair_rgb * scale
print('HAIR_FIX texels', int(greenish.sum()), 'hair colour', hair_rgb.round(3))

# A pale line is painted along the jaw edge (the front image's chin highlight),
# which reads as a crease. Even out the neck and the downward-facing chin skin
# towards the neck's median tone, keeping a little of the original shading.
neck = uv_mask(lambda poly, c: abs(c.x) < 0.22 and NECK_LO <= c.z <= CHIN_HI
               and poly.normal.y > -0.6
               and (c.z <= NECK_HI or poly.normal.z < -0.35))
skin = (r > g * 1.15) & (r > 0.35)
target = neck & skin
neck_rgb = np.median(px[target][:, :3], axis=0)
px[target, :3] = 0.25 * px[target, :3] + 0.75 * neck_rgb
print('CHIN_FIX texels', int(target.sum()), 'neck colour', neck_rgb.round(3))

# Hair shadow bled onto the skin along both temples (a grey-brown band between
# brow tail and hairline). Recolour dim skin texels there; dark hair and brow
# texels are left alone.
temple = uv_mask(lambda poly, c: 0.07 <= abs(c.x) <= 0.15 and 0.72 <= c.z <= 0.84
                 and poly.normal.y < 0.2)
r, g, b = px[..., 0], px[..., 1], px[..., 2]
mx = np.maximum(np.maximum(r, g), b)
clean = temple & (r > g * 1.15) & (mx > 0.85)
skin_max = float(np.median(mx[clean]))


def soften(m, passes=6, k=4):
    """Box-blur a mask so the correction fades out instead of stopping at an edge."""
    w = m.astype(np.float32)
    for _ in range(passes):
        c = np.cumsum(np.pad(w, ((k + 1, k), (0, 0)), mode='edge'), axis=0)
        w = (c[2 * k + 1:] - c[:-2 * k - 1]) / (2 * k + 1)
        c = np.cumsum(np.pad(w, ((0, 0), (k + 1, k)), mode='edge'), axis=1)
        w = (c[:, 2 * k + 1:] - c[:, :-2 * k - 1]) / (2 * k + 1)
    return w


# The smudge is a brightness dip with normal skin hue: lift brightness only.
# Hair and brow texels (max < 0.62) are untouched; the lift ramps in above that.
region = soften(temple)
t = np.clip((mx - 0.62) / (0.8 - 0.62), 0, 1)
lift = region * t * t * (3 - 2 * t) * (r > g * 1.1)
gain = 1 + lift * (np.maximum(skin_max / np.maximum(mx, 1e-4), 1) - 1)
px[..., :3] *= gain[..., None]
print('TEMPLE_FIX texels', int((lift > 0.01).sum()), 'skin max', round(skin_max, 3))

# The lift leaves a faint band where the smudge ended. Blur the temple skin with
# a skin-only (normalised) blur so hair and brows never bleed into it.
r, g, b = px[..., 0], px[..., 1], px[..., 2]
mx = np.maximum(np.maximum(r, g), b)
skin_w = ((mx > 0.62) & (r > g * 1.1)).astype(np.float32)
num = np.stack([soften(px[..., ch] * skin_w, passes=3, k=5) for ch in range(3)], -1)
den = soften(skin_w, passes=3, k=5)[..., None]
blurred = num / np.maximum(den, 1e-4)
mix_w = (region * skin_w)[..., None]
px[..., :3] = px[..., :3] * (1 - mix_w) + blurred * mix_w
print('TEMPLE_BLUR texels', int((mix_w[..., 0] > 0.01).sum()))

# Indoors, shoes off: the white sneakers become white ribbed socks. The grey
# house slippers are a separate mesh made in build_web_glb.py, and the room
# scene places the actual white sneakers on the floor.


def uv_positions(keep):
    """Source-space position of each texel covered by polygons where keep(poly, centre) (NaN elsewhere)."""
    out = np.full((H, W, 3), np.nan, dtype=np.float32)
    for poly in me.polygons:
        if not keep(poly, obj.matrix_world @ poly.center):
            continue
        li = list(poly.loop_indices)
        pts = np.array([uv[i].uv[:] for i in li]) * [W, H]
        pos = np.array([(obj.matrix_world @ me.vertices[me.loops[i].vertex_index].co)[:] for i in li])
        x0, y0 = np.floor(pts.min(0)).astype(int)
        x1, y1 = np.ceil(pts.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        a, b, c = pts[0], pts[1], pts[2]
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-9:
            continue
        l1 = ((b[1] - c[1]) * (gx - c[0]) + (c[0] - b[0]) * (gy - c[1])) / d
        l2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / d
        l3 = 1 - l1 - l2
        inside = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
        p3 = l1[..., None] * pos[0] + l2[..., None] * pos[1] + l3[..., None] * pos[2]
        block = out[y0:y1 + 1, x0:x1 + 1]
        block[inside] = p3[inside]
    return out


feet_pos = uv_positions(lambda poly, c: c.z < -0.805)
# Grow it into the empty gutter around the islands (seen as seam lines when
# filtered), never into texels another island uses (face, hoodie).
covered = uv_mask(lambda poly, c: True)
for _ in range(4):
    for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
        moved = np.roll(feet_pos, shift, axis=axis)
        hole = np.isnan(feet_pos[..., 0]) & ~np.isnan(moved[..., 0]) & ~covered
        feet_pos[hole] = moved[hole]
feet = ~np.isnan(feet_pos[..., 0])
r, g, b = px[..., 0], px[..., 1], px[..., 2]
shoe = feet & (np.minimum(np.minimum(r, g), b) > 0.2)  # not the black trousers
lum = (0.3 * r + 0.59 * g + 0.11 * b)[shoe]
knit = np.clip(0.9 + 0.1 * lum / max(lum.mean(), 1e-4), 0.85, 1.05)[:, None]
fx, fy = feet_pos[shoe, 0], feet_pos[shoe, 1]
sock = np.array([0.94, 0.93, 0.9])
# Knit ribs running up the sock, around the ankle.
ang = np.arctan2(fy - 0.05, np.abs(fx) - 0.19)
rib = 1 - 0.08 * (0.5 + 0.5 * np.cos(2 * np.pi * ang * 0.06 / 0.007))
px[shoe, :3] = sock * (rib[:, None] * knit)
print('SOCKS texels', int(shoe.sum()))

# Edge padding: Meshy leaves the gutter between UV islands dark, which bleeds
# into every seam as a thin dark line once the texture is filtered/mipmapped
# (forehead, hoodie). Extend each island's edge colour outward into the gutter.
known = covered.copy()
for _ in range(24):
    acc = np.zeros((H, W, 3), dtype=np.float32)
    cnt = np.zeros((H, W), dtype=np.float32)
    for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
        k = np.roll(known, shift, axis=axis)
        acc += np.roll(px[..., :3], shift, axis=axis) * k[..., None]
        cnt += k
    fill = ~known & (cnt > 0)
    px[fill, :3] = acc[fill] / cnt[fill][:, None]
    known |= fill
print('PADDED texels', int((known & ~covered).sum()))

fixed = bpy.data.images.new('basecolor-fixed', W, H, alpha=True)
fixed.pixels[:] = px.ravel()
fixed.filepath_raw = str(HERE / 'source/basecolor-fixed.png')
fixed.file_format = 'PNG'
fixed.save()
base_node.image = fixed

# Feet on the ground, origin at the feet, transforms applied.
low = min((obj.matrix_world @ v.co).z for v in me.vertices)
obj.location.z -= low
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.context.scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
obj.name = 'JongwooHoodie'

preview = os.environ.get('PREVIEW')
if preview:
    sc = bpy.context.scene
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 0.9
    v = Vector((0, 1, 0.8)).normalized()
    cam.location = Vector((0, 0, 1.67)) + v * 4
    cam.rotation_euler = (-v).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.75, 0.72, 1)
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x = sc.render.resolution_y = 500
    sc.render.filepath = os.path.join(preview, 'hair-fixed.png')
    bpy.ops.render.render(write_still=True)

out = HERE / 'mixamo/jongwoo-hoodie-upload.fbx'
out.parent.mkdir(exist_ok=True)
bpy.ops.export_scene.fbx(filepath=str(out), use_selection=True, object_types={'MESH'},
                         path_mode='COPY', embed_textures=True, apply_unit_scale=True,
                         add_leaf_bones=False)
print('MIXAMO_FBX', out, out.stat().st_size)
