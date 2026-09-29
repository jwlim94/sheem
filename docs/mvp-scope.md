# MVP scope

The MVP proves that a guest can enter a calming browser world, hear the environment change naturally as they explore, and see other people enjoying the same place. A single-player demo is an intermediate milestone, not the completed multiplayer MVP.

## Included

- One compact stylized rain environment with a cabin/shelter, short river section, and campfire gathering point.
- Enter/Play, headphone suggestion, honest loading/retry, simple keyboard/mouse help; no mandatory account or nickname.
- Third-person humanoid proxy, Idle/Walk, bounded movement/grounding and a camera that handles the cabin walls.
- Spatial source distance/panning, player-head listener position and camera-derived orientation, diffuse ambience, smooth shelter transitions and simple tagged-obstacle muffling.
- Master volume/mute; avoid sudden level jumps; usable speaker playback.
- Guest rooms with visible remote avatars, interpolation, join/leave, reconnect and a clear solo fallback.
- Minimal comfort and presence controls: pause/help, leave/rejoin, locally hide another avatar; no player blocking.
- A reproducible local build/test flow and, after separate authorization, isolated previews and a production release workflow.

Desktop Chrome is the initial development target; exercise current desktop Firefox and Safari audio/entry before public MVP release and document known limitations. Mobile/touch is deferred, with an honest unsupported-device message rather than a broken Enter promise.

## Explicitly outside MVP

Voice and text chat; social graph/friends; mandatory authentication; progression, quests, competition, purchases or economy; avatar wardrobe; persistent player database; creator tools/uploads; multiple large worlds; infinite terrain; advanced physical acoustics/convolution reverb; full mobile controls; VR/native clients; multi-region scaling. Day/night/weather transitions are an optional follow-up, not a blocker to shipping one convincing rainy scene.

## Release acceptance

| Area | Observable evidence |
| --- | --- |
| Entry | Fresh browser session reaches a controllable scene via Enter without signup; failed downloads and suspended audio can be retried |
| Movement | Normal/diagonal speed matches; no stuck keys after blur; player stays on valid ground; camera and player do not pass through cabin walls |
| Audio | Headphone walk proves approach/retreat and stereo direction; camera orbit does not change shelter membership; entering cabin muffles rain smoothly; wall and doorway differ |
| Reliability | Repeated entry/exit and delayed loads do not leave duplicate sounds, listeners, connections or avatars; master mute survives loading/reconnection |
| Presence | Two real clients share a room; 4–8 session test demonstrates gathering, join/leave, disconnection and recovery; one client's mix stays independent of others |
| Performance | Measure against the provisional [graphics budgets](graphics-art-direction.md) on recorded devices; do not claim unsupported frame rates |
| Release readiness | Lint/build pass; source/asset rights recorded; preview isolated from production; relevant browser checks pass; documented rollback is rehearsed when deployment is authorized |
| Feedback | At least one local 15–30 second recording clearly demonstrates the audio promise and one demonstrates real shared presence |

M1–M7 in the [roadmap](milestone-roadmap.md) build this experience. Production hosting remains a separate authorization gate; completing code locally does not authorize DNS changes or publishing.
