# Graphics and art direction

Aim for roughly Roblox-level geometric simplicity and readable humanoids, with stronger lighting, weather, fog, materials, particles and spatial audio. “Roblox-like” is a complexity/readability reference, not a requirement to copy its assets or use its runtime. This replaces the older Zelda/BotW visual target.

## First environment

Build a compact rain clearing, roughly 40–60 m across, with a short path, stream edge, cabin and campfire gathering area. Start with a small portion in M1 and add the landmarks incrementally. Use large silhouettes, clear ground, a cool rainy exterior and a warm sheltered interior. The route between landmarks should create audible contrasts within a short walk and a vertical video frame.

Use simple ground and box/capsule collision proxies first. Keep the procedural terrain experiment as a reference; do not transplant its 2,000-unit, 320,000-triangle default into the first room. Seed any procedural geometry used in a shared world and version its parameters. Authored terrain can be introduced when it offers better control than the simple ground.

## Division of work

| Layer | Approach |
| --- | --- |
| Shapes | Primitive blockouts first; Blender for intentional cabin, tree, rock and avatar forms |
| Placement | Small authored world definition; instance repeated compatible props |
| Atmosphere | Runtime lighting, sky, distance fog, rain/smoke particles, restrained material variation |
| Characters | Existing humanoid proxy at a fixed scale, Idle/Walk; self-authored art later without requiring a wardrobe system |
| Materials | Begin with standard materials; introduce custom shaders only where they visibly improve the scene |

Use one principal directional light plus ambient/hemisphere fill, and a small warm local fire contribution. Explicitly configure shadows where needed; keep shadow casters and map size bounded. Match fog and sky colors. Tune tone mapping/exposure consistently; avoid assuming the terrain's custom shader already participates in standard material lighting or output transforms. Bloom is optional after a measured comparison, not the first atmosphere task.

Concentrate particles around the player and hide rain under shelter. Avoid heavy depth-of-field, motion blur, abrupt flashing or camera shake. Preserve natural sound contrast instead of turning every visible effect into another loud source.

Baked lighting can help unique static structures; repeated objects may use shared shading/AO and instancing. Baking and instancing are not fundamentally incompatible, despite an overly absolute statement in the old plan, but unique per-instance lighting needs additional data and material support. Dynamic day/night should not fight a strongly baked fixed-time appearance.

## Provisional budgets and measurement

These are planning targets, not measured capabilities or exact Roblox specifications. Establish a named integrated-GPU laptop/browser baseline in M1 and revise from measurements.

| Metric | Initial target |
| --- | --- |
| Normal play | Aim for 60 fps; maintain at least 30 fps on the recorded baseline device, including 8-player validation later |
| Scene geometry | Start below roughly 150k visible triangles, avatar roughly 2k–10k triangles |
| Draw calls | Start below roughly 150; track shadows and transparency separately |
| Resolution | Cap DPR around 1.5 initially, expose lower quality if needed |
| Initial essential transfer | Aim for ≤10 MB compressed total including first audio; defer other scenes/models/long recordings |
| Fresh entry | Aim for control within 10 seconds on a documented 20 Mbps/50 ms test profile |

Measure CPU/GPU frame time, long frames, draw calls, transfer bytes, decoded audio memory, load-to-control time and repeat-entry memory. Reduce particle coverage, shadows and unnecessary texture loads before compromising audio quality. A stable scene should also remain stable while recording a Short.

Every imported asset needs provenance and redistribution/recording rights documented before public release. Keep runtime files separate from source artwork and sound masters. Export compact glTF/GLB as appropriate; optimize only after inspecting the result and keeping originals. See [audio asset requirements](spatial-audio.md) and [technical debt](technical-debt.md).
