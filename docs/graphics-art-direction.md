# Graphics and art direction

**2026-10-04 user direction:** vegetation should move toward a Zelda-inspired,
soft stylized natural environment that matches the finished rabbit and meadow
grass. This supersedes the older visual-target sentence below for current tree
work; browser budgets and incremental implementation still apply.

Aim for roughly Roblox-level geometric simplicity and readable humanoids, with stronger lighting, weather, fog, materials, particles and spatial audio. “Roblox-like” is a complexity/readability reference, not a requirement to copy its assets or use its runtime. This replaces the older Zelda/BotW visual target.

## First environment

Build a compact rain clearing, roughly 40–60 m across, with a short path, stream edge, cabin and campfire gathering area. Start with a small portion in M1 and add the landmarks incrementally. Use large silhouettes, clear ground, a cool rainy exterior and a warm sheltered interior. The route between landmarks should create audible contrasts within a short walk and a vertical video frame.

Use simple ground and box/capsule collision proxies first. Keep the procedural terrain experiment as a reference; do not transplant its 2,000-unit, 320,000-triangle default into the first room. Seed any procedural geometry used in a shared world and version its parameters. Authored terrain can be introduced when it offers better control than the simple ground.

## Division of work

| Layer | Approach |
| --- | --- |
| Shapes | Primitive blockouts first; Blender for intentional cabin, tree, rock and avatar forms |
| Placement | Small authored world definition; instance repeated compatible props |
| Atmosphere | Runtime lighting, sky, distance fog, rain/smoke particles, restrained material variation |
| Characters | Existing humanoid proxy at a fixed scale, Idle/Walk; self-authored art later without requiring a wardrobe system |
| Materials | Begin with standard materials; introduce custom shaders only where they visibly improve the scene |

Use one principal directional light plus ambient/hemisphere fill, and a small warm local fire contribution. Explicitly configure shadows where needed; keep shadow casters and map size bounded. Match fog and sky colors. Tune tone mapping/exposure consistently; avoid assuming the terrain's custom shader already participates in standard material lighting or output transforms. Bloom is optional after a measured comparison, not the first atmosphere task.

Concentrate particles around the player and hide rain under shelter. Avoid heavy depth-of-field, motion blur, abrupt flashing or camera shake. Preserve natural sound contrast instead of turning every visible effect into another loud source.

Baked lighting can help unique static structures; repeated objects may use shared shading/AO and instancing. Baking and instancing are not fundamentally incompatible, despite an overly absolute statement in the old plan, but unique per-instance lighting needs additional data and material support. Dynamic day/night should not fight a strongly baked fixed-time appearance.

## Provisional budgets and measurement

These are planning targets, not measured capabilities or exact Roblox specifications. Establish a named integrated-GPU laptop/browser baseline in M1 and revise from measurements.

| Metric | Initial target |
| --- | --- |
| Normal play | Aim for 60 fps; maintain at least 30 fps on the recorded baseline device, including 8-player validation later |
| Scene geometry | Start below roughly 150k visible triangles, avatar roughly 2k–10k triangles |
| Draw calls | Start below roughly 150; track shadows and transparency separately |
| Resolution | Cap DPR around 1.5 initially, expose lower quality if needed |
| Initial essential transfer | Aim for ≤10 MB compressed total including first audio; defer other scenes/models/long recordings |
| Fresh entry | Aim for control within 10 seconds on a documented 20 Mbps/50 ms test profile |

Measure CPU/GPU frame time, long frames, draw calls, transfer bytes, decoded audio memory, load-to-control time and repeat-entry memory. Reduce particle coverage, shadows and unnecessary texture loads before compromising audio quality. A stable scene should also remain stable while recording a Short.

Every imported asset needs provenance and redistribution/recording rights documented before public release. Keep runtime files separate from source artwork and sound masters. Export compact glTF/GLB as appropriate; optimize only after inspecting the result and keeping originals. See [audio asset requirements](spatial-audio.md) and [technical debt](technical-debt.md).


## Pine reference study — 2026-10-04

Imported the user's Andriy Shekh Pine tree GLB, preserving the downloaded file at
`public/models/trees/pine-tree.glb`. Source/CC BY 4.0 credit and modifications are
recorded beside it in `CREDITS.md` and exposed in the wind test panel. Two meshes,
2,173 triangles and embedded textures make it a small first comparison asset.

The existing wind course now shows two stationary 5 m pines near Flat start:
original materials at (-3.5, -5), Sheem material/shading study at (3.5, -5).
`PineTreeStudy.tsx` clones materials and edited foliage geometry while preserving
loader-cached source textures/geometry. Owned clones are disposed on unmount.
The styled version removes gloss, uses alpha cutout leaves to avoid transparent
layer ordering, softens card normals and remaps the dark baked foliage palette.
Trunk normal-map detail is reduced. This is a visual reference study, not a full
new tree model or Nintendo asset. No new pine animation, audio or
wind obstruction is connected; existing wind vegetation and sound remain active.

Chrome rendered both variants without runtime/shader errors; world bounds verify
both are 5 m tall and grounded. An overview beside the rabbit was inspected.
Lint/build pass; the existing bundle-size warning remains. Full grove performance,
close-up/back views and cross-browser appearance require further art iteration.
Compare both at walk distance and around the trunk before choosing final shading.
This comparison can become a Short showing blockout, imported reference and the
first Sheem material treatment.

Pine shading refinement: preserve the accepted lower-canopy palette while smoothly
transitioning the upper tiers to a darker, richer green palette. Upper leaves retain
more source-texture contrast instead of the previous square-root lift everywhere.
A mild inner-canopy tint adds depth near the trunk. Height/radius attributes are
computed once from the source world bounds and only attached to the styled clone.
Global sunlight, exposure, original reference and grass/rabbit materials are unchanged.
Chrome overview rendering and lint/build pass after this refinement.

Pine tip refinement: the top 14% gradually retains more original leaf-card normal
direction, stronger texture contrast and a slightly tighter alpha cutout. This
reduces the uniformly shaded tuft while preserving the source tip geometry and
the accepted lower canopy. Chrome close-up rendering completed without runtime
errors; lint/build pass. The source's conical tip silhouette remains intentional
at this stage rather than being remodeled.


Pine trunk collision: both study pines share visual placement and 0.22 m trunk
footprints in `pineTreeLayout.ts`. Ground movement adds the 0.34 m character body
radius, resolves small movement steps against trunks and allows tangential sliding.
Resolved displacement drives gait speed and movement airflow, so a fully blocked
character stops locomotion. Foliage remains passable; this does not add camera or
branch collision, or retrofit the old blockout trees. Acceptance: approach either
trunk head-on while walking/running, stop at contact, then steer around or away.
The collision regression script covers 20–120 fps, sliding, release and tunneling;
browser checks exercise the actual movement module against both wind-course pines.

Pine foliage contact study: Sheem leaves now deform locally around an upright
character contact volume (1.45 m rabbit; narrower, weaker response near ear tips).
Resolved travel velocity adds directional brushing and increases the response at
running speed. Trunk-adjacent leaf vertices stay anchored; contact eases in and
relaxes toward an immutable rest pose after departure. A stationary overlapping
character keeps leaves displaced. The imported reference remains static.
This is a soft leaf-mesh approximation, not articulated branch physics or exact
animated ear collision; no foliage sound was added. CPU deformation updates the
owned geometry, including its shadow pass, without React frame updates. Existing
stylized shading normals are retained. Full-grove performance is not validated.
Acceptance: walk/run through low branches of the Sheem pine, stop inside, then
leave and observe recovery. Unit checks cover anchoring, height, speed, rest and
30/60/120 fps. Browser checks on the imported mesh verify local displacement,
unchanged upper leaves/anchors and recovery; a close-up render was inspected.

Foliage opening correction: point-only displacement could leave the interior of
large leaf cards crossing the rabbit's neck. The study now reconstructs connected
fronds (welding UV-seam duplicates), tests triangle surfaces against overlapping
body/head/ear spheres, and rotates each contacted frond around its innermost vertex.
The solver prefers a consistent opening side, follows contact quickly, and eases
back after departure. Normals rotate with the leaves; fronds retain their shape.
This supersedes the per-vertex contact deformation above. It remains a bounded
horizontal hinge approximation, not branch dynamics; deeply constrained contacts
may not fully clear. The source reference and tree trunk stay unchanged.
Regression checks include a triangle crossing the head with all vertices outside
it, stationary clearance, fixed anchors, rigid shape and recovery at 30/60/120 fps.

Local brushing revision: user review rejected the dramatic whole-frond opening.
Removed the hinge/clearance search. Large cards are now subdivided once (all UV
and shading attributes interpolated), allowing small spatially local deformation
instead of rotating a connected branch. Contact follows travel with a small
outward component, capped at 0.16 m (less at walking speed/ear tips), eases in over
0.09 s and recovers over 0.38 s. Non-contact foliage and trunk-adjacent vertices
remain fixed. This intentionally prioritizes a subtle brush over forcing complete
clearance through deeply overlapping leaves; it is not a solid foliage collider.
Regression checks now cover local bend points, travel direction, maximum offset,
unaffected distant foliage and recovery at 30/60/120 fps.

Contact clearance follow-up: the 16 cm brush limit alone left deep overlaps inside
the rabbit. Keep that soft travel-driven response, then constrain penetrating
points to the overlapping body/head/ear surface, retaining corrected offsets for
smooth recovery. This correction can exceed the brush limit locally. Unreachable
upper foliage stays fixed. Small triangle interiors can still cross the proxy
between corrected vertices; a matching colour/depth shader masks only those
interior fragments, avoiding another dramatic whole-branch motion. The upright
proxy approximates the silhouette rather than tracking animated ear bones.
Tests check stationary head clearance, distant foliage and recovery; actual GLB
verification confirms local displacement and no movement in the upper canopy.

Single-frond reset (latest): user rejected the clearance/masking approach. Removed
body exclusion, interior clipping (including custom depth shader), whole-frond
hinges and card subdivision. Only one accessible low front/right connected frond
on the Sheem pine now responds; the `Brush test · one branch` label locates its tip.
It uses the existing grass contact response and one coherent bend displacement,
weighted quadratically from a fixed inner attachment to the tip. Nearby attachment
vertices are also fixed. The rest of the canopy stays static. No sound is added.
This is deliberately a one-branch visual acceptance experiment, not complete
character/foliage collision; unselected branches still intersect the character.
Validate this gentle bend/recovery before applying it to more leaf branches.

Isolated inspection setup: copied the selected source frond into empty space beside
the study trees (test tree origin 4,1), displaying only its 37 source triangles.
The full study pines are static again. `Compare locations > Leaf contact` places
the rabbit in front of this isolated branch; the small label marks its attachment.
An actual browser W-key approach caused deformation and leaving restored the
geometry (local residual below 1e-7), with no runtime errors. Visual inspection
still shows some head/leaf overlap: this setup exposes the motion for review and
does not claim completed collision avoidance. No audio or publication added.

Local grass response (current): removed the shared displacement that made an entire
frond react to one touch. Every leaf vertex now has its own `stepGrassContact`
response and recovery, attenuated toward that frond's attachment. Effective leaf
length is 0.18 m (maximum brush offset 0.153 m before attachment weighting).
No body projection, clipping, leaf hiding, or rigid frond rotation. Applied to both
the isolated branch and all styled-pine fronds; original reference stays static.
Added regression requiring the untouched opposite end of the SAME connected frond
to remain fixed, alongside attachment, gentle tip bend and recovery checks.
This is soft foliage brushing, not guaranteed nonpenetration for broad leaf cards.

Visibility tuning: whole-frond squared-distance attenuation made mid-branch touches
nearly imperceptible. Replaced it with a short fixed attachment zone (0.18–0.65 m
smooth transition), and raised effective leaf length from 0.18 to 0.30 m. Contact
range stays local; neighbouring untouched points do not move. A new mid-frond
regression requires visible deflection while the distant tip stays fixed.
Browser W-key traversal alongside the actual full Sheem pine measured 5.7–15.6 cm
peak local deflection, affecting 13–26 of 4,845 vertices above a 5 mm threshold
at sampled contact frames. This verifies live contact on the full tree, not only
the detached branch. Rendering had no runtime errors; lint/build and tests pass.

Comparison cleanup: keep only the styled Sheem pine in the wind scene. Removed
original reference placement and its trunk collider, detached-branch placement,
and its Leaf contact teleport entry. The isolated-frond code remains available
for future debugging. Updated visible labels/instructions and preserved attribution.
`pine-tree.glb` remains the unchanged source asset required at runtime; palette,
shading and contact modifications are code-driven, not a separately exported GLB.
