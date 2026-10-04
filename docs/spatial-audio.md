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

## Wind stages 3–4: extend the same test space (2026-10-02)

The existing `/playground/rabbit/walk?terrain=wind` scene now retains its flat
spawn and extends northward into a 3.2 m hill. The walkable radius is 22 m around
(0, -8). West side, hilltop, east side and an authored quiet patch are all in this
same space; **Compare locations** moves the character between them for A/B checks,
and every point is also reachable on foot. Existing meadow and slope-test routes
are unchanged. The earlier flat-only descriptions above record stages 1–2.

`terrainWind.ts` implements the existing field interface with an injected terrain
height provider. `TerrainWindConfig` extends the version-1 base configuration with
explicit zone, gust and shelter settings. All nested settings are validated and
copied when constructing a field; no renderer, audio context or character model
is required. Future map editors can edit these JSON-compatible settings. There
is no persistence/editor UI beyond the current test controls yet.

- **Zones:** circular horizontal regions with a smooth boundary band and a speed
  multiplier. Overlaps use normalized, order-independent blending rather than
  multiplying gains. The quiet patch centered at (10, 2), radius 6 m, transitions
  over 3 m to 40% of base speed. This is an authored comparison region, not a claim
  that flat ground physically blocks wind.
- **Traveling gusts:** a continuous deterministic pulse travels with the base wind
  direction. Phase depends on time minus distance along that direction divided by
  propagation speed. Default period is 14 s, propagation speed 6 m/s and peak
  boost 60%. Adjacent positions therefore experience the same swell at different
  times. Changing frame rate does not change the sampled field. This is a stylized
  repeatable gust, not stochastic turbulence or a fluid simulation.
- **Hill shelter:** query a three-ray upstream fan out to 24 m at <=1 m steps,
  compare terrain against listener height, and smoothly attenuate toward a 22%
  floor as elevated upstream terrain blocks the flow. Distance weighting recovers
  smoothly away from the ridge. Reverse wind rotates the queries, rather than
  selecting a hardcoded sheltered side. A listener above the ridge is exposed.
  No mesh walls, trees, deflected flow, vortices or pressure solver are included.
- Local speed = base speed × zone multiplier × gust multiplier × exposure.
  The audio engine then subtracts resolved character velocity as before. HRTF
  direction and ear-air timbre use this relative wind; diffuse sound and arrows
  use the local environmental field. Existing gain bounds still limit loudness.

The listener and twenty field markers share a single field instance. Marker
lengths update at 8 Hz at roughly ear height and show local environmental speed;
head audio samples after animation. Render-frame changes remain outside React
state. The sampling budget is bounded (72 height queries per position with the
default shelter range); this is a small-map baseline, not a whole-map benchmark.
The displayed **Local wind**, **Shelter** and **Gust** values describe the same
sample used by audio. **Wind layers** independently disables zones, gusts and
shelter to recover the original uniform test. **Reverse wind** supports direct
comparison. No new recording is introduced; the timbre is still procedural.

Validation: `node scripts/check-wind-terrain.mjs` checks reversed shelter, altitude,
zone and direction transition continuity, gust propagation timing and bounds,
calm, nested configuration snapshots and invalid input. It also drives the entire
comparison route walking/running at 30/60/120 fps using the real movement solver.
With gusts off at base 4 m/s, calculated west-side speed is 4 m/s and east-side
speed is approximately 1.27 m/s; reversing direction swaps the results. The crest
remains exposed. `check-wind-field.mjs` continues to cover the uniform field and
character-relative wind. Actual headphone listening and Safari/Firefox remain
untested; numerical attenuation is not proof of natural acoustic realism.

Observable acceptance: start on the original flat pad, approach the western hill
side, cross the top and descend east. Turn off traveling gusts for a repeatable
shelter comparison, then reverse wind and compare again. Turn gusts back on and
watch the marker lengths change across the course. A short video can pair that
crossing with the live local-wind readout and a stereo capture. Vegetation motion,
physical rustling emitters and richer obstacle flow remain the next stages.

Chrome browser validation: comparison buttons placed the actual animated rabbit
on both hill sides, crest and quiet patch. With gusts disabled, the readout and
Web Audio diffuse gain changed from 4.0 m/s / 0.150 on the exposed side to
1.3 m/s / 0.048 on the sheltered side. Reverse wind swapped that relationship.
The quiet patch read 1.6 m/s with gain 0.060; the crest and original flat spawn
remained at 4.0 m/s. Real movement input advanced the rabbit from the west side to
the crest (root height approximately 3.20 m). Mute reached exact zero. Rendered
terrain, location controls and overlay ordering were inspected. Lint/build and
both wind test scripts passed; the existing bundle-size advisory remains.

## Vegetation motion from the same field (2026-10-03)

The existing wind course now places five small grass patches and four trees using
the actual meadow assets. `vegetationGeometry.ts` extracts the existing nine-vertex
grass blade without changing its shape; the original meadow and test course share
that factory and `grassMaterial`. `Trees.tsx` extracts the existing seven-sided
trunk and eighteen faceted crown clusters per tree, retaining the seeded shape,
colors and default meadow placements. Test trees use smaller placement scales.
The main meadow keeps its previous animation until its wind integration is scoped.

`WindVegetation` receives the **same field instance** as the listener and markers.
Grass samples environmental wind in one-metre cells at 10 Hz, at low vegetation
height, interpolates response each frame, and supplies a per-instance bend vector
to the shared shader. Displacement happens after blade yaw/scale, so world wind
has the same direction across differently oriented blades. Quadratic height
weighting fixes roots and bends tips; flutter amplitude vanishes with wind. There
are 4,500 blade instances, not thousands of React components or per-blade terrain
queries. No React state is updated per frame.

Trees sample the field near canopy height and apply smoothed, bounded rotation
around each tree's own ground root to both trunk and crowns. Crown flutter is
small and wind-dependent. The entire grove is no longer rotated around the world
origin in the field-driven mode. Tall crowns can remain exposed while low grass
is sheltered: both query the same terrain field at their respective heights.
Character velocity only affects ear airflow, never plant motion. Reduced-motion
preference removes dynamic bend/flutter while leaving audio and field data active.

This step adds movement only, not new rustling audio, tree collision, or tree-caused
wind obstruction. Geometry/material cleanup follows the existing scene ownership;
grass bounds include displacement and the four animated test trees are not culled
against stale instance bounds. Actual full-map performance remains a later task.

Chrome validation: no shader compile failures; grass X bend was positive for eastward
wind and negative after reversal. At 4 m/s without gusts, mean bend was about
0.111 m on the exposed western patch and 0.053 m on the eastern patch; reversal
swapped their relative strength. Tree instance transforms changed with direction.
Calm settled grass below 0.000001 m; reduced-motion made bend exactly zero and
restored tree rest transforms. A rendered overview was inspected. Existing wind
field/terrain checks and lint/build pass, with the existing bundle-size advisory.
For acceptance, use Reverse wind, compare west/east plants, enable traveling gusts,
and set speed to zero. This can be shown in a Short without changing test spaces.

### Grass contact response — 2026-10-03

The existing wind test course now combines local wind with character contact on
its same 4,500 meadow blades. `grassContact.ts` accepts world-space upright body
volumes and resolved velocities independently of React, audio, or rabbit assets.
The current character adapter uses one lower-body volume (0.34 m radius, 0.85 m
height), not per-limb mesh collision. Nearby blades push away from the contact
center with a travel-direction bias; penetration and speed increase displacement.
A fast attack and slower exponential recovery preserve stationary contact and
release smoothly after departure. Wind-bent positions participate in proximity
checks. Multiple contact bodies are supported by the solver; networking is not
connected. A per-blade contact intensity is available for future rustling work.

The shader sums wind and contact displacement, bounds bending relative to blade
height, and lowers tips as they bend. Root vertices receive zero displacement.
Reduced-motion suppresses ambient sway but retains direct contact feedback.
Only the wind test course is connected in this step; full-meadow integration,
swept/individual-foot contact, and contact audio are not implemented. No sound
assets or audio graph were changed.

Acceptance: open Try the wind, set Wind speed to zero, walk through the grass
near Flat start, stop inside it, then leave; repeat with Shift and restore wind.
Blades should part locally, remain displaced while occupied, and recover after
leaving. A Short can show calm grass parting around the rabbit and recovering.
`node scripts/check-grass-contact.mjs` covers locality, direction, speed/depth,
vertical separation, stationary contact, 30/60/120 Hz recovery, multiple bodies,
and wind-shifted contact. Chrome keyboard testing recorded 139 displaced blades
at the sampled passage frame, then less than 0.00005 m residual displacement
three seconds after reset; instance root transforms stayed unchanged and no
runtime/shader errors appeared. Lint and build pass (existing bundle-size warning).

### Movement airflow level tuning — 2026-10-03

`windAudioLevel.ts` now tunes the audible strength independently of physical
relative wind. The part of apparent speed above local ambient speed receives
3–20% gain through a smooth movement-speed curve (1.6–3 m/s). In calm air this
puts 1.8 m/s walking at about 4% of its former directional gain and 3 m/s running
at 20%. Ambient contribution and stationary wind levels are unchanged; tailwind
can still reduce apparent flow and headwind still increases it. The same tuned
strength controls filter brightness. Direction, physical readouts, vegetation,
and the diffuse ambient bed retain their existing inputs. Existing AudioParam
smoothing remains in place; this is perceptual tuning, not a fluid simulation.

Field checks cover calm walk/run levels, stationary ambient invariance,
headwind/tailwind and continuous speed transitions. Lint/build pass. Headphone
listening remains a user acceptance check; no claim of measured perceived loudness.

### Contact rustling in the wind course — 2026-10-03

Grass contacts now feed a bounded positional rustle layer in the wind experience's
existing AudioContext, master bus and head/ear listener. The UI button is now
Enable sound / Mute sound because it controls wind and contact audio together.
Set wind speed to zero to isolate rustling. Camera orbit does not drive the listener.

`WindVegetation` gathers the strongest current contact in each of four world-space
quadrants around the local character. Depth and resolved horizontal speed drive
strength; travel below 0.08 m/s, no contact, and post-contact visual recovery do not
trigger sounds. Current aggregation supports the local character only, although
the visual solver accepts multiple bodies. The emitter remains at the contacted
blade's mid-height. HRTF panning and inverse distance attenuation are applied in
world coordinates. Individual blades do not create individual sources.

`grassRustle.ts` generates five short mono test textures (0.22–0.36 s) from seeded
noise, filtered noise and smooth grain envelopes. These are original procedural
placeholders, not sourced field recordings or certified natural grass Foley.
No downloaded assets or third-party licenses were added. Buffer creation is
separate from contact aggregation and can be replaced with decoded recordings.
Playback varies sample and rate, avoids immediate sample repetition, limits
starts to at most about 12 per second and overlapping voices to six. Ended voices
release their nodes; mute/hidden-tab stops current voices, suspended contexts do
not queue events, and experience disposal releases the layer with the context.
Wind-driven vegetation rustling is still not implemented.

Validation: `node scripts/check-grass-rustle.mjs` checks depth/speed response,
spatial node positions, rate/polyphony limits, variation, silence, suspension,
cleanup and finite bounded sample data with quiet endpoints. Chrome keyboard
walk-through at zero wind produced zero events before contact, eight during the
sampled passage and no new events after stopping; muted movement produced none.
Source positions followed contacted blades and no runtime errors appeared.
Wind field regression checks and lint/build pass (existing chunk-size advisory).
Headphone sound quality and left/right perception remain manual acceptance work.

Acceptance: enable sound, set wind speed to zero, walk into a patch, stop inside,
then run out. Compare grazing its edge to deeper contact, approach from either
side and orbit the camera while the rabbit is still. Verify soft sample tails end
without new rustles at rest, and mute suppresses both airflow and contact sounds.
A Short can pair the visible grass parting with the localized contact sounds.

### Recorded foliage replacement — 2026-10-03

The synthetic contact textures above were rejected in listening feedback and
have been removed. Contact now uses six 0.65-second mono WAV excerpts of kyles'
CC0 recording, “foliage leaves rustle brush movement.flac” (Freesound 637547).
The downloaded source is the public high-quality MP3 preview, not the original
login-only FLAC. Source/processing/license details are in
`public/sounds/foliage/CREDITS.md`; the unedited MP3 and exact segment metadata
are preserved in `art/audio/foliage/`. The runtime excerpts total about 375 KB.
Selection was based on RMS/transient measurements; headphone quality remains a
user acceptance test. No synthetic noise is mixed into these contact sounds.

Natural texture is preserved with only ±3% playback-rate variation. Starts are
spaced 0.26–0.36 seconds apart, capped at three simultaneous voices, at lower
per-contact gain. WAVs load/decode on audio activation. Activation waits for the
assets and context; failures expose the existing retry message and dispose the
failed context, so another click starts a fresh load. Disposing aborts requests
and ignores late decodes. Muting during loading cannot re-enable the output.

Tests cover the real WAV sample endpoints/headroom, fetch failure and disposal
during decode in addition to the existing contact and lifecycle checks. Chrome
loaded the new samples, emitted three contact events on the tested pass, emitted
none while stationary or muted, and logged no runtime errors. Lint/build pass.

### Contact/wind balance — 2026-10-04

Raised recorded contact gain by a factor of two (approximately +6 dB) following
listening feedback that foliage was masked by wind. Sample processing, contact
strength response, spatial attenuation, three-voice limit and wind levels are
unchanged. Per-voice gain now ranges from 0.16 to 0.8 before distance and the 0.22
master. This is a first mix adjustment; perceived balance still needs listening
with wind enabled, especially at different wind speeds.

Further listening feedback: contact was still masked. Raised contact another
6 dB (now ×4 versus the original recording mix) and routed both wind layers
through a 0.63-gain bus (about −4 dB). This changes the contact/wind ratio by about
10 dB relative to the previous adjustment while preserving spatial controls and
source texture. Wind bus is owned/disconnected with the experience. At the
largest excerpt peak (~0.577), three fully coincident maximum-gain contact
voices have a pre-HRTF master-scaled peak bound of ~0.61; this is headroom evidence,
not a guarantee of the final wind-plus-HRTF mix or a listening certification.

Further mix adjustment: reduced only the directional relative-airflow coefficient
from 2 to 1.26 (another ~4 dB). Diffuse wind bed, foliage gain, filters and direction
response remain unchanged. This targets the wind hitting the listener directly,
which remained too prominent in user listening feedback.
