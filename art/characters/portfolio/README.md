# Portfolio reading rig

`build_reading_rig.py` opens the preserved V65 Blender source and creates
`portfolio-reading-rig.blend` and `public/models/rabbit/portfolio-reading-rig.glb`.
Run with Blender 4.4 or compatible: `Blender -b --python art/characters/portfolio/build_reading_rig.py`.

Each original arm is split into Arm → Forearm → Hand with a Grip socket. Blended
skin weights maintain the plush surface and existing shoulder/body weights.
Idle, Walk and Run remain available. The original V65 and other Sheem consumers
are not replaced. The portfolio filters the original merged bag/strap triangles.

Reading is an authored procedural contact sequence, not a mocap clip. The runtime
in `src/portfolio/ReadingRabbit.ts` solves fixed-length arm chains with elbow poles.
The primary Grip owns the book transform after contact; the second hand follows
the actual hinged cover. Motion phases and book path are in `bookChoreography.ts`.
This allows interrupted/reversed motion to maintain the same contact constraints.

Review locally at `/portfolio?readingLab=1` (development only): scrub the sequence,
play/return, and switch front/side/three-quarter cameras. Contact error is measured
at locked Grip sockets. This is not a surface collision or finger simulation;
the character retains rounded, unsplit paws.

Checks: `node scripts/check-portfolio-arm-ik.mjs` and
`node scripts/check-portfolio-notebook.mjs`, followed by the browser motion lab
and the normal bench/read/return flow.
