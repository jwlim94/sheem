"""His insulated tumbler, shared by the room (on the bookcase) and the lecture
hall (on his tablet arm): a powder-coated cobalt body, a bare steel rim, a
black lid with a carry loop. Lathed from a measured profile, so its edges
round off like the real thing.

Blender axes (z up); `build_tumbler()` returns the objects, base at `loc`.
"""
import math

import bmesh
import bpy


def _srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def _mat(name, hexcolor, rough, metal=0.0, sheen=0.0, glow=0.0):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*_srgb(hexcolor), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    for key in ('Sheen Weight', 'Sheen'):
        if sheen and key in b.inputs:
            b.inputs[key].default_value = sheen
            break
    if glow:
        b.inputs['Emission Color'].default_value = (*_srgb(hexcolor), 1)
        b.inputs['Emission Strength'].default_value = glow
    return m


def _lathe(name, profile, mat, loc, steps=48):
    """Spin a (radius, height) profile about z into a closed, smooth solid."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0.0, z)) for r, z in profile]
    edges = [bm.edges.new((a, b)) for a, b in zip(verts, verts[1:])]
    bmesh.ops.spin(bm, geom=verts + edges, axis=(0, 0, 1), cent=(0, 0, 0), angle=2 * math.pi, steps=steps)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    return o


def build_tumbler(name='Tumbler', loc=(0.0, 0.0, 0.0), glow=0.0):
    """About 0.24 m tall and 0.1 m across at his 1.38x scale (a 40 oz
    tumbler is 0.25 x 0.1 m): a straight body with a rounded foot, a slight
    shoulder under a thin steel ring, the lid and its loop."""
    body = _mat('Tumbler cobalt', '#2f5d9c', 0.5, sheen=0.25, glow=glow)
    steel = _mat('Tumbler steel', '#c9ccd1', 0.28, metal=1.0, glow=glow * 0.5)
    lid = _mat('Tumbler lid', '#1c1d20', 0.45, glow=glow * 0.5)
    out = [
        # Body: a recessed base, the rounded foot, straight up to the shoulder.
        _lathe(f'{name} body', [(0.0, 0.002), (0.04, 0.002), (0.046, 0.0), (0.0495, 0.003), (0.051, 0.01),
                                (0.051, 0.168), (0.0495, 0.184), (0.0465, 0.194), (0.0455, 0.198)], body, loc),
        # The bare steel band where the coating stops, under the lid.
        _lathe(f'{name} ring', [(0.0455, 0.197), (0.046, 0.199), (0.046, 0.205), (0.0455, 0.207)], steel, loc),
        # Lid: a skirt, a softly domed top, a raised boss for the loop.
        _lathe(f'{name} lid', [(0.0, 0.243), (0.018, 0.243), (0.02, 0.24), (0.04, 0.238), (0.046, 0.234),
                               (0.0475, 0.228), (0.0475, 0.209), (0.0465, 0.206), (0.0, 0.206)], lid, loc),
    ]
    # The carry loop, flat and upright across the lid, its feet in the boss.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.019, minor_radius=0.005, major_segments=32, minor_segments=10,
                                     location=(loc[0], loc[1], loc[2] + 0.243))
    loop = bpy.context.object
    loop.name = f'{name} loop'
    loop.rotation_euler = (math.pi / 2, 0.0, 0.0)
    loop.scale = (1.0, 0.55, 1.0)  # squat (local y is up once stood upright)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for p in loop.data.polygons:
        p.use_smooth = True
    loop.data.materials.append(lid)
    out.append(loop)
    return out
