"""Length-preserving two-link IK for Blender asset authoring.

Inputs are armature-space joint positions, segment lengths and a knee pole.
No rabbit names, proportions, gait timings or world-up assumption live here.
"""
import math
from mathutils import Vector


def solve_two_bone(hip, ankle, upper_length, lower_length, pole):
    if min(upper_length, lower_length) <= 0:
        raise ValueError('Both limb segments must have positive length')
    hip, ankle, pole = Vector(hip), Vector(ankle), Vector(pole)
    direction = ankle - hip
    if direction.length < 1e-8:
        direction = Vector((0, 0, -1))
    else:
        direction.normalize()
    distance = max(abs(upper_length - lower_length) + 1e-6,
                   min((ankle - hip).length, upper_length + lower_length - 1e-6))
    bend = pole - hip
    bend -= direction * bend.dot(direction)
    if bend.length < 1e-8:
        axis = min((Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
                   key=lambda v: abs(v.dot(direction)))
        bend = axis - direction * axis.dot(direction)
    bend.normalize()
    along = (upper_length**2 - lower_length**2 + distance**2) / (2 * distance)
    height = math.sqrt(max(0, upper_length**2 - along**2))
    knee = hip + direction * along + bend * height
    return knee, hip + direction * distance
