# Spatial audio architecture

Status: wind stages 1–2 are implemented in a dedicated flat test scene (2026-10-02). The remaining environmental architecture is planned. Existing title ambience and playground experiments remain separate.

## Listener and coordinate contract

Use one AudioContext and one listener per active experience. For the wind experience, place the listener between the avatar's ear roots and follow the head's orientation in world coordinates. Camera orbit must not change listening direction or proximity. This supersedes the earlier split head-position/camera-orientation plan at the user's request on 2026-10-02. Other legacy audio experiments have not been migrated.

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


## Reusable wind stages 1–2 (2026-10-02)

Open `/playground/rabbit/walk?terrain=wind`, or choose **Try the wind** from the
walking screen. This is a bounded flat test pad; it does not expand the meadow or
restore the removed river route. Enable wind explicitly, vary direction/speed,
turn the rabbit in place, orbit the camera, and compare calm with stronger wind.

### Shared contract and future editor

`wind/windField.ts` has no React, Three.js, browser or rabbit dependency. A
version-1 JSON-compatible `WindConfig` describes direction of travel **toward**
in degrees clockwise from +Z and speed in m/s (0–12 for this prototype). +Y is up,
+X east, -Z north. Validate settings at the boundary; the uniform field captures
an immutable normalized copy. `sample(position, seconds, out)` fills a caller-owned
velocity and speed without allocating. Position and time are intentionally unused
by the current uniform implementation; later map zones, gusts and shelter can
implement the same query. No speculative empty zone/terrain systems are created.

A future map editor should edit and persist versioned map settings, using the same
validation and field query. The current sliders edit the actual configuration;
they are a test UI, not a map authoring/persistence tool. Reload resets defaults.
The field arrow and audio consume the same configuration/sample contract. Existing
meadow grass is not coupled yet; the flat pad avoids suggesting that it is.

### Head adapter and audio

`RabbitWindProbe` adapts the animated rabbit rig: average Ear.L/Ear.R origins,
use Head world orientation corrected by its rest basis, and update after the
model animation. Individual ear flapping does not rotate listening direction.
The audio engine receives only a wind sample, world position and orientation;
future characters supply their own head adapter. Animated head motion is smoothed
in Web Audio over 100 ms. Camera transforms are never passed to this engine.

`createWindAudio.ts` owns one context, a diffuse stereo layer, an independent mono
local-air layer, filters, gains and an HRTF panner. A virtual point 3 m upstream
provides directional cues without distance attenuation; it approximates local air,
not a physical distant wind source. Front/back exposure also changes gain and
low-pass cutoff gently. This is an artistic model, not a rabbit-ear acoustic
simulation. Trees/grass will later have separate sound emitters at their locations.

Both layers use deterministic generated noise (seeds 112 and 4817), twelve-second
buffers with a one-second equal-power seam and loopStart=1. No third-party sound
recording is introduced. The diffuse bed stays present at nonzero wind speeds;
calm with a stationary listener fades both layers to zero. The level and timbre are provisional and require
headphone listening; this is not a finished natural-wind sound library.

`useWindAudio` starts only from a gesture, retains mute during resume, displays
resume errors for retry, fades to exact zero on mute/hidden tab, and stops and
closes owned resources on leaving the test mode, including same-route query
changes. Title ambience is not started alongside this standalone test.

### Acceptance and next steps

Pure checks: `node --experimental-strip-types scripts/check-wind-field.mjs` covers
JSON round trips, cardinal travel/arrival conventions, uniformity across positions
and times, immutable settings, calm and rejected invalid values. Browser validation
is recorded with this implementation; do not infer perceptual realism from HRTF
or analyser values. Actual headphone listening, Safari/Firefox and mobile remain
separate acceptance checks.

For a Short: show the arrow, turn the rabbit through four directions while the
camera stays fixed, then orbit only the camera and show that listening stays with
the rabbit. Next implement spatial variation and gusts, then wind-relative shelter
behind terrain, followed by vegetation movement and rustling from the same field.

Chrome (local Metal headless rendering) validation: four left turns produced
left → ahead → right → behind → left arrivals with the expected gain/stereo
changes. A 180° camera orbit preserved the arrival side; the listener retained
only the rabbit's small idle head motion. Wind speed 0 produced zero analyser
output; 12 m/s increased output. Mute and simulated hidden-tab events produced
zero output, and visibility restored the prior enabled state. Same-route exit
closed the context; re-entry stayed silent until enabled and created one new
context. An injected resume rejection showed the retry message and recovered
without adding another context. Rendered desktop controls and the arrow were
visually inspected. Lint/build and the pure wind checks passed (existing bundle
size warning remains). These are graph/UI checks, not headphone listening.


### Listener movement and apparent wind (2026-10-02)

The character-independent `relativeWind(ambient, listenerVelocity, out)` computes
world-space air velocity minus resolved listener travel velocity (m/s). It does
not modify the shared map sample. The local air layer uses this apparent velocity
for upstream direction, exposure, level and timbre; the diffuse bed and map arrow
continue to use ambient wind. Future vegetation emitters should likewise use the
map field, not the listener-relative sample.

The rabbit adapter measures root displacement immediately around the constrained
movement step using its same clamped delta. Actual braking and boundary sliding
therefore count; blocked movement does not sound like running. Reset/teleport
happens before measurement, and animated head bob/ear motion is excluded from
travel velocity. Other movement controllers can pass their own resolved world
velocity through the same audio API. Vertical travel is supported by the common
vector calculation, though this lab currently has flat ground.

Existing 100 ms audio smoothing eases changes; the strength mapping remains capped
at 1 even when headwind plus running exceeds 12 m/s. With 4 m/s wind, moving 3 m/s
against it gives 7 m/s apparent wind; moving with it gives 1 m/s. At 0 m/s ambient,
walking/running creates forward-arriving local air while the diffuse bed remains
silent. Turning in place changes exposure but adds no translational airflow.
The readout distinguishes **Felt** and **Moving** speeds from the ambient slider.

Pure tests cover headwind/tailwind, matching wind speed, outrunning and reversing
arrival, crosswind, calm walking/running, vertical travel and the level cap.

Chrome input validation with ambient wind set to zero: standing had zero output,
W walking reported 1.8 m/s apparent wind and Shift-running 3.0 m/s, both from
ahead. The local-air gain increased from about 0.30 to 0.50 while diffuse gain
stayed zero. Holding movement into the test boundary reduced apparent speed to
near zero; stopping and Back to start returned the gain/output to zero without a
teleport spike. Lint/build and pure wind tests passed. No new headphone listening
assessment was performed.
