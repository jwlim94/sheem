# Existing repository audit

Inspected 2026-09-28 at HEAD `26b3adb`. This is a source/configuration/documentation audit with local static checks, not a browser playtest or listening certification. The existing working-tree change to `docs/sheem-project-plan.md` was read and preserved.

## Structure and coverage

| Area | Observed contents and purpose |
| --- | --- |
| Root | `package.json`, npm lockfile, Vite, strict TypeScript project references, ESLint, Prettier, HTML entry, gitignore; no root README or AGENTS before this pass |
| `src/main.tsx`, `App.tsx`, CSS | React StrictMode, BrowserRouter with five routes, full-screen canvas styling, Tailwind v4 import |
| `src/sheem/` | R3F root scene and `_vanilla/` comparison; barrel export |
| `src/playground/` | Terrain/sky/cloud scene, basic-shape/light/spring/model lab, action-spot character test, unmounted controller and audio experiments |
| `public/` | Four embedded-buffer glTF characters, six MP3s, three terrain textures, Vite icon, ignored original audio backups |
| Existing `docs/` | One evolving Korean plan, two archived plans, seven Three.js Journey chapter documents |
| Existing `notes/` | Four terrain/noise/GLSL/textures/scene learning notes; linked in [reference guide](reference-guide.md) |
| Local/generated directories | Installed `node_modules`, old `dist`, `.git`; these are not authoritative source. `.claude/settings.local.json` records local tool permissions; ignored `.mcp.json` is local tooling configuration, not application architecture |

No current server, database schema, auth implementation, test suite/test script, CI workflow, deployment manifest, or provider-link directory was found. This does not establish whether an external hosting account exists; no infrastructure was contacted or changed.

## Actual route behavior in source

| Route | Implementation | What it currently assembles |
| --- | --- | --- |
| `/` | `src/sheem/SheemApp.tsx` | Plane, six boxes, ambient/directional lights, camera-relative WASD/arrows, pointer lock; no avatar, audio, entry UI, collision, or network |
| `/vanilla` | `src/sheem/_vanilla/SheemAppVanilla.tsx` | Imperative Three.js equivalent, with render loop, resize/input handlers and disposal |
| `/playground` | `src/playground/Playground.tsx` | Leva, procedural terrain, gradient sky, 45 cloud components, OrbitControls; no mounted player or sound |
| `/playground/lab` | `Lab.tsx` and helpers | Shapes, light types, spring interactions, rotating externally hosted Khronos Duck model |
| `/playground/character` | `CharacterTest.tsx`, `CharacterWithActionSpots.tsx` | Knight movement and animation triggers around a circle; follow camera, no shared audio-position update |

`CharacterController.tsx` and `SpatialAudio.tsx` have no importing route or scene today. Historical checklists describe a formerly integrated scene; they do not describe the current route graph. Static imports also load lab code at application startup, including module-level model preload calls; future route isolation should remove that coupling.

## Reusable experiments and limitations

**Audio:** `SpatialAudio.tsx` contains a shared Three.js listener, one non-positional rain bed, five positional sources, linear distance attenuation, Leva controls, and background ducking near four sources. `playerState.ts` exposes a mutable `Vector3`. Listener position follows that vector; orientation stays at its default. There is no explicit audio-context resume flow, zone transition, filter-based occlusion, indoor/outdoor model, reverb, master product UI, or error/retry flow. Async load callbacks can outlive effect cleanup. Ducking uses a duplicated position list and can respond to disabled sources. Thunder is looped like the other files.

**Character:** `CharacterController.tsx` supports four models, Idle/Walk fades, world-axis keyboard movement, follow camera, and shared position updates. Movement is delta-based but diagonal input is not normalized. No collisions, grounding, orbiting follow camera, or bounds exist. Cached skinned scenes need independent skeleton instances before rendering multiple avatars. The action-spot variant is useful animation tooling, not the product controller.

**Terrain and atmosphere:** `ProceduralTerrain.tsx` creates CPU-side geometry using four-octave simplex noise, recomputes normals, and samples the same height function to clamp the camera. This is **not GPU-displaced terrain**, contrary to a general concern in the historical plan. Default 400×400 subdivisions produce 320,000 triangles over a 2,000-unit plane. Noise is unseeded between page loads. The shader provides slope/height texture variation and custom diffuse shading; rock texture sampling does not contribute to the final color. Fog GLSL exists, but no scene fog is attached and fog uniforms are not explicitly merged into the material. Several reversed `smoothstep` bounds and color-space handling need review before reuse. `GradientSky.tsx` is a reusable controllable gradient dome. There is no implemented rain-particle, river, cabin, campfire, day/night, or post-processing system. Light `castShadow` flags alone do not enable canvas shadows.

**App foundation:** TypeScript, React lifecycle, R3F, routing, Tailwind, linting, and npm locking are reusable. The aliases `@components`, `@hooks`, and `@lib` point at deleted directories; their presence is not evidence of those subsystems.

## Dependency evidence

Versions below are resolved in `package-lock.json`, not recommendations to upgrade.

| Layer | Locked versions |
| --- | --- |
| UI/build | React/React DOM 19.2.4; Vite 6.4.1; TypeScript 5.9.3; React Router 7.13.0; Tailwind 4.1.18 |
| Graphics | Three.js 0.176.0; R3F 9.5.0; Drei 10.7.7 |
| Experiments | React Spring Three 10.0.3; Leva 0.10.1; simplex-noise 4.0.3 |
| Networking | `colyseus.js` 0.16.22; declared but unused; no server dependencies |

Scripts: `dev`, `build` (`tsc -b && vite build`), `lint`, `format`, `format:check`, `preview`. Formatting scripts cover source TS/TSX only. No Node engine/version pin exists. Keep npm and the lockfile; do not infer installed packages from tutorial snippets.

## Asset inventory

| Group | Findings |
| --- | --- |
| Characters | Knight, Viking, Wizard, Worker; total 7.54 MB decimal; each has embedded buffers and 17 animations including Idle, Walk, SitDown, StandUp; no external image URI in these glTFs |
| Runtime sound files | Six MP3s total 18.86 MB: heavy rain, car, tent, tin roof, window, thunder; tent recording alone is 14.39 MB |
| Textures | Grass, rock, sand JPEGs total 2.65 MB |
| Local originals | Six ignored backups total 31.91 MB inside `public/sounds/_original/`; gitignore does not prevent Vite from serving/copying files in public |

Historical notes attribute characters to Quaternius and describe FFmpeg normalization to −16 LUFS. No per-file provenance/license ledger or measurement report is present, so rights, loop quality, actual loudness, channel counts, and decoded memory remain unverified. `ffprobe` could not run because local Homebrew FFmpeg references a missing `libx265.215.dylib`. No audio assets were modified. Stream and campfire audio still need sourcing. Vite's public-directory copying behavior makes the backup location a future packaging concern. [Vite asset handling](https://vite.dev/guide/assets.html)

## Existing decisions and historical changes

The August plan favors third-person humanoids, eventual self-authored Blender art, listener position at the player and orientation from the camera, code-authored atmosphere, and Blender-authored objects. It leaves terrain and Colyseus versus Socket.IO open. Earlier archive documents include slime avatars, chat, a database, and large world plans. Some learning references still mention the pre-pivot AI study application.

Git history corroborates removal of empty scaffolding and promotion of `SheemApp` to `/` in `26b3adb`, and removal of the pre-pivot reflection plan in `6ad98ba`. Do not recreate the deleted stub architecture just because archived diagrams show it. Current reconciled choices live in [technical architecture](technical-architecture.md).

## Baseline verification

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run build -- --outDir /private/tmp/sheem-doc-audit-build` | TypeScript step passed; Vite failed loading missing `@rollup/rollup-darwin-arm64` from local installation (Node 22.22.3) |
| Browser interactions, GPU performance, audio listening, multiplayer | Not exercised; build environment blocks reliable runtime validation and no network implementation exists |

Dependencies were not reinstalled, the lockfile was not regenerated, and the existing `dist` was not overwritten. Record this as an environment blocker, not evidence of a TypeScript error or a successful production build.
