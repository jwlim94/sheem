# Multiplayer architecture

Status: proposed. `colyseus.js` 0.16.22 is installed but unused. There is no server or working multiplayer route. The MVP adds quiet shared presence to the same locally rendered/audio-mixed world.

## Recommended solution

Use a small Node.js/TypeScript Colyseus room service. Colyseus already supplies rooms and server-owned synchronized state. Socket.IO or raw WebSockets could carry presence messages, but Sheem would then own more snapshot, join/leave and synchronization plumbing. This is a maintainability recommendation, not a benchmark proving one library faster. [Colyseus state synchronization](https://docs.colyseus.io/state), [rooms](https://docs.colyseus.io/room)

Before implementation, choose and lock compatible client/server/schema versions. Current documentation uses a newer SDK package than this repository; a two-browser spike must resolve compatibility before production planning assumes it. [SDK reference](https://docs.colyseus.io/sdk)

## Guest and room model

Enter immediately starts the local experience and requests a guest room. Use server-issued ephemeral session identity and an allowlisted avatar/color; no signup or text entry. Assign the player to a non-full room for the requested world version. Begin with **8 players per room as a provisional capacity target**, one world, one server process and one region. A full room yields another room, not overcrowding. Database, Redis, multi-region routing and persistent accounts are deferred until an actual need exists.

Matchmaking failure should show “Exploring solo” and allow a retry while preserving the local soundscape. Never fake other human players to conceal an outage. Distinguish solo fallback from successful multiplayer in test reports.

## Shared versus local state

| Server-owned state | Local-only state |
| --- | --- |
| Room ID, protocol/world version, player session IDs, validated positions/yaw, movement/idle state, allowlisted appearance | Camera orbit, listener orientation, audio graph, volume/mute, local graphics settings, UI |
| Shared weather preset/time anchor when M8 adds them | Per-listener occlusion, zone mix, particles and continuous audio playback |
| Spawn/despawn and future bounded event IDs/timestamps | Reverb/filter calculations; optional quiet movement sounds synthesized from remote motion |

Send state/event metadata, never stream environmental audio from the room server. Everyone downloads the same versioned assets and renders their own perspective. Use separate world and protocol versions to reject incompatible joins with an understandable update message.

## Movement and rendering

For quiet presence, start with responsive local kinematic movement and server-validated position proposals. Send bounded position/yaw/motion updates at about 10 Hz; the server checks finite values, world bounds, rate, plausible displacement against server elapsed time, and simple obstacle crossings. Publish accepted state around 10–20 Hz. These are initial tuning values, not measured capacity claims.

The server is authoritative over accepted presence state, but this proposal-based approach is not full deterministic authoritative simulation. On rejection, reconcile the local player toward the accepted location. Keep collision definitions versioned; use an input-command/fixed-tick server simulation only if tests or future gameplay justify the additional work.

Interpolate remote transforms from a short snapshot buffer (start around 100–150 ms). Cap extrapolation and settle to idle when updates go stale instead of walking indefinitely. Derive remote animation from accepted motion; clone each skinned avatar's skeleton/mixer. Network receipt must not rebuild React's whole scene on every frame.

## Lifecycle and public presence controls

Cleanly handle initial state, subsequent additions/removals, normal leave, lost heartbeat, reconnect and disposal. Use a short reconnection grace period (propose 15 seconds), bounded backoff, and fresh join after expiry. Keep reconnect tokens in session memory, not logs or URLs. Remove stale avatars and prevent duplicate sessions/room subscriptions on StrictMode remounts. Announce a server restart and reconnect gracefully; persistence across restarts is not promised for MVP.

Validate all client messages, payload sizes, appearance IDs and movement rates. Restrict allowed web origins and limit guest connection/join rates. Start without freeform names, chat or voice. For public testing, provide leave/rejoin and a way to hide another avatar locally; avatars should not physically block others. Operational connection limits and disconnect controls help preserve quiet presence without building a full social platform.

## Acceptance and scale gate

M6 requires two independent browser sessions on one local room server: join, see each other, move, stop, leave, lose connection and reconnect without duplicate avatars. Each retains independent listener position and audio controls. M7 exercises 4–8 sessions, simulated latency (for example 150 ms), a brief outage, full-room routing, stale cleanup and a longer idle gathering. Record client frame times, server CPU/memory, message rate and reconnect results before raising capacity.

Deployment needs a process lifetime suitable for room ownership and reliable secure WebSockets; see [deployment workflow](deployment-workflow.md). A provider's transport support alone does not prove its room-routing or lifecycle fit.
