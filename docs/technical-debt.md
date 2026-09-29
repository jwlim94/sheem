# Technical debt and experiments

Status: audit backlog, not changes performed. Keep implementation and assets intact until a scoped implementation task reaches the relevant trigger. Priorities indicate sequence, not permission to perform external actions.

| Item / evidence | Disposition | Priority / trigger and intended outcome |
| --- | --- | --- |
| Missing local `@rollup/rollup-darwin-arm64` | Repair toolchain | M0: reproduce clean installation with the existing lockfile; do not follow the generic error's lockfile-deletion suggestion blindly |
| No Node pin or CI/test suite | Introduce deliberately | M0 pin after validation; CI during authorized deployment setup; behavior tests as real logic is extracted |
| `SheemApp.tsx` root movement scene | Keep and evolve | M1: entry UI, avatar and sound integration; retain current movement behavior as a reference before replacing it |
| `_vanilla/SheemAppVanilla.tsx` | Keep reference | Useful R3F comparison; isolate from production bundle later, not a second product implementation |
| Unmounted `SpatialAudio.tsx` and `CharacterController.tsx` | Keep, selectively extract | M1: useful functionality is present but not reachable; do not mistake archived integration claims for current behavior |
| Audio listener position only | Refactor | M1: head offset plus camera-derived orientation, explicit update order |
| Audio gesture/lifecycle gaps | Refactor | M1: context resume, retry/errors, late-load cancellation, mute consistency, cleanup and remount checks |
| Duplicated audio source list / ducking disabled sources | Refactor | M1/M5: one source registry, active-source weighting, smoothed floor and attack/release |
| Long tent MP3 and eager loop decoding | Keep source, derive runtime assets later | Before affected scene ships: loops/streaming choice, decoded memory and load-time measurements; do not normalize everything again without listening |
| Ignored `_original` audio under `public/` | Relocate/exclude later | Before public packaging: preserve masters outside served/build assets; local builds can include an extra 31.91 MB despite gitignore |
| Asset provenance/loudness records absent | Add ledger | Before public demo/release; verify actual license, source, processing, peak/loop quality; old notes are not proof |
| Broken local `ffprobe` x265 linkage | Repair only when audio tooling needed | Asset-preparation task; this pass did not modify Homebrew or measure loudness/channel counts |
| Thunder looped as ambience | Rework or omit | Before release: use restrained optional events, or exclude thunder from first experience |
| Controller diagonal speed and no collision/blur handling | Refactor | M1 movement normalization, bounds and reset on blur; M4 grounding/camera/cabin collision |
| Shared module-level `playerPosition` | Replace with owned runtime state | During M1 extraction; reset on entry, separate local avatar from future remote state |
| glTF cached scene reuse and preload of all models | Refactor | Before M6: independent skinned instances/mixers; load only selected avatar in product |
| `CharacterWithActionSpots.tsx` | Keep experiment | Animation inspection remains useful; do not ship combat/action repertoire as MVP requirements |
| Procedural terrain: 320k triangles, unseeded noise, duplicate height formula | Keep experiment; simplify product terrain | M1/M2: small ground; later shared seeded height utility and world version if this generator is adopted |
| Terrain shader fog wiring, reversed smoothstep edges, color-space handling, unused rock sampling | Refactor when reused | M2 visual baseline; explicitly test fog uniforms and output transforms, remove unused runtime texture only after comparison |
| `GradientSky`, cloud layout and Leva tuning | Keep, extract tuned presets | M2: bounded cloud cost, proper sky direction from camera when needed, stable recorded presets; debug controls stay out of product UI |
| `Lights.tsx` laboratory lighting / disabled canvas shadows | Keep lab; author product lighting | M2: explicit shadow budget and restrained light palette |
| `BasicShapes`, `SpringAnimation`, remote Duck loader | Keep lab | Lazy route boundaries before public entry optimization; host release assets intentionally rather than depending on a GitHub sample URL |
| Unused Colyseus client / absent server | Evaluate then implement | M6 compatible-version spike; keep until choice is proven, remove only if deliberately choosing an alternative |
| Aliases to deleted `src/lib`, `src/hooks`, `src/components` | Remove or realign later | When module organization is implemented; do not recreate empty folders just to satisfy aliases |
| Eager route imports, no product loading/error boundaries | Refactor | M1/loading and before release: split experiments from first-entry dependencies, handle asset failures |
| Vite icon and experimental routes exposed | Retire/isolate later | Public-release polish after replacement brand asset and route policy are ready |
| Historical checked boxes and conflicting product plans | Keep reference, qualify authority | Addressed by new docs index and decision register; existing user-edited plan remains untouched |

No working code, dependency, asset or old document was deleted in this documentation pass. Removal candidates require a demonstrated replacement, reference/import check and relevant route tests. Preserve learning value without making every experiment a permanent production dependency.

## Open decisions and evidence needed

| Decision | Resolve when / evidence |
| --- | --- |
| Final terrain authoring method | M1/M2 small-world visual, collision and authoring effort comparison |
| Exact avatar scale/proportions | M1 doorway/camera blockout; keep custom model work compatible |
| Colyseus version pair and protocol | M6 two-client join/state/reconnect spike, then a dedicated dependency change |
| Room host and region | Authorized deployment design review: lifecycle, latency, restart, costs and preview isolation |
| Audio loop lengths/formats and source licensing | Asset ledger + actual headphone, decode-memory and cold-load measurements |
| Mobile support and larger rooms | Post-MVP device/capacity measurements and real viewer demand |
| Reverb/advanced propagation | After simple shelter/occlusion tests show a specific audible gap |
