"""Blinking lids for the v2 character (build_web_glb.py).

Meshy painted his eyes into the texture (no eyelids), so the lids are
decals: thin skinned sheets over each eye, a grid seen straight on, half a
millimetre off the face. Their textures are painted from the face as seen
straight on (the texture sampled through the mesh along +Y, so the eyes are
axis-aligned and the face's many UV islands don't matter): the eye painted
out with the surrounding skin (diffused in from beyond its pale rim), a
soft lid shading, and the lash line.

- LidsShut: the lash line a gentle arc sagging toward the cheek.
- LidsHalf: the eye's top half under the lid, its lash line across the eye.

The page shows them for a moment every few seconds. Their edges fade out in
alpha, so they never show a border. All coordinates are the bind (T) pose's,
in metres, before the scenes' 1.38x.

(A focused mouth for the hall was cut from the face here as well, the smile
relaxed flat and repainted; on 2026-10-12 the user preferred his own smile.)
"""
import math

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

PX = 0.0003  # m per decal texel
LIFT = 0.0005  # m, the patches' offset off the face


def _mesh_arrays(body):
    me = body.data
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float64)
    me.vertices.foreach_get('co', co)
    mw = np.array(body.matrix_world)
    P = co.reshape(n, 3) @ mw[:3, :3].T + mw[:3, 3]
    nrm = np.empty(n * 3, dtype=np.float64)
    me.vertices.foreach_get('normal', nrm)
    N = nrm.reshape(n, 3) @ mw[:3, :3].T
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    tri = np.empty(len(me.polygons) * 3, dtype=np.int64)
    me.polygons.foreach_get('vertices', tri)
    tri = tri.reshape(-1, 3)
    uv = np.empty(len(me.loops) * 2, dtype=np.float64)
    me.uv_layers.active.data.foreach_get('uv', uv)
    return P, N, tri, uv.reshape(-1, 2)


class Face:
    """The head's front, sampled straight on."""

    def __init__(self, body, px):
        for p in body.data.polygons[:50]:
            assert p.loop_total == 3, 'face_parts expects a triangulated mesh'
        self.body = body
        self.px = px
        self.H, self.W = px.shape[:2]
        self.P, self.N, self.tri, self.uv = _mesh_arrays(body)
        z = self.P[self.tri, 2].min(1)
        self.head = np.flatnonzero(z > 1.3)  # faces of the head and neck
        self.bvh = BVHTree.FromPolygons([Vector(p) for p in self.P],
                                        [tuple(t) for t in self.tri[self.head]])

    def sample(self, x0, x1, z0, z1, res=PX):
        """RGBA image (rows from z0 up) of the face over that rectangle."""
        nx, nz = int(round((x1 - x0) / res)), int(round((z1 - z0) / res))
        out = np.zeros((nz, nx, 4), dtype=np.float32)
        for j in range(nz):
            for i in range(nx):
                o = Vector((x0 + (i + 0.5) * res, -0.6, z0 + (j + 0.5) * res))
                loc, _, fi, _ = self.bvh.ray_cast(o, Vector((0, 1, 0)))
                if fi is None:
                    continue
                f = self.head[fi]
                a, b, c = (Vector(self.P[k]) for k in self.tri[f])
                v0, v1, v2 = b - a, c - a, loc - a
                d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
                d20, d21 = v2.dot(v0), v2.dot(v1)
                den = d00 * d11 - d01 * d01
                w1 = (d11 * d20 - d01 * d21) / den
                w2 = (d00 * d21 - d01 * d20) / den
                uv = (1 - w1 - w2) * self.uv[3 * f] + w1 * self.uv[3 * f + 1] + w2 * self.uv[3 * f + 2]
                out[j, i] = self.px[min(int(uv[1] * self.H), self.H - 1), min(int(uv[0] * self.W), self.W - 1)]
        return out

    def patch(self, name, ellipse, image, rect, step=0.001):
        """A thin sheet over the face within the ellipse (cx, cz, a, b): a grid
        seen straight on, each point on the face (its first surface along +Y)
        and lifted off it, textured with image over rect (x0, x1, z0, z1)."""
        cx, cz, a, b = ellipse
        x0, x1, z0, z1 = rect
        xs = np.arange(cx - a, cx + a + step, step)
        zs = np.arange(cz - b, cz + b + step, step)
        Y = np.full((len(zs), len(xs)), np.nan)
        for j, z in enumerate(zs):
            for i, x in enumerate(xs):
                if ((x - cx) / a) ** 2 + ((z - cz) / b) ** 2 > 1.03:
                    continue
                loc, _, fi, _ = self.bvh.ray_cast(Vector((x, -0.6, z)), Vector((0, 1, 0)))
                if fi is not None:
                    Y[j, i] = loc.y
        Y = Y - LIFT
        idx = -np.ones(Y.shape, dtype=np.int64)
        ok = ~np.isnan(Y)
        idx[ok] = np.arange(ok.sum())
        Z, X = np.meshgrid(zs, xs, indexing='ij')
        verts = np.stack([X[ok], Y[ok], Z[ok]], 1)
        quads = []
        for j in range(len(zs) - 1):
            for i in range(len(xs) - 1):
                q = (idx[j, i], idx[j, i + 1], idx[j + 1, i + 1], idx[j + 1, i])
                if min(q) >= 0:
                    quads.append(q)
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in verts], [], quads)
        Q = verts
        x0, x1, z0, z1 = rect
        uvl = me.uv_layers.new(name='UVMap')
        for loop in me.loops:
            q = Q[loop.vertex_index]
            uvl.data[loop.index].uv = ((q[0] - x0) / (x1 - x0), (q[2] - z0) / (z1 - z0))
        for poly in me.polygons:
            poly.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.78
        img = bpy.data.images.new(name, image.shape[1], image.shape[0], alpha=True)
        img.pixels.foreach_set(image.astype(np.float32).ravel())
        img.pack()
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'BLENDED'
        else:
            mat.blend_method = 'BLEND'
        me.materials.append(mat)
        print('  ', name, len(verts), 'verts', len(quads), 'faces', image.shape[1], 'x', image.shape[0], 'texels')
        return ob


def skin(ob, body, rig):
    """Skins a part to the rig with the body's weights where it lies (nearest
    face, interpolated), as the body is."""
    for vg in body.vertex_groups:
        ob.vertex_groups.new(name=vg.name)
    dt = ob.modifiers.new('Weights', 'DATA_TRANSFER')
    dt.object = body
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=dt.name)
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()
    ob.modifiers.new('Armature', 'ARMATURE').object = rig


def _inpaint(img, mask, iters=400):
    """Fills the masked pixels from their surroundings (membrane, coarse to fine)."""
    out = img.copy()
    if not mask.any():
        return out
    h, w = mask.shape
    if min(h, w) > 16:
        small = _inpaint(out[::2, ::2], mask[::2, ::2], iters)
        up = np.repeat(np.repeat(small, 2, 0), 2, 1)[:h, :w]
        out[mask] = up[mask]
    for _ in range(iters):
        avg = out.copy()
        avg[1:-1, 1:-1] = 0.25 * (out[:-2, 1:-1] + out[2:, 1:-1] + out[1:-1, :-2] + out[1:-1, 2:])
        out[mask] = avg[mask]
    return out


def _stroke(img, xs, zs, pts, half, colour):
    """Draws a polyline (frontal coordinates) with a per-point half width."""
    X, Z = np.meshgrid(xs, zs)
    d = np.full(X.shape, np.inf)
    hw = np.zeros(X.shape)
    for (p, q), (hp, hq) in zip(zip(pts[:-1], pts[1:]), zip(half[:-1], half[1:])):
        v = np.subtract(q, p)
        t = np.clip(((X - p[0]) * v[0] + (Z - p[1]) * v[1]) / (v @ v), 0, 1)
        dd = np.hypot(X - (p[0] + t * v[0]), Z - (p[1] + t * v[1]))
        closer = dd < d
        d[closer] = dd[closer]
        hw[closer] = (hp + (hq - hp) * t)[closer]
    cov = np.clip((hw - d) / PX + 0.5, 0, 1)[..., None]
    img[..., :3] = img[..., :3] * (1 - cov) + np.asarray(colour)[None, None, :3] * cov
    return img


def _alpha(xs, zs, ellipse, solid=0.72):
    cx, cz, a, b = ellipse
    X, Z = np.meshgrid(xs, zs)
    r = np.sqrt(((X - cx) / a) ** 2 + ((Z - cz) / b) ** 2)
    t = np.clip((1 - r) / (1 - solid), 0, 1)
    return t * t * (3 - 2 * t)


def build(body, px):
    """Adds LidsShut and LidsHalf (unskinned: the caller skins them, see
    skin()). Returns the objects."""
    face = Face(body, px)
    # Find the eyes: the white of each, straight on.
    x0, x1, z0, z1 = -0.13, 0.13, 1.45, 1.75
    view = face.sample(x0, x1, z0, z1, 0.001)
    xs = x0 + (np.arange(view.shape[1]) + 0.5) * 0.001
    zs = z0 + (np.arange(view.shape[0]) + 0.5) * 0.001
    rgb = view[..., :3]
    white = (rgb.min(2) > 0.7) & (np.ptp(rgb, 2) < 0.12) & (view[..., 3] > 0)
    X, Z = np.meshgrid(xs, zs)
    eyes = []
    for s in (-1, 1):
        m = white & (X * s > 0.02)
        ex, ez = X[m], Z[m]
        eyes.append(((ex.min() + ex.max()) / 2, (ez.min() + ez.max()) / 2,
                     (ex.max() - ex.min()) / 2, (ez.max() - ez.min()) / 2))
        print('EYE', s, 'centre', round(eyes[-1][0], 4), round(eyes[-1][1], 4),
              'half size', round(eyes[-1][2], 4), round(eyes[-1][3], 4))
    skin_ref = np.median(rgb[(Z > 1.56) & (Z < 1.6) & (np.abs(X) < 0.02)], axis=0)
    print('SKIN', skin_ref.round(3))

    shut_imgs, half_imgs, rects, ells = [], [], [], []
    for cx, cz, a, b in eyes:
        # The eye's paint (outline and lashes included) and the patch around it.
        A, B = a * 1.32, b * 1.55
        pa, pb = a * 1.62, b * 2.0
        rect = (cx - pa, cx + pa, cz - pb, cz + pb)
        img = face.sample(*rect)
        ex = rect[0] + (np.arange(img.shape[1]) + 0.5) * PX
        ez = rect[2] + (np.arange(img.shape[0]) + 0.5) * PX
        EX, EZ = np.meshgrid(ex, ez)
        # Everything within the eye's outline, and whatever paint lies just
        # past it, is painted over from the skin around (the eye's pale rim
        # included: left in, it washed the lid out).
        r2 = ((EX - cx) / A) ** 2 + ((EZ - cz) / B) ** 2
        off_skin = np.abs(img[..., :3] - skin_ref).max(2) > 0.1
        paint = (r2 < 1.1 ** 2) | ((r2 < 1.25 ** 2) & off_skin)
        dark = img[(r2 < 1) & off_skin, :3]
        lash = np.percentile(dark, 4, axis=0) if len(dark) else np.array([0.05, 0.03, 0.03])
        bare = _inpaint(img[..., :3], paint)
        # The lid: a touch darker than the cheek, darkest along its fold.
        t = np.clip(1 - (((EX - cx) / A) ** 2 + ((EZ - cz) / B) ** 2), 0, 1)
        shut = bare * (1 - 0.06 * t)[..., None]
        u = np.linspace(-1, 1, 41)
        side = 1 if cx > 0 else -1
        # The closed lash line: an arc sagging toward the cheek, the outer end
        # a touch longer.
        arc = [(cx + a * 1.05 * k + side * 0.08 * a * max(k * side, 0), cz - b * (0.18 + 0.32 * (1 - k * k)))
               for k in u]
        hw = [b * (0.035 + 0.06 * (1 - k * k)) for k in u]
        shut = np.dstack([shut, np.ones(shut.shape[:2])])
        shut = _stroke(shut, ex, ez, arc, hw, lash)
        # Half shut: the top half of the eye under the lid, lash on its edge.
        cut = cz + b * 0.15
        lid_edge = [(cx + a * 1.04 * k, cut - b * 0.12 * (1 - k * k)) for k in u]
        edge_z = np.interp(EX, [p[0] for p in lid_edge], [p[1] for p in lid_edge])
        over = paint & (EZ > edge_z)
        half = img.copy()
        half[..., 3] = 1
        half[over, :3] = shut[over, :3]
        half = _stroke(half, ex, ez, lid_edge, [b * (0.05 + 0.07 * (1 - k * k)) for k in u], lash)
        alpha = _alpha(ex, ez, (cx, cz, pa, pb), 0.7)
        shut[..., 3] = alpha
        half[..., 3] = alpha
        # Off the face (past the outline of the head): transparent.
        shut[img[..., 3] == 0, 3] = 0
        half[img[..., 3] == 0, 3] = 0
        shut_imgs.append(shut)
        half_imgs.append(half)
        rects.append(rect)
        ells.append((cx, cz, pa * 0.98, pb * 0.98))
    objs = []
    for name, imgs in (('LidsShut', shut_imgs), ('LidsHalf', half_imgs)):
        parts = [face.patch(f'{name}{i}', ells[i], imgs[i], rects[i]) for i in range(2)]
        objs.append(_join(parts, name))

    return objs


def _join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = parts[0]
    ob.name = name
    ob.data.name = name
    return ob
