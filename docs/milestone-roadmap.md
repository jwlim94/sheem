# Milestone roadmap

Status: proposed sequence, not a completion checklist. Each milestone ends with local verification and a potential 15–30 second demo. Use the same IDs in the [content roadmap](content-roadmap.md). Scope is deliberately smaller than historical phases; calendar estimates wait until the build and first scene are verified.

| ID | Deliverable and dependency | Local acceptance | Demonstrable moment |
| --- | --- | --- | --- |
| M0 | Restore reproducible local toolchain; audit is its starting evidence | Resolve missing Rollup optional dependency without casually regenerating the lockfile; lint/build pass; smoke-test all five existing routes; record browser/audio baseline | Supporting work for M1; an honest before/after can show the prototype becoming accessible |
| M1 | First playable listening clearing; depends on M0 | Enter starts audio; third-person proxy walks within a simple bounded scene; one rain bed + one nearby roof/rain source; correct listener orientation, master mute, loading/retry and repeat-entry cleanup | Enter, walk toward a small shelter/emitter, turn the view and hear the source move |
| M2 | Walking through rain; depends on M1 | Bounded rain particles, coordinated fog/sky/light palette, no major frame-time regression; same loop without clicks; reachable quality/volume controls | Gray blockout becomes a rainy place worth pausing in |
| M3 | Positional river; depends on M1, normally after M2 | Source a documented river loop; walking along/across bank yields stable coverage, changing direction and distance without emitters suddenly popping | Approach the river, turn sideways, walk away |
| M4 | Cabin acoustic contrast; depends on M1/M2 | Add cabin/camera collision, shelter volume, smooth outdoor low-pass/gain and interior layer; tagged wall occlusion differs from open doorway; player-inside/camera-outside test passes; rain stays outside | Step through the doorway and hear rain become muffled |
| M5 | Spatial campfire; depends on M1, normally after M4 | Document fire asset; warm simple light/particles, stable falloff/panning and restrained bed ducking; moving around it has no clipping or abrupt fades | Circle the fire, sit or stand quietly nearby; sitting animation is optional |
| M6 | Another person appears; depends on M1 and the multiplayer version spike | Two browser sessions share a local Colyseus room; motion/idle interpolates; join/leave and independent local audio work; reject invalid updates | Second real client walks into the same frame |
| M7 | Quiet gathering and MVP hardening; depends on M2–M6 | 4–8 session gathering, dropout/reconnect/stale cleanup, full-room handling, hide-avatar control; cold entry, asset, performance and browser checks from MVP scope pass | Several people stop around the fire without chat or competition |
| M8 | Optional day/night or weather change; after M7 or pulled forward only by evidence | Shared time/preset metadata yields consistent environment; local sound/lighting transitions are smooth; late join sees current state | Rain eases or daylight becomes a warm evening |
| M9 | Viewer-requested environment; after feedback review | Select one evidenced request and reuse player/audio/network foundations; test the new place against the same budgets and source rights process | A real viewer suggestion becomes a new listening place |

M3–M6 can be reordered after M2 according to feedback and dependencies, but the full MVP still needs positional sound, shelter, fire and shared presence. Prefer moving a small presence proof earlier over spending weeks polishing terrain. Rich reverb, custom avatar production and multiple worlds do not block M7.

## First implementation milestone in detail

**Recommend M1: an Enter-to-listen vertical slice**, preceded only by M0's toolchain repair and baseline smoke tests. Reuse the controller/animation and audio patterns while preserving their playground originals. Assemble a small clearing with simple geometry and a visible roof/rain emitter. The first version can use flat ground and a fixed follow-camera distance; provide controlled view rotation so listener orientation can be demonstrated.

The scope includes guest entry UI, one proxy avatar, normalized movement and bounds, source proximity/panning, explicit audio resume, master mute, and reliable cleanup. It excludes multiplayer server work, river/fire asset sourcing, an enclosed cabin, advanced occlusion and custom character authoring. Those have their own milestones.

Done means a fresh user can Enter, walk, rotate the view, hear a clear spatial change, mute and retry; repeated entry does not multiply playback. Record actual device/browser and a 20-second walkthrough. A scene that only looks finished but has silent or inconsistent audio does not meet M1.

## Completion record for each milestone

Record commit, scope, actual tests/results, unresolved issues, performance observations, recording path, proposed Short hook, one viewer question and follow-up decision. A video is evidence of a specific behavior, not a replacement for checks. If a feature cannot be explained or heard in a short demo, consider splitting it or identifying which later demo it enables.

## Deployment track

Keep normal local development through these milestones. After separate infrastructure authorization, introduce feature previews once M1 is stable and stage the room service for M6. Production release follows M7 acceptance and a reviewed deployment setup. No milestone number automatically authorizes publication, DNS edits, provider provisioning or a push to production.
