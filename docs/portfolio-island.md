# Portfolio island prototype

Moved to `/portfolio/7` on 2026-11-24: the room story (`portfolio-room.md`) took
`/portfolio`. Below, `/portfolio` means this island as it was then.

Implemented locally on 2026-10-08 at `/portfolio`. This is a personal portfolio
experiment, separate from Sheem's social ASMR product. The intended temporary
hosted address is `sheem.ai/portfolio`; no publication, hosting or DNS changes
were made. Use `npm run dev` and open `http://localhost:5173/portfolio` locally.

## First environment

A compact, orthographic island with shallow animated sea, a decorative dock,
workshop, telescope, garden bench, trees and a stepping-stone path. The existing
Sheem v65 rabbit supplies Idle/Walk/Run, blinking and grounded feet. Walking is
bounded to the island; circular collision proxies surround the cabin, telescope,
bench and tree trunks. The outer sand rim and dock are decorative in this pass.

WASD/arrows move relative to the fixed camera heading, Shift runs, clicking ground sets a
straight-line destination, and coarse-pointer devices receive a touch D-pad.
Click movement stops at obstacles; it does not find a path around buildings.
Input clears on blur/visibility changes. Frame state is owned through refs rather
than React updates. Reduced-motion preference freezes ocean animation and skips
the opening camera flight.

Approaching a landmark exposes an E/click action. All three destinations also
open from the persistent navigation and scene labels. Native modal dialogs pause
movement, trap focus, close with Escape and restore the previous focus. Content
is explicitly provisional: no invented projects, employment history or contact
links. No audio is connected in this environment pass.

## Separation and later extraction

`src/portfolio/` owns the route UI, styling, scene, layout and collision helpers.
`src/App.tsx` has only a lazy route registration. Sheem's scenes and character
implementation are preserved; no dependencies or lockfile changes were needed.

For a future standalone repository, bring:

- `src/portfolio/` and adjust the single character import in `IslandScene.tsx`.
- `src/sheem/characters/RabbitModel.tsx`, `rabbitGrounding.ts`, `rabbitBlink.ts`.
- `public/models/rabbit/sheem-rabbit-v65.glb` (about 2.8 MB); older model versions
  and the rest of Sheem's public assets are not needed by this route.
- The existing React/TypeScript/Vite/R3F/Three/Drei versions and necessary config.
- `scripts/check-portfolio-island.mjs`, adjusting its source path if moved.

Set the new entry route, page metadata/favicon, viewport/root CSS, actual profile
content, runtime asset rights and SPA deep-link handling at extraction time.
This is a migration inventory, not a request to create a repository or deploy.
Current shared app entry still includes Sheem code; standalone packaging should
be measured separately.

## Verification and next review

- `npm run lint` and `npm run build` pass; the existing large main-bundle warning
  remains.
- `node scripts/check-portfolio-island.mjs` checks the shore boundary, obstacle
  blocking/release at 20–120 fps, and reachable interaction zones.
- Local headless Chrome at 1440×1000 and 390×844 rendered without runtime or shader
  errors. Inspected screenshots: `/private/tmp/portfolio-desktop.png` and
  `/private/tmp/portfolio-mobile.png` (temporary local artifacts, not tracked).
- Browser checks exercised WASD walking, proximity and E opening, paused movement
  in dialogs, Escape closing, reset, ground-click travel, blur stopping, responsive
  camera resize and touch movement. Native dialog opening focuses the close button.
- The desktop scene reported 103 render calls / 54,879 triangles; this is a scene
  counter snapshot, not an FPS or real mobile-device performance certification.
- Safari/Firefox, physical mobile devices, slow-network/error recovery and
  sustained performance are not yet verified. There is no audio listening test.

Observable acceptance: enter at the dock edge, walk to the workshop, open its
panel, close it and return to the dock; repeat using touch or direct navigation.
Next user review should assess island scale, rabbit readability, camera distance
and atmosphere before investing in detailed art or real project exhibits.

Can this become a compelling YouTube Short? Yes: a 15–20 second sequence from the
dock to the workshop, showing the rabbit walk, approach prompt and project panel.
No recording or publication was performed.

## English UI and arrival camera — 2026-10-08

All portfolio copy, landmark descriptions, loading/error states and accessible
control labels are now English. The route declares `lang="en"`.

Once the rabbit loads, the camera holds the whole island for 0.85 seconds, then
smoothly zooms in and lowers its angle over 3.2 seconds. The landing view follows
the rabbit with gentle damping; the title and field notes disappear to clear the
play area. Movement remains available during arrival. Resizing adapts framing
without replaying the introduction. Reduced motion goes straight to the close
view and follows without camera lag; toggling the preference never restarts the
intro after arrival. Dock reset keeps the close view and follows the rabbit back.

Validation: lint, build and the island collision checks pass (the existing bundle
warning remains). Desktop Chrome sampled overview → intermediate → close camera
zooms of 34.48 → 69.39 → 100 at 1440×1000. Walking moved both rabbit and follow
camera. A 390×844 viewport settled at zoom 39. English modal copy and immediate
arrival with reduced motion were checked; no runtime/shader errors were reported.
Wide/close/mobile screenshots were inspected under `/private/tmp/portfolio-arrival-*.png`.
Physical devices and other browsers remain untested.

Short acceptance: refresh `/portfolio`, see the entire island, watch the camera
settle behind the rabbit, then walk toward the workshop without a camera cut.

## Living water — 2026-10-08

`src/portfolio/Ocean.tsx` now owns the water surface. Three crossing swells displace
its geometry; finer ripple slopes drive soft sky reflection and warm sun glints.
Shallow turquoise water transitions into deeper blue, with drifting caustic-like
light patterns. Broken foam fronts travel inward and dissipate beside the island.
These replace the previous static concentric ring meshes and diagonal stripe
shader. This is stylized procedural water, not fluid simulation or scene refraction.
No textures, dependencies, audio or changes to Sheem's own environments were added.

Water time advances through the frame loop. Reduced motion freezes the current
surface without resetting its phase; owned mesh/material resources use R3F cleanup.
The surface uses 140×140 subdivisions; all smaller lighting detail is fragment-based.

Validation: lint and build pass, retaining the existing bundle warning. Headless
Chrome at 1440×1000 and 390×844 rendered without runtime/shader errors. The water
clock advanced from 5.27 to 7.24 seconds and remained unchanged under reduced motion.
The close desktop view reported 72 render calls and 72,007 triangles (different
camera framing from the initial overview snapshot; not a performance benchmark).
Inspected `/private/tmp/portfolio-water-a.png`, `portfolio-water-b.png` and
`portfolio-water-mobile.png`. Real mobile GPU performance and other browsers remain
untested. Acceptance/Short: watch the dock-side water for several seconds; foam
should move toward shore while reflected light shifts across crossing ripples.

### Water overview readability correction

The user reported an uncomfortable repeating highlight grid in the opening wide
view. Water detail now follows the orthographic camera's visible world span
(smoothly from 0 at 26 units to 1 at 12 units), rather than camera distance.
Fragment derivatives additionally suppress features with a large pixel footprint.
Wide views flatten fine ripple normals, remove sharp sun glints/caustics and soften
foam contrast; distant offshore highlights remain attenuated even in close views.
Close shore water retains its ripple and foam treatment. No camera or movement
behavior changed.

Lint/build pass (existing bundle warning). Chrome overview and close screenshots
were inspected at 1440×1000; the water detail uniform progressed from 0 to 1 across
the entry flight. Mobile framing and reduced motion were also exercised without
runtime/shader errors. Screenshots: `/private/tmp/portfolio-water-lod-wide.png`
and `/private/tmp/portfolio-water-lod-close.png`. Acceptance: the opening sea should
read as a calm background without a luminous grid; water detail should return
continuously as the camera approaches the rabbit.

## Dimensional water and scene reflection — 2026-10-08

The user clarified that the target is a portfolio suitable for sharing on LinkedIn,
and accepted a more realistic water treatment. This raises the visual target;
the flat round island and primitive props are still blockout art, not a claim of
publication-ready quality. No publishing or infrastructure action was requested.

Replaced the surface treatment with three broad, irregularly phased swells whose
height and small horizontal crest travel deform actual geometry. Offshore wave
amplitudes are 0.38, 0.19 and 0.075 scene units, damped toward shore. Macro slopes
remain visible at every camera scale; only fine ripples/caustics use screen LOD.
Depth color, broad sky reflection and restrained sunlight expose the wave faces.
Foam is restricted to a narrow beach swash zone instead of repeated sea-wide rings.

A 768×768 planar reflection pass renders the real dock/island into an owned target,
with water hidden and underwater geometry clipped. Surface slopes distort the
reflection and a small multi-tap filter softens it. Transparent background and
smooth screen-edge attenuation prevent a rectangular reflection boundary. The
reflection approximates a mean water plane; it is not ray tracing, fluid dynamics,
transparency or physical underwater refraction. Procedural sky lighting is used
for broad environmental reflection.

The 240×240 mesh has 58,081 vertices, concentrated near the island instead of
uniformly across the 240-unit surface. Reflection render targets are created and
disposed in effect lifecycle, including StrictMode; renderer target, clear state,
clipping, shadow updates, tone mapping and XR state are restored after each pass.
Reduced motion keeps the current wave phase frozen while camera-dependent
reflection stays correct. No new dependencies, model assets or audio were added.

Validation: lint/build pass, with the existing bundle warning. Headless Chrome
1440×1000 and 390×844 exercised overview/arrival/close/follow-camera and reduced
motion without runtime or shader errors. Inspected screenshots are at
`/private/tmp/portfolio-water-volume-{wide,close,mobile}.png`. A route exit/re-entry
confirmed reflectionReady=1, target width=768, restored clipping/shadow settings
and zero shader errors before/after remount. This adds a scene render each frame;
physical-device performance, long-session memory and other browsers remain
unverified. Acceptance/Short: compare the old flat surface with offshore swells,
then approach the dock to see its reflection bend with the water.

Next visual review should address the island silhouette/elevation, vegetation and
building detail as a coherent art pass before treating the portfolio as ready to
share. Water polish alone does not finish the environment or replace real projects.

## Archipelago arrival — 2026-10-08

The opening now establishes a surrounding archipelago before traveling into the
home island. Four authored coastlines (rounded Catmull–Rom contours with beveled
sand/grass layers) and a sea-stack cluster provide distinct silhouettes:

- A crescent lagoon with leaning palms, west of the home island.
- An elongated pine/rock ridge to the northeast.
- A compact northern lighthouse island, including tower band, lantern supports
  and roof.
- A smaller green islet to the southeast and exposed rocks to the southwest.

`archipelagoLayout.ts` owns placement, outlines and shallow-water volumes;
`IslandArchipelago.tsx` builds the scenery. These islands are decorative; movement
and interaction remain on the existing home island. Their geometry participates
in water reflections. Smoothly merged, approximate shallow-water color volumes
and wave damping connect them to the sea without sharp seams between islands.

After the rabbit is ready, the camera holds the archipelago for 1.3 seconds and
makes a continuous 5.6-second curved approach with logarithmic zoom and a lowering
view angle. It settles into the existing rabbit follow view. Movement stays active;
reduced motion skips the flight. The overview uses one English destination marker;
project labels appear only when the visible span becomes less than 34 units.
Portrait screens use a smaller marker so it does not hide the home island.

The ocean now extends 640 units to cover the tall portrait overview; its existing
58,081 vertices remain concentrated near the islands. Macro normal contrast fades
at the largest view scales, while near-view swells remain intact. New scenery has
no additional shadow passes; the main island retains its existing shadow budget.

Validation: lint/build pass (existing main-bundle warning). Chrome tested the
1440×1000 opening (zoom 13.33), approach and arrival (zoom 100), movement, modal and
390×844 resizing, plus a fresh portrait opening (zoom 4.48) and reduced motion.
No runtime/shader errors were reported. Inspected wide/close/mobile screenshots
under `/private/tmp/portfolio-archipelago-*.png` and the corrected portrait opening
at `/private/tmp/portfolio-archipelago-portrait-wide.png`. Actual mobile GPU and
cross-browser performance remain unverified. A macOS case-insensitive module name
collision was resolved with distinct layout/component filenames.

Acceptance/Short: refresh the route, recognize several different islands and the
marked home island, then follow one uninterrupted shot to the rabbit. Check both
portrait and landscape for ocean edges, obscured labels and camera cuts. This is
an opening-scene increment; it does not claim every portfolio detail is finished.

## Inhabited neighboring islands — 2026-10-08

Filled the open quadrants with four more authored islands: a harbor settlement
with two piers, a village with a shared well/bench, a farm with vegetable beds and
a rotating windmill, and a fishing hamlet with a net-drying rack. Added a keeper's
cottage/dock to the lighthouse and a cabin to the pine island. New details include
window frames, doors, chimneys, planter boxes, paths, fences, barrels, crates and
small static resident figures. These figures are scenery, not networked players.
There are now eight surrounding land islands plus the sea stacks and playable
home island. New shallow-water volumes are derived from the same island layout.

`SettlementScenery.tsx` batches each settlement's static geometry with vertex colors
into one mesh (six settlement meshes total). Four boats and windmill blades are
separate animated batches. Boats sample the matching CPU swell field in
`oceanSurface.ts`, following surface height and slope with damping. This module
also owns the shared GLSL swell source used by the ocean. The mean-height sample
approximates the shader's small horizontal crest displacement. Reduced motion
freezes the shared phase and windmill. Owned geometry is disposed on unmount.

House/tree overlaps and keeper-cottage placement were adjusted. The desktop
opening retains its composition; the portrait opening uses a 96-unit width to give
the outer settlements margin. Home-island controls, collision and destination
transition remain unchanged. No dependencies or external assets were added.

Validation: lint/build and island collision checks pass; the existing main-bundle
warning remains. Chrome exercised desktop overview/approach/follow, modal opening,
mobile layout and reduced motion without runtime/shader errors. Six batched
settlements were present; windmill rotation and boat pitch/height changed over
1.2 seconds. A boat's sampled water-follow error was about 0.012 scene units while
moving; both animations froze under reduced motion. Inspected screenshots:
`/private/tmp/portfolio-settlements-wide.png` and
`/private/tmp/portfolio-settlements-portrait.png`. Physical mobile GPU performance
and other browsers remain untested.

Acceptance/Short: the opening should read as a small inhabited archipelago, with
homes, working docks and gardens surrounding the marked home island. A closer
shot can show the windmill and a boat following the water. This remains scenery;
travel to neighboring islands and actual multiplayer were not added.

## Distant water without repeating blotches — 2026-10-08

Removed direct swell-height tinting from the ocean color. The prior report also
claimed cloud noise was removed; follow-up inspection found that code still
present (corrected below). These terms left repeating patches even when fine ripple detail was
disabled. Macro normal contrast now smoothly fades to zero at overview scale
(visible spans 24–54), while close views retain displaced geometry, surface
normals and planar reflections. Shallow-water color transitions remain.

Validation: lint and production build pass (existing main-bundle size warning).
Chrome desktop overview and close screenshots were inspected; the overview has
even open-water color without the repeating swell patches. Camera arrival,
movement, project dialog, mobile layout and reduced motion passed with no logged
runtime/shader errors. Physical mobile GPU performance remains untested.

Acceptance: refresh `/portfolio`; open water should remain visually quiet during
the wide opening, with water detail appearing smoothly as the camera approaches.

## Water shading through the camera approach — 2026-10-08

The overview-only fix still allowed broad blotches to reappear during the flight:
as macro normals faded in, a directional `waveFace` term mixed up to 38% additional
sky color into alternating wave slopes. Removed that artificial color mask and
the remaining cloud-noise reflection. Open-water sky/Fresnel shading now uses a
restrained slope response, with softer diffuse contrast. Geometry displacement,
scene-reflection distortion, shoreline foam and close ripple detail remain.

Validation: lint/build pass with the existing bundle warning. Chrome captured six
stages of the actual arrival at visible spans 65, 50, 40, 30, 20 and 10; inspected
the intermediate screenshots for the reported bands, with no runtime/shader
errors. Acceptance/Short: record the entire approach, not just its endpoints;
water should remain calm as its reflection detail appears. Other browsers and
physical mobile hardware were not checked in this pass.

## Resume experience book — 2026-10-09

Added five English experience chapters adapted from the supplied `docs/Resume.pdf`:
Bridge, BYU Archaeology, Fitzza, Neighbor, and BYU Broadcasting Digital Media.
Company, role, location, contributions and reported metrics are kept in
`experience.ts`, separate from `ExperienceBook.tsx`. Fitzza dates are intentionally
omitted pending clarification: the PDF reads “Apr 2024 - Nov 2022.” No corrected
dates were inferred. The original PDF remains untouched; contact details and the
full PDF are not bundled into this experience-only feature.

The header's Experience button and existing garden/bench landmark open the same
native modal book. Desktop has contents and chapter pages side by side; mobile
has a horizontally scrollable contents strip and a single readable column.
Chapters support direct selection and previous/next buttons, selectable text,
focus on the new chapter, boundary-disabled controls, Escape, focus restoration,
and reduced-motion styling. Existing modal movement pausing is reused. This is
the reading/content stage: seated rabbit, bag/book extraction and a dedicated
camera-to-book animation are not implemented.

Validation: lint/build pass with the existing bundle-size warning. Chrome tested
all five chapters, first/last navigation, Escape and desktop/mobile screenshots;
a mobile grid overflow was corrected and rechecked. No runtime errors logged.
Acceptance: open Experience immediately from the header, read any company without
walking or paging through other roles, then return to the island. The same book
is available at the bench. This provides the content surface for a later Short
showing the seated reading interaction; it does not yet claim that animation.

## Bench-to-notebook reading sequence — 2026-10-09

The bench and its landmark now start an authored reading sequence rather than
opening the experience dialog immediately. `reading.ts` owns the mutable phase
state and a small collision-aware A* route, smoothed with line-of-sight checks.
The rabbit walks to the front of the bench, turns, hops back onto the seat,
reaches toward the front satchel, raises and unfolds a notebook on its lap.
The camera eases to an unobstructed front three-quarter portrait. Click the actual
3D notebook (or the keyboard-accessible Read button / E) to move the camera toward
the pages and dissolve into the selectable-text experience book.

Closing the reader reverses the camera to the seated portrait. Stand up / Escape
packs the book and reverses the seat transition before restoring movement.
Walking can be canceled; interruptions during sitting, unpacking and zooming
follow the corresponding exit stages without teleporting back to spawn. Repeated
bench clicks are ignored while occupied. Normal movement, reset and header actions
are gated during the sequence. The header Experience shortcut still opens the
reader immediately when exploring. The selected chapter persists across both
entry paths and is reflected on the physical notebook after closing the reader.

`ReadingRabbit.ts` layers leg, arm, head, ear and bag poses over the existing V65
rig. `RabbitModel` gained an optional post-animation pose callback with owned
bone snapshots restored before the next mixer/grounding update; other consumers
do not pass this callback. Seating uses a matching support-height curve so the
existing grounding solver does not pull the seated character down to the ground.
The short backward hop clears the bench before settling. This is procedural
choreography on the existing single-bone arms, not a new articulated-finger rig or
cloth/contact simulation. Alignment was checked from the authored camera views.

`Notebook.tsx` owns/disposes its canvas page textures and curved turning-sheet
geometry. Its textured pages derive from the same experience data as the HTML
reader, with a cover hinge, page block, spine shading and bookmark. The readable
modal uses a perspective page transition. The 3D spread and responsive HTML
reader share chapter content and palette, but the handoff is a visual dissolve,
not one pixel-identical continuous DOM surface. Reduced motion skips long seat
and camera transitions and disables reader page animation. No new assets,
packages, sound playback or deployment were added.

Validation: lint/build and the existing island checks pass; the main-bundle warning
remains. `node scripts/check-portfolio-reading.mjs` verifies obstacle clearance
from 32 starts. Chrome exercised the entire normal-motion journey, actual pointer
click on the 3D notebook, chapter persistence, return, standing, resumed movement,
and Escape during sitting/unpacking/zooming without runtime errors. Mobile 390×844
and reduced-motion entry/read/exit passed with no horizontal reader overflow.
Screenshots of seated, zooming, reading and returning states were inspected.
Physical mobile GPU performance and Safari/Firefox remain untested.

Acceptance/Short: refresh `/portfolio`, click the bench, watch one continuous
approach/seat/unfold sequence, click the notebook, select a different company,
close it, then stand up. Capture that full cycle as the observable demonstration;
never infer animation quality from the endpoint screenshots alone.

Lifecycle check: navigating to the existing rabbit preview, waiting for its lazy
model load, selecting Walk, and returning to `/portfolio` completed without
runtime errors; the portfolio remounted in idle exploration state.

## Seat contact correction — 2026-10-09

Measured posed V65 skin vertices inside the bench footprint: the body bottom was
about 0.549 while the seat top is 0.740. Raised the final actor/support height
from 0.38 to 0.58 using a shared seat-top constant and the measured local body
bottom, retaining the hop/easing curve. Book and seated camera anchors follow the
same height; the notebook stays aligned with the rabbit. Browser sampling across
40 idle-breath frames measured body bottoms 0.7415–0.7515, above the seat top,
and standing returned to exploration at ground y=0 without runtime errors.
Lint/build and all 32 bench path checks pass. This is a calibrated V65 pose
correction, not a general-purpose mesh/seat collision solver.

Notebook lap spacing refinement: lowered the open notebook by 0.10 scene units,
moved it forward by 0.12, flattened its pitch and slightly reduced its scale to
leave the rabbit's chin and chest visible. Adjusted supporting arm directions.
Shared `BOOK_LAP` anchors now drive both the physical book and its camera target,
including the approach direction normal to the pages. Inspected seated and
mid-zoom Chrome screenshots; full read/return/stand and chapter persistence pass
without runtime errors. Lint/build pass with the existing bundle warning.


## Continuous satchel extraction — 2026-10-09

Replaced the portfolio rabbit's rigid pouch with a hollow leather satchel and a
separately hinged flap/clasp. The folded notebook exists at its final scale inside
the pouch from the beginning; its walls hide it until extraction. The pouch and
notebook dimensions now fit each other. The lap anchor remains clear of the face,
and the reader camera derives its framing from that shared notebook scale.

A single reversible progress score coordinates reaching, opening the flap,
lifting the closed book vertically through the mouth, carrying it to the lap,
closing the flap and unfolding the pages. Unpacking takes 4.8 seconds; packing
reverses the same path over 4.2 seconds. Cancellation reverses from the current
progress. This replaces the earlier visibility threshold and scale-up effect.
Arms follow the latch and book using the existing single-bone rig; articulated
finger grasp and physical contact simulation are not implemented.

The optional RabbitModel preparation callback removes only rigid Bag-weighted
triangles from owned geometry clones on this portfolio instance. Cleanup disposes
the clones and restores original geometry, leaving the cached/source GLB and
other rabbit consumers unchanged. No new packages or deployment changes.

Validation: lint/build pass (existing bundle-size warning). The reading path check
passes all 32 starts. The satchel regression check verifies closed-book fit,
ordered flap/lift/unfold timing, sampled front-wall clearance, and repeated
geometry setup/cleanup without mutating the loader asset. Chrome screenshots of
seven extraction stages were inspected; the full unpack/read/change chapter/
return/pack/stand journey passed without runtime errors and retained the chapter.

Acceptance/Short: click the bench and frame the rabbit close enough to see the
flap open before a fixed-size folded notebook comes out through the bag mouth.
Continue through the lap unfold, reader zoom and reverse packing sequence.

Chrome also verified the actual 3D notebook pointer target, Escape during sitting,
unpacking and zooming, resumed movement, and navigation to the existing rabbit
preview (Walk) and back, all without runtime errors. Physical mobile GPU
performance and Safari/Firefox were not retested for this satchel change.


## Satchel proportion and attachment correction — 2026-10-09

The first hollow pouch was oversized and detached from the rabbit's body in side
view. Keep the original crossbody concept: scale the replacement pouch to 60%,
rotate it 0.3 radians around the hip and move its anchor back toward the authored
strap attachment. Sample that anchor after the seated body pose so leaning does
not separate the pouch from the torso. The notebook is reduced by the same ratio,
remains fixed-size throughout extraction, and turns out of the angled pouch as it
moves to the lap. Lower/bring in its lap anchor and supporting arms to suit the
smaller spread. The zoomed reader continues to use the shared book dimensions.

The clearance regression now transforms book samples into the rotated pouch's
local frame. Lint/build, satchel clearance/setup cleanup and 32 bench paths pass;
the existing bundle warning remains. No source character asset changes.

Final Chrome checks inspected seven extraction stages, the smaller lap spread,
reverse packing and standing front/side attachment views without runtime errors.
The shared reader zoom framing remains derived from BOOK_LAP; its complete modal
journey was not rerun in this proportion-only pass.


## Bench notebook replaces the satchel — 2026-10-09

Supersedes the two satchel iterations above. The portfolio rabbit now has no
pouch or crossbody straps. V65 stores accessories in a merged mesh, so the owned
instance preparation filters triangles with the three exact authored bag/strap/
clasp vertex tints. Fur, face, scarf and the cached source GLB are preserved.
The preparation cleanup restores source geometry on unmount/StrictMode remount.

The notebook is now a world-space sibling of the rabbit. It rests closed beside
the seat while the player explores, walks over and sits; pickup starts only once
seated. A reversible reach/lift/carry/unfold score moves it from the bench onto
the lap (3.2 seconds), then closes and replaces it before standing (2.8 seconds).
The notebook keeps a constant scale and the original page/reader interaction.
Clicking the resting book starts the bench approach, while clicking the lap book
opens the experience reader. The original single-bone hand rig remains a
procedural pose approximation rather than articulated finger/contact simulation.

Removed obsolete satchel components and its regression script. The replacement
`node scripts/check-portfolio-notebook.mjs` checks bench clearance, pickup ordering
and complete bag/strap removal against the actual V65 GLB with repeated cleanup.
The bench path test still checks 32 starts. Lint/build pass with the existing
bundle warning. Chrome exercised an actual click on the resting book, unchanged
book coordinates during sitting, pickup, lap-book click into the reader, close,
return to the exact bench position and standing, without runtime errors.

Acceptance/Short: show the unoccupied bench with a closed book, click the book,
follow the rabbit sitting and opening it on its lap, read an experience, then
watch it return the book and leave. No bag appears in this sequence.


## Articulated arms and hand-owned reading — 2026-10-09

Replaces the single-bone arm approximation. A non-destructive Blender derivative
adds Forearm, Hand and Grip bones on both sides, with blended skin weights and
preserved Idle/Walk/Run clips. The reproducible builder and editable Blender source
are in `art/characters/portfolio`; the portfolio loads its own GLB through an
optional RabbitModel modelUrl. Other consumers retain V65.

The authored procedural sequence now has anticipation/body lean, reach, a contact
hold before lift, one-handed carry, second-hand support, opening, and the reverse
return. Fixed-length two-bone IK uses elbow poles and independent wrist orientation.
After grasp, both book position and rotation derive from the actual primary Grip
socket. The secondary Grip follows the transformed hinged cover, sliding from its
spine toward the edge as reach permits. The torso/neck accompany the gesture.
A sampled deformed-pelvis support correction maintains contact with the bench as
the body leans. State stays in refs and scratch vectors are reused in frame loops.

This is a contact-constrained procedural performance using an authored rig and
timeline, not a baked mocap clip, articulated-finger simulation, or general physics
solver. The rounded paw design is retained. Contact-socket accuracy does not by
itself prove all visible mesh surfaces are collision-free from every viewpoint.

Development-only `/portfolio?readingLab=1` exposes a timeline scrubber, play/return
and front/side/three-quarter views. It is absent from the production visitor flow.
`check-portfolio-arm-ik.mjs` verifies 400 reachable targets plus clamped/degenerate
cases without stretching bone lengths. The notebook test verifies the real exported
GLB's weighted elbow/wrist joints, Grip sockets, original locomotion clips and
bag removal cleanup. Browser contact audit:
`node scripts/check-portfolio-reading-browser.mjs` (Vite and dedicated Chrome CDP
9227 required; endpoints/output folder can be overridden with PORTFOLIO_* env vars).

The 101-pose Chrome audit measured maximum locked contact error about 0.00164 scene
units (~1.6 mm at the scene's metre scale). Front/side and key pickup/open poses were
visually inspected. Normal book click → approach → sit → pickup → reader → return
completed without runtime errors and restored the exact bench coordinates.
Lint/build and the arm/notebook/path regressions pass with the pre-existing bundle
size warning. Physical mobile GPU performance and Safari/Firefox are not verified.

Acceptance/Short: record the whole reach/grasp/lift/support/open gesture, reverse
it mid-carry, then compare the side view while scrubbing; the book must remain
attached to the palm and the pelvis supported by the seat throughout.

Final validation: the persisted 101-pose browser audit passed with maximum socket
error 0.0016377 and sampled pelvis support error 0. Normal pointer-based reading
and return passed; Escape during sitting, mid-carry (2.8 seconds into pickup) and
zooming returned to idle and movement resumed. Mobile 390×844/reduced-motion
read/return passed without reader overflow. The unchanged rabbit preview still
played Walk, and navigating back remounted the portfolio without runtime errors.
