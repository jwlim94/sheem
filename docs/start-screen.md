# First start screen: The Meadow

Implementation on `feat/first-playable-world`, 2026-09-28. This is a title-screen and landscape-viewing milestone, not completion of the first playable multiplayer world.

## Experience

The root route opens on an animated, code-authored 3D meadow: rolling hills, a winding river, layered mountains, trees, wildflowers, swaying grass, drifting seeds, cloud movement and a slowly drifting camera. A restrained Sheem wordmark and lower-center **시작하기** button sit over the scene. The interface adapts to narrow touch screens.

Start dismisses the title into a landscape viewer. Drag to orbit; scroll or pinch to zoom. **시작 화면** or Escape returns to the title. There is no signup. This increment does not implement walking, avatars, collision, multiplayer, or positional/environmental audio.

Audio starts silent. The sound toggle enables a conservatively mixed synthesized stereo wind bed directly from a user gesture. It fades out on mute/hidden tab and closes its AudioContext when leaving the route. No external recordings or new runtime asset downloads are used. This is a title ambience experiment, not the production spatial-audio layer. Headphone listening and Safari/iOS audio acceptance remain manual follow-up work.

Reduced-motion preference stops autonomous scene animation and camera drift, disables CSS entrance animation and uses on-demand rendering. Manual orbit remains available. WebGL initialization failure exposes a retry message instead of enabling a nonfunctional start button.

## Code and preservation

- `src/sheem/SheemApp.tsx`: entry state, UI, error boundary and Canvas.
- `src/sheem/title/MeadowScene.tsx`: landscape assembly, shaders, instanced foliage and camera/viewer controls.
- `src/sheem/title/landscape.ts`: seeded deterministic geometry and height functions.
- `src/sheem/title/useAmbience.ts`: owned, opt-in preview audio lifecycle.
- `src/sheem/title/title.css`: responsive title presentation.
- `public/sheem-mark.svg`: code-authored favicon; no external font request.

The original six-cube movement scene is preserved in `MovementPrototype.tsx` at `/playground/movement`. Existing playground, character, lab and vanilla routes remain. Experiment routes are lazy-loaded so their model preloads no longer run on the title route.

The existing package versions and npm lockfile are unchanged. `npm ci` repaired the missing local Apple Silicon Rollup dependency. Three.js still produces a large main bundle (~318 KB gzipped); route splitting isolates experiments, but is not a full loading/performance optimization. Grass uses instancing, DPR is capped at 1.5, and shadows use one light. Physical-device frame-time budgets remain unmeasured.

## Verification

- `npm run build`: passed (existing large-chunk warning remains).
- `npm run lint`: passed.
- Automated local Chrome, 1440×1000: no browser/shader errors; title ready, entry, orbit, Escape return, explicit audio activation, mute, AudioContext closure on route change.
- Chrome touch emulation, 390×844: entry/return and no horizontal overflow; screenshot inspected.
- Small 320×568 and landscape 844×390 layouts: start button stays on screen; keyboard focus moves to Return and back to Start.
- Chrome with WebGL disabled: explicit failure message, disabled Start, and visible Retry.
- Reduced-motion Chrome: consecutive Canvas screenshots are identical when idle.
- No external startup requests from the title route.

Chrome emulation is not physical mobile/Safari/Firefox validation, and audio node checks are not a listening-quality certification. New source changes remain local until reviewed and pushed by the user.

## First Short (20–25 seconds)

1. 0–4 s: Show the title and the sunlit river. Caption: “A little world to slow down.”
2. 4–8 s: Enable ambience and click Start.
3. 8–18 s: Slowly turn across the meadow, leaving room to hear the wind.
4. 18–25 s: Return to the title. Ask: “What should this world sound like next — rain, a river, or a campfire?”

Record the actual browser, retain stereo audio, and describe this as an early landscape preview. The next playable increment should add bounded guest movement and a proper positional sound source, following the spatial-audio document.

## Meadow density refinement — 2026-09-29

Grass now grows in multi-blade tufts, with a seeded world-space density field creating tall, thick patches and shorter, open clearings. Dense patches have more blades and greater height; river margins stay open. The shared `grassDensity(x, z)` query can later inform player-driven rustling. Walking/contact sounds are not implemented by this visual change.

Foliage remains one instanced grass mesh with the existing wind shader. The increased instance/triangle budget needs physical mobile profiling before treating it as an MVP performance baseline. Build and lint pass; desktop Chrome visual inspection confirms visibly dense and sparse areas with no shader errors.

## Grass shape and ground integration — 2026-09-29

A short ground-cover layer now continues beneath a mixture of medium and tall tufts. Tall growth is probabilistic within softly warped density patches, rather than assigning one height to every blade in a patch. Narrow, seven-triangle blades curve continuously in the vertex shader, with varied lean and bend; roots blend toward the ground palette.

Grass and flower placement now samples the actual rendered terrain triangles. Previously, sampling only the underlying continuous height function caused short grass to sink below some slopes and exposed contour-like gaps. River margins receive irregular spacing rather than one sharp exclusion line. Dense foliage is still instanced; the added blade segments increase the geometry budget, so physical-device profiling remains outstanding. Build/lint and desktop Chrome rendering pass.

## Shared vegetation lighting — 2026-09-29

Grass now uses a customized MeshStandardMaterial with the scene's actual directional/hemisphere lighting, tree shadow maps and native fog. Ground-slope normals provide a deliberately soft canopy approximation; this is not physical leaf scattering. Grass receives shadows but does not cast thousands of individual leaf shadows. Base color is sampled from the same palette function as the terrain, and distant blades gradually lose color contrast rather than becoming pale lines.

The ground material adds subtle procedural mottling and fine detail that fades with distance. Existing short cover remains beneath the taller growth; instance counts were not increased. Nearby tufts share a slowly varying lay direction with individual variation, and the wind phase varies across broader areas. Material setup and shader patches live in `vegetationMaterials.ts`, with owned disposal and the existing reduced-motion time control.

Validation: build and lint pass; desktop and mobile-sized Chrome show no shader errors, and the entry interaction works. Desktop screenshots show tree shade continuing onto the grass and reduced distant contrast. Physical mobile hardware remains untested; increased fragment-lighting cost still needs profiling before broader release.

### Leaf contrast balance

Retain native shadows and grounded roots, but restore selected yellow-green tips through diffuse color (never emission). A deterministic per-blade accent varies the amount; middle-distance blades retain their palette, with ground-color blending deferred to 80–240 world units and a small color difference retained beyond that. No instances, geometry, assets or lights were added. Before/after Chrome screenshots use reduced motion and matching title/orbit views to compare highlights and shaded foliage. Build/lint and the two-view shader/entry smoke check pass.
