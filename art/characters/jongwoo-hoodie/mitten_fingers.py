"""Fingers carved into the hoodie character's mitten hands (build_web_glb.py).

Meshy's hands are mittens: the four fingers one chunky paddle. Replacing
them with separate modelled fingers read as skeletal on this round, cartoon
character, so the mitten's mass stays and fingers are carved into it, on
the T-pose rest (palms down, thumbs forward), by moving vertices only (the
mesh, its weights and the rig are untouched; the four fingers move together
in every clip, so the grooves never tear):

- three grooves between the fingers, on the back and the palm, pinching
  both faces toward the paddle's middle: shallow at the knuckles, deeper
  toward the tips;
- over the last stretch, V notches between the fingertips (the grooves'
  vertices drawn back toward the knuckles), so the tips stand apart;
- a fine crease across the back of the fingers at each of the two joints;
- the grooves shaded a little darker (vertex colour), so the fingers read
  from a distance.
"""
import math

import numpy as np
from mathutils import Vector

GROOVE_W = 0.0034  # m, the groove's half width (gaussian)
GROOVE_DEPTH = 0.55  # of the half thickness, at full depth
NOTCH = 0.011  # m, how far the notches between the tips reach back
CREASE = 0.0012  # m, depth of the joint creases on the back
SHADE = 0.72  # colour in the grooves' depths (1 = untouched)


def _dominant(v, gi):
    if not v.groups:
        return ''
    return gi[max(v.groups, key=lambda g: g.weight).group]


def carve(body, rig):
    """Carves both hands; returns the vertex colour layer's name."""
    M = rig.matrix_world
    mw = body.matrix_world
    inv = mw.inverted()
    gi = {vg.index: vg.name for vg in body.vertex_groups}
    shade = np.ones(len(body.data.vertices), dtype=np.float32)
    for side in ('Left', 'Right'):
        head = lambda n: M @ rig.data.bones[f'mixamorig:{side}{n}'].head_local  # noqa: E731
        W = head('Hand')
        I = [head(f'HandIndex{j}') for j in (1, 2, 3, 4)]
        T1 = head('HandThumb2')
        f = (I[0] - W).normalized()
        u = Vector((0, 0, 1))
        t = u.cross(f).normalized()
        if t.dot(T1 - W) < 0:
            t = -t
        a_k = (I[0] - W).dot(f)  # the knuckles
        a_j = [(I[1] - W).dot(f), (I[2] - W).dot(f)]  # the two finger joints
        # The paddle: the fingers' vertices (index-dominated, or the hand's
        # past the knuckles), never the thumb's.
        idx, P = [], []
        for v in body.data.vertices:
            g = _dominant(v, gi)
            if f'{side}Hand' not in g or 'Thumb' in g:
                continue
            p = mw @ v.co
            a = (p - W).dot(f)
            if 'Index' in g or a > a_k - 0.012:
                idx.append(v.index)
                P.append(((p - W).dot(f), (p - W).dot(t), (p - W).dot(u)))
        P = np.array(P)
        a_tip = P[:, 0].max()
        # Per slice along the hand: the paddle's sides, its middle height.
        bins = np.linspace(a_k - 0.012, a_tip, 24)
        lo = np.interp(P[:, 0], bins[:-1], [P[(P[:, 0] >= b0) & (P[:, 0] < b1), 1].min()
                                            if ((P[:, 0] >= b0) & (P[:, 0] < b1)).any() else np.nan
                                            for b0, b1 in zip(bins[:-1], bins[1:])])
        hi = np.interp(P[:, 0], bins[:-1], [P[(P[:, 0] >= b0) & (P[:, 0] < b1), 1].max()
                                            if ((P[:, 0] >= b0) & (P[:, 0] < b1)).any() else np.nan
                                            for b0, b1 in zip(bins[:-1], bins[1:])])
        mid = np.interp(P[:, 0], bins[:-1], [np.median(P[(P[:, 0] >= b0) & (P[:, 0] < b1), 2])
                                             if ((P[:, 0] >= b0) & (P[:, 0] < b1)).any() else np.nan
                                             for b0, b1 in zip(bins[:-1], bins[1:])])
        # Smooth the outlines so the grooves run straight, not wavy.
        for arr in (lo, hi, mid):
            m = np.isnan(arr)
            if m.any():
                arr[m] = np.interp(np.flatnonzero(m), np.flatnonzero(~m), arr[~m])
        span = a_tip - a_k
        for n, vi in enumerate(idx):
            a, l, h = P[n]
            w = hi[n] - lo[n]
            # Grooves at a quarter, half and three quarters across (the index
            # a touch wider, the little finger narrower).
            grooves = [lo[n] + w * q for q in (0.27, 0.52, 0.76)]
            dl = min(abs(l - g) for g in grooves)
            g = math.exp(-(dl / GROOVE_W) ** 2)
            # Depth: none at the knuckles, deepening to the tips.
            x = min(1.0, max(0.0, (a - a_k + 0.006) / max(span, 1e-6)))
            depth = GROOVE_DEPTH * (x ** 0.6)
            h2 = mid[n] + (h - mid[n]) * (1 - g * depth)
            # Notches between the tips: drawn back toward the knuckles.
            tip = min(1.0, max(0.0, (a - (a_tip - NOTCH * 1.6)) / (NOTCH * 1.6)))
            a2 = a - g * NOTCH * tip ** 1.5
            # Creases across the back at the finger joints.
            if h > mid[n]:
                for aj in a_j:
                    h2 -= CREASE * math.exp(-((a - aj) / 0.0024) ** 2) * (1 - 0.6 * g)
            p = W + f * a2 + t * l + u * h2
            body.data.vertices[vi].co = inv @ p
            shade[vi] = min(shade[vi], 1 - (1 - SHADE) * g * min(1.0, depth / GROOVE_DEPTH + 0.3))
        print('FINGERS', side, len(idx), 'verts, knuckles at', round(a_k, 3), 'tips at', round(a_tip, 3))
    # Shade the grooves (multiplied over the texture by the glTF material).
    name = 'FingerShade'
    attr = body.data.color_attributes.get(name) or body.data.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    cols = np.repeat(shade[:, None], 4, axis=1)
    cols[:, 3] = 1.0
    attr.data.foreach_set('color', cols.ravel())
    body.data.color_attributes.active_color = attr
    return name
