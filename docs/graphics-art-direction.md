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

## Broadleaf reference comparison — 2026-10-04

Imported the user's `Downloads/stylized_tree.glb` unchanged as
`public/models/trees/stylized-tree.glb` (14,893,416 bytes). Embedded metadata names
Stylized Tree by yonimantz, CC BY 4.0; provenance and modifications are recorded
in tree credits and exposed in the wind panel. Both variants are grounded, 5 m
high, at (-9,-5) and (-3,-5). Original materials remain intact in the left clone.
Sheem widens X/Z by 18%, uses matte bark, alpha-cutout leaves and a muted green
palette retaining source texture variation. Per-instance materials are owned and
disposed; geometry and embedded textures remain loader-owned/shared.
`Compare locations > Tree comparison` positions the player for a wider view.
This is a static appearance comparison, not a new baked GLB: no new broadleaf
wind/contact animation, collision, or audio. The heavy source remains confined to
the wind-course experiment; grove deployment needs LOD/geometry/texture review.
Browser rendering verified both 5 m bounds and no runtime errors. Lint/build pass
(existing bundle warning). A side-by-side render was inspected and the initial
pale leaf treatment deepened. This comparison can illustrate the next tree-style
Short; no content was published.

Broadleaf palette refinement: user requested more freshness than the initial
olive treatment. A three-stop texture-driven palette now uses deep green shadows,
fresh green midtones and restrained yellow-green highlights. This restores
saturation without changing lighting, trunk material, proportions or the original
reference. Browser comparison render inspected with no runtime errors; lint/build
pass (existing bundle-size warning).

Broadleaf fine-contrast pass: compressed the source-texture tonal range by 20%,
slightly lifted the darkest leaf palette and restrained bright leaf colours.
Fresh green midtones remain; scene lighting/shadows still provide canopy depth.
This targets small mottled patches without flattening the entire canopy or changing
geometry, alpha silhouettes, bark or the original comparison. Browser comparison
inspected without runtime errors; lint/build pass (existing bundle-size warning).

Broadleaf volume lighting: retained the approved palette shader unchanged. Added
six deterministically fitted canopy lighting lobes shared across both source leaf
meshes. A separate per-vertex crown-normal attribute blends rounded-volume lighting
with original leaf-face lighting (48% crown), including stable volume orientation
on leaf backs. Source positions, UVs, texture and normals remain unchanged; only
styled geometry clones own the extra attribute and are disposed on unmount.
This softens isolated card contrast while giving leaf clusters coherent light and
shade; it does not add leaf geometry, animation or a new bitmap texture. Lobe fitting
runs once during model setup, not every frame. No triangle-count increase.

Broadleaf finishing pass: preserved the leaf palette and added subtle, continuous
upper-canopy tonal pockets (up to 13% darkening) to break up uniform highlights.
Canopy-height bark blends toward a muted olive-brown so fine branches recede;
the exposed lower trunk retains its warm colour. No branches were removed.
Shared source-space coordinates keep both effects continuous across mesh splits;
styled geometry clones own these attributes and dispose on unmount. Browser
comparison inspected with no runtime errors and unchanged model bounds. Lint and
build pass, with the existing bundle-size warning.

Broadleaf trunk collision: both comparison trees now share visual placement and
solid footprints through `broadleafTreeLayout.ts`. Collider centres account for
the source trunk's small offset from the canopy centre; the styled width scales
its footprint. Reuses the pine's body-radius/substep/slide solver; foliage remains
passable. Browser-loaded solver checks passed at walking/running speeds and for
oblique sliding, with no runtime errors. Model bounds unchanged; lint/build pass
(existing bundle warning). Keyboard-driven visual feel still needs user review.

Broadleaf contact: the styled tree now consumes the same resolved character
contact body as the pine (rabbit radius 0.34 m, height 1.45 m). Reuses grass-like
local displacement/recovery, with attachment weights scaled to each small leaf's
size instead of pine-frond distances. Original comparison remains static. Only
leaf geometry moves; trunk collision and approved materials are unchanged. The
shared foliage helper now indexes rest vertices into horizontal cells and updates
nearby vertices plus recovering ones, avoiding full dense-canopy per-frame work.
This still assumes static tree transforms, as does the pine implementation.

Broadleaf accepted: removed the original comparison instance and its collider;
only Sheem broadleaf remains at (-3,-5). Updated the location shortcut and panel
instructions for trunk collision and low-leaf contact. The unchanged source GLB
and CC BY attribution remain required; styling and contact are runtime changes,
not a separately baked model. Contact checks on rabbit-height low leaves confirmed
local movement and recovery, with no fresh-load runtime errors.

## Retire faceted placeholder trees — 2026-10-04

Removed the old polygon-cluster Trees component and its placements from both the
main meadow/title scene and the wind course. Grass and its wind/contact/audio
behaviour are preserved. The styled pine and broadleaf remain in the wind course;
this removal does not automatically distribute those heavier models across the
main meadow. The title landscape is now more open until a separate placement pass.

## Styled meadow tree placement — 2026-10-04

The landing landscape and walking meadow now share 14 authored placements (eight
pines, six broadleaf trees), with the approved runtime materials. Heights range
from 5.2–13 m; width, yaw, crown spread and a slight upper-trunk lean vary by a
stable seed. A continuous source-space warp applies equally to bark/branches and
leaves. Density variants drop complete connected leaf cards rather than arbitrary
triangles; source GLBs, UVs and credits remain intact. Variations are built once,
not per frame. Per-tree geometry/material clones are disposed on unmount; cached
textures remain loader-owned. Independent Suspense boundaries let entry render
while trees load.

The river/title centre remains open, with mixed groups on either bank and a small
broadleaf beside the walking clearing. Layout data also supplies scaled/rotated
trunk footprints. Nearby walking trees use the existing local foliage-contact
response; distant decorative trees do not allocate contact state. This is static
placement/shape variety, not a new tree wind-animation system. Existing wind-course
specimens retain their sizes, positions, labels and contact behaviour.

Acceptance: landing screenshot shows varied silhouettes framing the river; Enter
shows the same layout at rabbit scale. Browser keyboard movement and nearby trunk
collision verified (0.502864 m body clearance); no runtime errors observed. Lint
and build pass (existing bundle-size warning). Desktop render counters were about
2.10 M triangles / 48 calls in the title scene, 1.74 M triangles in the walking view
(including terrain/grass and render passes); mobile performance and LOD are not yet
validated. A before/after landing pan can illustrate this milestone in a Short.

## Styled tree wind, stage 1 — 2026-10-04

The wind-course pine and broadleaf now take an optional ambient WindField. A shared
GPU deformation samples each tree at quarter/crown height at 10 Hz, smoothing the
world-space velocity before applying height-weighted bend and small leaf motion.
The base stays fixed; pine responds more slowly with smaller amplitude than
broadleaf. Direction, gusts, zones and terrain shelter come from the existing field,
never the character's relative air velocity. Calm and reduced-motion states settle
the displacement to zero. Material palettes and geometry topology are unchanged.
Matching depth shaders keep directional-light shadows aligned. Owned depth materials
are disposed along with the tree's other assets; source meshes are not mutated.
Changing wind settings preserves geometry and contact state rather than rebuilding.

GPU wind adds to the existing CPU contact deformation. Precise contact queries
still use resting leaf positions; accounting for the wind-displaced touch location
is stage 2. This turn connects only the two wind-course specimens; the title/meadow
placements remain unchanged pending evaluation in the course. No tree audio added.
Browser checks cover shader compilation, fixed-base weights, positive/reversed
wind, calm recovery and reduced motion. At 8 m/s the settled pre-wave crown offset
is 0.096 m for pine and 0.176 m for broadleaf. Lint/build pass with the existing
bundle-size warning. Acceptance: compare the two crowns at 0/4/8 m/s, reverse the
wind and toggle shelter/gust layers; the trunks must stay planted. This comparison
is suitable for a short visual wind demonstration.
