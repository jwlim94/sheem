"""Run with Blender --background --python art/rigging/test_two_bone_ik.py."""
import sys
import unittest
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from two_bone_ik import solve_two_bone


class LimbSolverTests(unittest.TestCase):
    def assert_lengths(self, hip, knee, ankle, upper, lower):
        self.assertAlmostEqual((knee-hip).length, upper, places=5)
        self.assertAlmostEqual((ankle-knee).length, lower, places=5)

    def test_proportions_and_pole(self):
        for upper, lower in [(.32, .22), (.46, .43), (.15, .28)]:
            hip = Vector((.2, -.3, 1))
            target = hip + Vector((0, 0, -(upper+lower)*.8))
            for sign in [-1, 1]:
                knee, ankle = solve_two_bone(hip, target, upper, lower,
                                             hip+Vector((0, sign, 0)))
                self.assert_lengths(hip, knee, ankle, upper, lower)
                self.assertLess((ankle-target).length, 1e-5)
                self.assertGreater((knee.y-hip.y)*sign, 0)

    def test_unreachable_and_degenerate_targets(self):
        hip = Vector((0, 0, 0))
        for target in [(0, 0, 0), (0, 0, -10), (0, 0, -.01)]:
            knee, ankle = solve_two_bone(hip, target, .4, .25, (0, 0, -1))
            self.assert_lengths(hip, knee, ankle, .4, .25)
            self.assertLessEqual(ankle.length, .65)
            self.assertGreaterEqual(ankle.length, .15-1e-6)

    def test_invalid_lengths(self):
        with self.assertRaises(ValueError):
            solve_two_bone((0, 0, 0), (0, 0, -1), 0, .4, (0, -1, 0))


unittest.main(argv=[__file__])
