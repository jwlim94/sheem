"""Adds seated typing and waving clips to the original student for /portfolio/7.
Run: Blender -b art/characters/boy/jongwoo-student-v1.blend --python art/characters/boy/build_story_clips.py
Writes public/models/boy/jongwoo-student-story.glb; the v1 .blend and GLB stay unchanged.
Set PREVIEW=<dir> to also render one still per clip.
"""
import bpy, os
from math import sin, pi
from pathlib import Path
from mathutils import Vector

ROOT = Path(bpy.data.filepath).resolve().parents[3]
rig = bpy.data.objects['JongwooRig']
mesh = bpy.data.objects['JongwooStudent']
pb = rig.pose.bones
scene = bpy.context.scene


def reset():
    for p in pb:
        p.rotation_euler = (0, 0, 0)
        p.location = (0, 0, 0)


def key(frame):
    for p in pb:
        p.keyframe_insert('rotation_euler', frame=frame, group=p.name)
        p.keyframe_insert('location', frame=frame, group=p.name)


def action(name):
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    a = bpy.data.actions.new(name)
    a.use_fake_user = True
    rig.animation_data.action = a
    return a


def seated(t):
    """Seated at a desk; hips drop onto the seat, forearms rest toward a keyboard."""
    pb['Hips'].location.y = -0.33
    pb['Spine'].rotation_euler.x = 0.1 + 0.01 * sin(t)
    pb['Head'].rotation_euler.x = 0.06 + 0.015 * sin(t * 0.5)
    for side, tag in [(1, 'L'), (-1, 'R')]:
        pb['Thigh.' + tag].rotation_euler.x = -1.52
        pb['Thigh.' + tag].rotation_euler.z = side * 0.06
        pb['Shin.' + tag].rotation_euler.x = 1.5
        pb['Foot.' + tag].rotation_euler.x = 0.05
        pb['UpperArm.' + tag].rotation_euler.x = -0.95
        pb['UpperArm.' + tag].rotation_euler.z = side * 0.22
        pb['Forearm.' + tag].rotation_euler.x = -0.75
        pb['Forearm.' + tag].rotation_euler.z = -side * 0.18


# Typing: a two-second loop of small alternating hand taps.
action('SitType')
for f in range(1, 50, 2):
    reset()
    t = (f - 1) / 48 * 2 * pi
    seated(t)
    for side, tag in [(1, 'L'), (-1, 'R')]:
        phase = t * 4 + (0 if side == 1 else 1.7)
        pb['Hand.' + tag].rotation_euler.x = 0.1 + 0.12 * max(0, sin(phase))
        pb['Forearm.' + tag].rotation_euler.x += 0.03 * sin(phase + 0.6)
    key(f)

# Waving: right arm raised beside the head, forearm swinging.
action('Wave')
for f in range(1, 50, 2):
    reset()
    t = (f - 1) / 48 * 2 * pi
    pb['Spine'].rotation_euler.z = 0.03 * sin(t)
    pb['Head'].rotation_euler.z = 0.07 + 0.03 * sin(t)
    pb['UpperArm.R'].rotation_euler.z = 1.45
    pb['UpperArm.R'].rotation_euler.x = -0.3
    pb['Forearm.R'].rotation_euler.z = 1.0 + 0.38 * sin(t * 2)
    pb['Hand.R'].rotation_euler.z = 0.15 * sin(t * 2 - 0.5)
    pb['UpperArm.L'].rotation_euler.z = -0.08
    pb['Forearm.L'].rotation_euler.x = -0.15
    key(f)

rig.animation_data.action = bpy.data.actions['Idle']
scene.frame_set(1)

preview = os.environ.get('PREVIEW')
if preview:
    cam = scene.camera
    cam.location = (3.6, -5.2, 2.4)
    cam.rotation_euler = (Vector((0, 0, 1.0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = 3.4
    scene.cycles.samples = 12
    scene.render.resolution_x, scene.render.resolution_y = 600, 600
    for name in ['SitType', 'Wave']:
        rig.animation_data.action = bpy.data.actions[name]
        scene.frame_set(9)
        scene.render.filepath = os.path.join(preview, f'clip-{name}.png')
        bpy.ops.render.render(write_still=True)
    rig.animation_data.action = bpy.data.actions['Idle']
    scene.frame_set(1)

bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=str(ROOT / 'public/models/boy/jongwoo-student-story.glb'),
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_yup=True,
    export_skins=True,
)
print('STORY_CLIPS_DONE', [a.name for a in bpy.data.actions])
