# Existing references and document status

All existing Markdown documents were inventoried and reviewed for their purpose, Sheem-specific guidance and architectural implications. Course chapters are learning references containing example code, not specifications or evidence that their libraries/features are installed. Preserve the original files and links.

## Historical product plans

| File | Useful history | Current interpretation |
| --- | --- | --- |
| [sheem-project-plan.md](sheem-project-plan.md) | August third-person/humanoid direction, split listener transform, Blender/code roles, terrain tradeoffs, asset preparation and content aspirations | Preserved including pre-existing user edits. New topic docs supersede conflicting scope/visual/deployment priorities |
| [archive/SHEEM.md](archive/SHEEM.md) | Anonymous entry, spatial layering, rain-world concept, early hosting/network ideas | Slime, chat, database and Zelda-style “confirmed” decisions do not bind the new MVP |
| [archive/SHEEM_IMPLEMENTATION_PLAN.md](archive/SHEEM_IMPLEMENTATION_PLAN.md) | Experiment history, character/action spots, former integrated scene, audio normalization narrative | Checked boxes describe historical progress; current route graph and removed scaffolding differ |

## Three.js Journey notes

| File | Consult for |
| --- | --- |
| [basics.md](threejs-journey/basics.md) | Scene/transforms/cameras, geometry, textures and material foundations |
| [classic-techniques.md](threejs-journey/classic-techniques.md) | Lights, shadow costs, fog, particles, easing |
| [advanced-techniques.md](threejs-journey/advanced-techniques.md) | Model import/animation, raycasting, Blender units/export, environment maps and tone mapping |
| [shaders.md](threejs-journey/shaders.md) | GLSL, material modification, water, smoke, lighting and procedural terrain experiments |
| [extra.md](threejs-journey/extra.md) | Performance/instancing, post-processing, loading feedback, HTML overlays |
| [portal-scene.md](threejs-journey/portal-scene.md) | Authored scene, baking, import/optimization and atmospheric details |
| [r3f.md](threejs-journey/r3f.md) | Canvas/hooks, Drei, model animation, input and optional physics/store patterns |

Some Sheem annotations in these notes predate the pivot (AI study UI, Next.js/Supabase), and others recommend tutorial-specific choices such as always using OrbitControls. Do not carry them into product architecture uncritically. They do not provide a finished spatial-audio, server synchronization, avatar-rigging or third-person camera-collision system. Check version-sensitive APIs against the installed library and current primary documentation.

## Existing project learning notes

| Original file | Value |
| --- | --- |
| [01-perlin-noise-basics.md](../notes/01-perlin-noise-basics.md) | Noise, FBM, persistence, CPU geometry generation and terrain resolution |
| [02-glsl-shader.md](../notes/02-glsl-shader.md) | Shader variables/uniforms, normals, slope blending and project shader reasoning |
| [03-textures.md](../notes/03-textures.md) | Repeating texture setup, coordinate sampling, tinting and unused rock texture explanation |
| [04-scene-setup.md](../notes/04-scene-setup.md) | Gradient sky chosen over an earlier sky experiment, cloud layout, fog problems and CPU height-based camera clamp |

These four files remain under `/notes` to avoid unnecessary relocation and stale links. `/docs` now provides their central index; all new product planning belongs here. Their claims about automatic fog uniforms, coordinate spaces or external reference projects should be validated when implementing, not treated as established behavior in current source.
