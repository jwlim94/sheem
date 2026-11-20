# Portfolio character study

Current review route: `/portfolio/5`. `/portfolio/character` remains an alias.

## Current student model

The default **Student** is a standing, backpack-only adaptation of Golden Bean's
Happy Hustle Boy. It has a real 20-bone humanoid skeleton, normalized skin weights,
and three baked GLB animation clips: **Idle** (4 s), **Walk** (1.333 s), and
**Wave** (3 s). The viewer blends clips, pauses/resumes animation, supports reduced
motion on first load, and keeps camera/model controls separate.

The source is one fused, posed surface, including laptop, hands and clothing.
Directly unposing it produced unacceptable stretched contact surfaces. The selected
adaptation retains the source head, face, hair, glasses, cap, backpack and sneakers,
with extraction-boundary repairs. The torso, garment deformation surfaces, arms,
hands and legs are newly reconstructed for neutral posture and articulation.
The source expression remains unchanged. This is an adaptation, not an entirely
original character or an unchanged source mesh with bones attached.

Walk uses a two-bone leg solution with a planted stance and lifted swing phase.
It is an **in-place** clip; a future moving character controller must synchronize
travel speed. Hands have attachment bones (`Grip.L/R` in Blender). There is no
facial/blink/lip-sync rig, independently articulated finger rig, cloth simulation,
or backpack-opening/laptop-taking animation in this pass.

## Files and reproduction

- Runtime: `public/models/happy-hustle/happy-student-rigged.glb`.
- Editable source: `art/characters/happy-hustle/happy-student-rigged.blend`.
- Studio renders: `student-idle.png`, `student-walk.png`, `student-wave.png` in
  the same authoring directory.
- Blender 4.4 pipeline: `inspect_source.py` → `analyze_rig.py` →
  `sample_surface.py` → `build_student_rig.py` → `animate_student.py`.
- `inspect_source.py` reads the user-supplied `~/Downloads/happy_hustle_boy.glb`.
- `build_rigged.py` is the **rejected direct-unpose experiment**. It does not
  generate the selected runtime asset. The earlier independently generated boy
  in `art/characters/boy/` is also not the selected character.

## Comparisons and provenance

**Original** preserves the supplied running pose; **Refined** adds a subtle frame
color adjustment and small J laptop badge. These comparison assets remain static.
Their source positions, normals, UVs and triangle indices were verified unchanged
between the two comparison GLBs. That assertion does not apply to Student.

- “Happy Hustle Boy” by **Golden Bean**.
- Source: <https://sketchfab.com/3d-models/happy-hustle-boy-bdc75c61891d42058fc414d0560f0a48>
- Source and adaptation license: **CC BY-NC-SA 4.0**.
- <https://creativecommons.org/licenses/by-nc-sa/4.0/>
- Attribution accompanies the viewer, GLB custom properties, and
  `public/models/happy-hustle/ATTRIBUTION.txt`. No production release performed.

## Acceptance and validation

Default entry shows the standing Student without the laptop. Idle visibly moves
head/chest/arms; Walk alternates feet without a pose snap at the loop; Wave raises
and lowers the hand. Switching animations blends, Pause freezes bones, switching
to Original and returning recreates the rig correctly. Verify front, side and back
at close range; facial proportions and backpack detail should remain recognizable.

Blender verifies finite vertices and normalized skin weights before export.
`verify_student_rig.py` additionally samples 17 poses per clip: exact matching
loop endpoints, minimum surface height above ground, and maximum mesh-edge stretch.
Results are saved to `rig-validation.json`; the final pass has no ground penetration
and edge-length ratios below 2 (Walk 1.914, Wave 1.608).
Native Chrome WebGL tests at 1440×1000 and 390×844 verify 20 bones, actual animation
pose changes, finite matrices, pause/resume, comparison remount, and absence of
runtime exceptions. Browser check: `node scripts/check-portfolio-student-rig-browser.mjs`
(Vite 5180, CDP 9227). Browser checks, lint and production build passed on
2026-10-10. The existing bundle-size warning remains.

Blender binaries are excluded from Tailwind's utility-class scan in `src/index.css`;
otherwise scanning authoring assets can stall Vite/builds. Animation time stays in
Three's mixer, outside React state. Each instance owns its cloned skeleton while
loader-cached textures/materials/geometry remain shared.
The studio uses a soft ambient grounding shadow rather than a contact-depth
render on every animation frame.

This is a functional character/animation study, not the finished cinematic story.
The reconstructed garment surfaces are simpler than the source's sculpted outfit.
Extreme poses and facial performance need another dedicated animation/art pass.
“Can this become a compelling YouTube Short?” Show the frozen running source,
then the backpack-only student breathing, walking and greeting the visitor.
