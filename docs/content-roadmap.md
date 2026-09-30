# YouTube Shorts and product feedback

Each meaningful milestone asks: **“Can this become a compelling YouTube Short?”** Show one real improvement in 15–30 seconds. Record after local acceptance; publication remains a deliberate human action. Local demos can support public development before a hosted product is ready.

## Milestone-aligned clips

Current character increment (2026-09-29): the user chose a rabbit for the next
development video. The [first model and local preview](rabbit-character.md) are a
visual step toward M1. V9 adds a verified in-place walk with Idle/Walk controls.
A Short can show the first walk animation now, labeled as an animation study;
the local `/playground/rabbit/walk` study now connects keyboard movement and
terrain following in a bounded clearing. Record a short walking/orbiting demo
after reviewing its feel; this is not the full listening or multiplayer MVP.

| Milestone | Hook and 15–30 second sequence | Viewer question / useful feedback |
| --- | --- | --- |
| M1: playable clearing | “A world you explore by listening.” 0–3s Enter; 3–18s approach source/turn view; 18–25s pause | “Could you tell where the sound was coming from?” Capture headphones/speakers and entry confusion |
| M2: rain | “Would you stay here in the rain?” Brief dry/blockout comparison, then walk slowly through the finished rain | “Gentle drizzle or heavier rain?” Capture visual clutter, harshness and atmosphere preference |
| M3: river | “Listen as I pass this river.” Approach, look across it, turn and retreat; keep the stereo mix intact | “Does the river sound where you expect it?” Capture distance/panning problems |
| M4: cabin | “Step inside. Hear the difference.” Outside rain, doorway crossing, quiet indoor pause, step back out | “Where should the next rain shelter be?” Capture whether muffling was obvious and believable |
| M5: campfire | “Find the warmest spot by sound.” Approach, walk around fire, settle; minimal overlays | “Fire crackle, rain, or a softer mix?” Capture balance and loop fatigue |
| M6: second player | “Someone else just arrived.” One guest waits, a second real session approaches and stops | “Does sharing this place make it more relaxing?” Capture understanding of real multiplayer |
| M7: gathering | “No quest. Just a place to rest.” Several real guests gather around fire with clear ambient audio | “Would you bring someone here?” Capture desire to revisit/share and disruptive presence issues |
| M8: environment change | “The same place after sunset.” Transition light/weather with matching audio, hold final mood | “Sunrise, dusk, or a storm?” Capture preferred mood and abrupt transitions |
| M9: viewer request | With permission/appropriate attribution, show the selected request briefly, then its implemented environment | “What one sound should this place have next?” Capture new environmental demand |

M0 maintenance supports M1; do not manufacture a misleading feature clip for dependency repair. If simulated clients are ever used for a capacity demo, label them as simulated. The M6/M7 product demos should use genuine independent sessions.

## Recording checklist

- Choose one observable before/after or spatial action and rehearse a short path. Use a small vertical composition with landmarks and avatar readable.
- Capture application audio directly in stereo. Verify channel routing on headphones and check a mono/speaker playback; do not cover the differentiating sound with music or narration.
- Keep recording levels consistent across comparisons; check clipping and loop seams. Do not manufacture the effect through post-production audio substitution.
- Put a brief “headphones recommended” caption near the start, preserve a few uninterrupted listening seconds, and end with one specific question.
- Record commit/build, browser/device, mix settings, test result and clip filename. Review the encoded clip before the human publishes it.
- Keep raw recordings outside the Git source tree; record their location/link in the milestone note. Confirm release rights for audio and visible assets before publishing.

## Feedback capture and prioritization

Maintain a lightweight record under `/docs/feedback/` when the first feedback arrives; do not create an empty database or analytics service now. Suggested row fields: date, milestone/build, clip URL, viewer quote or observed issue, headphones/device if volunteered, category, repeated reports, proposed action, priority, outcome. Avoid collecting unnecessary personal information.

Review after each clip has had time to receive responses (initial cadence: weekly). Separate usability defects, audio/comfort issues, performance/compatibility, and environment requests. Fix blocked entry, wrong localization and disruptive audio first. Next, weigh repeated demand, fit with quiet presence, learning value, implementation effort and demonstrability. Views/likes help compare hooks but are not proof that the app works or that a feature is wanted.

Choose one next experiment, state the question it should answer, update the milestone scope and repeat:

**build → local test → record 15–30 seconds → publish → ask → collect real feedback → prioritize → build again.**

An example prioritization decision: repeated “the cabin still sounds outdoors” reports outrank a new map request; fix the existing audible promise and show the corrected doorway transition before expanding the world.
