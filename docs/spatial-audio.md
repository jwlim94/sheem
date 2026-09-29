# Spatial audio architecture

Status: proposed evolution of `src/playground/SpatialAudio.tsx`; not implemented. Audio is the core product system. Preserve the existing Three.js/Web Audio work, then make ownership, mixing and environmental behavior explicit.

## Listener and coordinate contract

Use one AudioContext and one listener per active experience. Place the listener at the local avatar's head in world coordinates; copy the camera's world orientation independently. Never inherit camera translation through a parent transform. Update after movement/camera resolution. Camera orbit should move an emitter left/right in the headphones without changing distance or shelter membership; turning only the avatar should not reverse the stereo image.

Three.js exposes its underlying listener context and positional panner, so a thin project layer can retain its transforms while adding Web Audio processing. [AudioListener](https://threejs.org/docs/pages/AudioListener.html), [PositionalAudio](https://threejs.org/docs/pages/PositionalAudio.html)

## Source classes and proposed signal flow

| Source | Spatial treatment | Example |
| --- | --- | --- |
| Diffuse bed | Non-positional stereo, weighted by environment | Broad rain/forest ambience |
| Local emitter | Mono asset where practical → HRTF panning and distance curve | Campfire, roof drip |
| Extended emitter | Small set of crossfaded emitters or closest point on a fixed path | Riverbank; avoid a single point pretending to be an entire river |
| Event | Scheduled once, with bounded level and optional position | Distant thunder; not a repeating thunder loop |

Conceptual graph for an emitter: decoded source → source gain → occlusion low-pass → positional panner → dry bus → master gain → output. A separate send from the processed emitter can feed the selected zone's reverb bus later; wet and dry paths must not duplicate the direct signal accidentally. Beds use a separate ambient bus with zone gain/filter and gentle ducking before master. Native nodes and Three.js connections need one owner to avoid connecting the same source to the output twice.

Use HRTF for headphone localization and test speakers/mono for intelligibility. A panner models position/direction and distance behavior; scene walls, shelter and reverb require project logic. [PannerNode](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode)

## Entry, loading, and lifecycle

The Enter handler should create/resume the shared AudioContext directly from the user gesture. Keep a visible retry/unmute state if audio remains suspended. Do not defer the initial resume solely to a React effect after asset loading. Provide master mute/volume and start conservatively. MDN recommends gesture-driven audio activation and deliberate AudioParam updates. [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

Load only the first scene's required loops. Cache decoded buffers by asset ID; sources can share a buffer but need their own playback nodes. Longer recordings may need trimmed loops or streaming rather than decoding every file. Estimate decoded memory as duration × sample rate × channels × 4 bytes, independently of MP3 size. Channel count/duration remain unverified for existing files.

Own stop/disconnect and listener removal; guard every pending load callback with a disposed/generation flag. Handle load/decode errors, retry, duplicate Enter clicks, route changes, StrictMode remounts, suspended contexts and hidden-tab return. Recommended default: fade/pause on hidden tab, restore the prior user setting on return, and offer an explicit background-listening option later. Never unexpectedly unmute.

## Distance, layering and transitions

Start with the existing linear distance curve to make tests predictable. Tune ref distance, maximum distance and gain per source in meters; validate `maxDistance > refDistance`. Consider inverse falloff only after listening comparisons; maximum distance does not have identical semantics across curves. [Three.js distance controls](https://threejs.org/docs/pages/PositionalAudio.html)

Use authored zone volumes with normalized weights and transition bands. Start with roughly 0.5–1.5 m boundary bands and 200–500 ms smoothed gain/filter changes, then tune by walking at normal speed. Define priority for overlapping shelter volumes and hysteresis to prevent boundary chatter. Equal-power fades suit uncorrelated recordings; phase-correlated copies require different mixing to avoid level bumps or comb filtering.

Derive ducking from active audible sources in the same registry as rendering, not a duplicated array. Keep a quiet bed floor and smooth attack/release; walking past a fire must not abruptly mute the whole world. Calibrate source levels and leave mix headroom. Historical −16 LUFS normalization is an unverified asset-preparation claim, not a universal ASMR loudness target or a substitute for listening.

## Environmental acoustics, in stages

1. **M1–M3: location and orientation.** Correct listener, stable loops and distance/panning; then a river with predictable spatial coverage.
2. **M4: shelter.** A cabin's authored volume reduces and low-passes outdoor rain while adding a restrained roof/interior layer. Rain particles stop under the roof. Indoor state follows the avatar, even if the third-person camera is outside. Crossfade at the doorway. This is an authored acoustic approximation, not physical wave simulation.
3. **M4: simple obstruction.** Raycast head-to-emitter against tagged acoustic proxies at about 5–10 Hz for nearby emitters; apply smoothed gain reduction and low-pass filtering. Ignore decorative foliage unless deliberately tagged. Open doorway and solid wall paths must differ. Use source/zone relationships for diffuse rain; one ray cannot represent a whole environment.
4. **After MVP: acoustic zones/reverb.** Trial a small shared convolver/send bus per active room type, with wet/dry crossfades and limited impulse-response memory. Multi-ray obstruction, portals, transmission materials and richer propagation remain experiments until they improve a measured listening problem.

## Assets and acceptance

Create an asset ledger during implementation: source URL, creator, exact license/attribution, original and runtime paths, duration/channels/sample rate, processing steps, loop points, loudness/peak measurements, intended source class. Preserve originals outside the eventual deployable asset tree. Existing recordings are candidates, not certified release assets; river/fire assets are absent.

Test on headphones in current Chrome, Firefox and Safari: explicit start on a fresh load; left/right and 180° camera turn; approach/retreat; orbit without proximity change; doorway crossings in both directions; listener inside/camera outside; solid-wall versus doorway obstruction; mute while loading; failed download; leave/re-enter repeatedly; two clients hearing their own positions. Check loops for clicks, mix for clipping, and transitions for pumping. Record browser/device and actual results. Use a 15–30 second stereo recording to demonstrate each audible change; do not claim binaural fidelity based only on the presence of HRTF.
