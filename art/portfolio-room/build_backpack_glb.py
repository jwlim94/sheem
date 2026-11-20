"""His white backpack as its own GLB, for the page to move it (chapter 2's
way out: he picks it up from beside his desk at Neighbor and slings it on).
Run: Blender -b --factory-startup --python art/portfolio-room/build_backpack_glb.py
Writes public/models/jongwoo/backpack.glb (Draco): 'Backpack', set down by
his desk at Neighbor (backpack.py build_v2_backpack: the bag he wears, its
straps slack down its back panel), front +X (three.js +x), width along
three.js z, base at 0, 0.6 m tall (the scenes' 1.38x scale). Once he's off
down the aisle the page shows the worn one instead (the hero GLB's
'Backpack worn', jongwoo-v2/worn_backpack.py).
"""
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art/portfolio-room/backpack-v2/source.glb'
OUT = ROOT / 'public/models/jongwoo/backpack.glb'
H = 0.6
sys.path.insert(0, str(ROOT / 'art/portfolio-room'))
bpy.ops.wm.read_factory_settings(use_empty=True)
from backpack import build_v2_backpack  # noqa: E402

# Leaning back against the desk's leg panel: it sags back against it, its
# straps pressed between (the wall 0.066 m behind its origin).
body = build_v2_backpack(SRC, 'Backpack', height=H, show_side=0, contact=False, slump=0.05, wall_x=-0.066)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.convert(target='MESH')
body = bpy.context.object
body.name = 'Backpack'
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
for o in list(bpy.context.scene.objects):
    if o is not body:
        bpy.data.objects.remove(o, do_unlink=True)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_image_format='WEBP', export_image_quality=85,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
print('BACKPACK_GLB', OUT, OUT.stat().st_size)
