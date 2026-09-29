# Recommended technical architecture

Status: planning recommendation, 2026-09-28. Keep the existing TypeScript + React + Vite + R3F/Three.js foundation. It already matches the product and contains useful experiments; no framework replacement is justified by this audit.

## Stack and tradeoffs

| Area | Recommendation | Reason and alternative |
| --- | --- | --- |
| Browser application | Existing React 19, strict TypeScript, Vite, React Router, Tailwind | Already configured; no current need for Next.js/SSR or a game-engine rewrite |
| 3D | Existing R3F + Three.js, targeted Drei helpers | Compose scenes in React; perform transforms in the frame loop; keep vanilla comparison as learning material |
| Audio | Thin project audio layer using Three.js Audio/PositionalAudio and native Web Audio nodes | Existing code already uses these; gain/filter/zone routing needs direct control. No additional general-purpose audio package is required yet |
| Multiplayer | Node.js/TypeScript + Colyseus rooms, separate persistent service | Existing client is a useful starting point, and room/state lifecycle fits quiet presence. Verify a compatible SDK/server pair before implementation |
| State | React for UI; owned mutable runtime objects/refs for frame state; room state for remote presence | Avoid rendering React 60 times per second. Add a store only if concrete subscription needs justify it |
| World | Small authored layout, versioned static world definition, simple collision proxies | More controllable than an infinite world. Retain seeded CPU terrain generation as an option |
| Persistence | No application database or required auth for MVP | Guest rooms are ephemeral; local volume preferences can use browser storage |
| Hosting | Static frontend/CDN plus persistent room service | Separate asset delivery from room lifecycle; see [deployment plan](deployment-workflow.md) |

The multiplayer recommendation follows Colyseus's server-owned schema synchronization and room lifecycle, rather than merely retaining an unused dependency. [State synchronization](https://docs.colyseus.io/state), [room lifecycle](https://docs.colyseus.io/room)

## Boundaries to introduce incrementally

Keep `/` as the product route. Use `src/sheem/` as its composition root. As real features are extracted, introduce focused `player/`, `world/`, `audio/`, `network/`, and `ui/` modules there. Preserve `src/playground/` as reproducible experiments. Do not build every product feature in the playground and later attempt a wholesale migration.

The UI owns Enter, loading/errors, mute/volume, help, and connection status. Player code owns input, local motion, grounding and camera collision. World data owns spawn, walkable bounds, obstacles, source positions, acoustic volumes, and visual/environment presets. Audio owns one context/listener, asset cache, graph, transitions and cleanup. Networking exchanges world/presence data and never transports the continuous ASMR mix.

Use one coordinate convention: +Y up, one scene unit = one meter. Define avatar height before laying out doors and shelter volumes; 1.7 m is a provisional scale, not a required realistic proportion. Use stable source/zone IDs and a `worldVersion` shared by client and server. A source definition should include asset ID, position, gain, distance curve, loop policy and zone membership; avoid separate hardcoded position lists for rendering and ducking.

Render sequence: apply input/local movement → resolve collision and camera → update player-head listener position and camera-derived orientation → render/interpolate. Sample network updates and occlusion on bounded lower-frequency schedules. Keep server state and per-client audio preferences independent.

When multiplayer starts, add a real `server/` package and a small shared protocol/world-data module if needed. Define their build/test scripts then; none exist now. Avoid importing Three.js or browser objects into the server contract.

## Decision register

| ID | Status | Decision and rationale |
| --- | --- | --- |
| D01 | Retain | Browser SPA, TypeScript, React, R3F/Three.js, npm; no stack reset |
| D02 | Current product requirement | Roblox-like simplicity plus atmosphere replaces the prior Zelda-level target |
| D03 | Retain as implementation direction | Third-person humanoid avatar supports visible shared presence; the first-person root is a prototype, not a contrary product decision |
| D04 | Retain | Listener position follows avatar head; orientation follows camera view. Orbit changes panning, not proximity or indoor state |
| D05 | Recommend | Colyseus rather than custom raw WebSockets/Socket.IO synchronization; prove with two clients before committing to hosted operation |
| D06 | Current product requirement | No mandatory signup; quiet presence; no voice/chat, economy, progression, or wardrobe in MVP |
| D07 | Recommend | Compact authored clearing with simple ground/colliders; final Blender-versus-procedural terrain remains open after M1/M2 |
| D08 | Reconcile earlier plan | Keep eventual self-authored Blender art, but use existing licensed proxies and establish scale first; custom rig/wardrobe is not the critical path |
| D09 | Current boundary | Deployment architecture only until explicitly authorized; sheem.ai ownership does not imply provider setup exists |
| D10 | Recommend | Desktop first, 8-player room cap as a test target; mobile and larger rooms require measurements |

Version decisions are separate from these architecture choices. The repo locks `colyseus.js` 0.16.22, while current examples use `@colyseus/sdk`; do not copy current examples into the old client blindly. At M6, test a matched client/server release and record any migration in a dedicated change. [Current SDK reference](https://docs.colyseus.io/sdk)

## Validation strategy

Restore a reproducible dependency installation before feature work; then use existing lint/build checks. Add small behavioral tests as pure movement, distance/zone weighting, message validation, and reconnect logic emerge. Use real browser checks for gesture-based audio start, camera/listener alignment, shelter transitions, and multiple clients. Performance and listening acceptance cannot be inferred from unit tests. Do not add empty test infrastructure during this documentation pass.
