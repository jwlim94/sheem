"""Retargets a video-mocap FBX (DeepMotion Animate 3D, its "Adult Male (UE)"
skeleton: Hips, Spine, ..., LeftHandIndex1, no prefix; downloaded with a
T-pose first frame) onto the hero's Mixamo rig, as an action.

Each bone's world rotation is taken relative to the source's T-pose frame
and applied to the rig's own T rest (both rigs stand in a T rest, so their
differing bone rolls and proportions cancel out); the hips move by the
source's, scaled by the two hips' heights. Then smoothed: video mocap
jitters (most in the hands), so every bone's rotation is filtered over
time (a Gaussian, wider for the hands and fingers), quaternions kept on one
hemisphere.

Used by build_web_glb.py (`retarget(rig, path, name, ...)`).
"""
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector


def _rot(m):
    return m.to_3x3().normalized().to_quaternion()


def _gauss(a, sigma):
    """Smooths an (n, k) array along n with a Gaussian (edges held)."""
    if sigma <= 0:
        return a
    r = int(sigma * 3) + 1
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.concatenate([np.repeat(a[:1], r, 0), a, np.repeat(a[-1:], r, 0)], 0)
    return np.stack([np.convolve(pad[:, j], k, mode='valid') for j in range(a.shape[1])], 1)


def _fcurves(action):
    if len(getattr(action, 'fcurves', [])):
        return action.fcurves
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                return bag.fcurves
    return action.fcurves


def retarget(rig, path, name, tpose_frame=1, start=None, end=None, sigma_body=1.6, sigma_hand=3.0,
             prefix='mixamorig:'):
    scene = bpy.context.scene
    before = set(bpy.data.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    src = next(o for o in new if o.type == 'ARMATURE')
    sact = next(a for a in bpy.data.actions if a not in acts_before)
    src.animation_data.action = sact
    f0 = int(round(sact.frame_range[0])) if start is None else start
    f1 = int(round(sact.frame_range[1])) if end is None else end

    # The bones to drive: those both rigs have, parents first.
    pairs = []
    for b in rig.data.bones:  # (bones are listed parents first)
        n = b.name[len(prefix):] if b.name.startswith(prefix) else None
        if n and n in src.pose.bones:
            pairs.append((b.name, n))
    Mt = rig.matrix_world
    MtQ = _rot(Mt)
    Rb = {t: _rot(rig.data.bones[t].matrix_local) for t, _ in pairs}
    Tw = {t: MtQ @ Rb[t] for t, _ in pairs}

    # The source's T-pose frame: its world rotations, its hips.
    scene.frame_set(tpose_frame)
    S0 = {s: _rot(src.matrix_world @ src.pose.bones[s].matrix) for _, s in pairs}
    hips_s0 = src.matrix_world @ src.pose.bones['Hips'].head
    hips_t0 = Mt @ rig.data.bones[prefix + 'Hips'].head_local
    ratio = hips_t0.z / max(1e-6, hips_s0.z)

    frames = list(range(f0, f1 + 1))
    Q = {t: np.zeros((len(frames), 4)) for t, _ in pairs}
    L = np.zeros((len(frames), 3))
    for i, f in enumerate(frames):
        scene.frame_set(f)
        W = {}
        for t, s in pairs:
            Sw = _rot(src.matrix_world @ src.pose.bones[s].matrix)
            W[t] = MtQ.inverted() @ (Sw @ S0[s].inverted()) @ Tw[t]
        for t, s in pairs:
            parent = rig.data.bones[t].parent
            if parent is not None and parent.name in W:
                q = Rb[t].inverted() @ Rb[parent.name] @ W[parent.name].inverted() @ W[t]
            else:
                q = Rb[t].inverted() @ W[t]
            Q[t][i] = q[:]
        # The hips: the source's move from its T-pose, scaled, in the rig's
        # space, as the bone's own location (its rest frame).
        disp = (src.matrix_world @ src.pose.bones['Hips'].head - hips_s0) * ratio
        head_arm = Mt.inverted() @ (hips_t0 + disp)
        rest = rig.data.bones[prefix + 'Hips']
        L[i] = (Rb[prefix + 'Hips'].inverted() @ (head_arm - rest.head_local))[:]

    # Smooth: one hemisphere, then a Gaussian, renormalised.
    for t, s in pairs:
        a = Q[t]
        for i in range(1, len(a)):
            if np.dot(a[i], a[i - 1]) < 0:
                a[i] = -a[i]
        sig = sigma_hand if ('Hand' in s or 'Thumb' in s or 'Index' in s) else sigma_body
        a = _gauss(a, sig)
        Q[t] = a / np.linalg.norm(a, axis=1, keepdims=True)
    L = _gauss(L, sigma_body)

    # Write the action: keyframes on every frame, from 1.
    act = bpy.data.actions.new(name)
    rig.animation_data_create()
    prev = rig.animation_data.action
    rig.animation_data.action = act
    n = len(frames)
    for t, _ in pairs:
        pb = rig.pose.bones[t]
        pb.rotation_mode = 'QUATERNION'
        pb.keyframe_insert('rotation_quaternion', frame=1)
    pb = rig.pose.bones[prefix + 'Hips']
    pb.keyframe_insert('location', frame=1)
    fcs = _fcurves(act)
    xs = np.arange(1, n + 1, dtype=np.float32)

    def fill(path_, idx, vals):
        c = fcs.find(path_, index=idx)
        c.keyframe_points.clear()
        c.keyframe_points.add(n)
        co = np.empty(2 * n, dtype=np.float32)
        co[0::2], co[1::2] = xs, vals
        c.keyframe_points.foreach_set('co', co)
        for k in c.keyframe_points:
            k.interpolation = 'LINEAR'
        c.update()
    for t, _ in pairs:
        for j in range(4):
            fill(f'pose.bones["{t}"].rotation_quaternion', j, Q[t][:, j])
    for j in range(3):
        fill(f'pose.bones["{prefix}Hips"].location', j, L[:, j])
    rig.animation_data.action = prev
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.actions.remove(sact)
    print('MOCAP', name, 'frames', f0, '-', f1, 'bones', len(pairs), 'hips ratio', round(ratio, 3))
    return act
