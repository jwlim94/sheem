# Sheem documentation

Planning baseline: **2026-09-28**. Proposed architecture and acceptance targets are not claims of shipped functionality. The first local title-screen implementation is tracked separately below.

| Document | Purpose |
| --- | --- |
| [First start screen](start-screen.md) | Current local meadow preview, interaction, validation and first Short |
| [Product vision and principles](product-vision.md) | Experience, priorities, guest entry, quiet presence |
| [Repository audit](repository-audit.md) | Evidence from current files, routes, assets, tooling, and history |
| [Technical architecture](technical-architecture.md) | Recommended stack, boundaries, decision register |
| [Spatial audio](spatial-audio.md) | Listener, sources, mixing, shelter, occlusion, future acoustics |
| [Multiplayer](multiplayer.md) | Guest rooms, state ownership, interpolation, connection lifecycle |
| [Graphics and art direction](graphics-art-direction.md) | Simple geometry, atmospheric rendering, asset and performance budgets |
| [MVP scope](mvp-scope.md) | Included experience, exclusions, release acceptance |
| [Milestone roadmap](milestone-roadmap.md) | Small implementation increments and local verification |
| [YouTube Shorts roadmap](content-roadmap.md) | Demonstrations, viewer questions, feedback prioritization |
| [Content visual identity draft](content/visual-identity.md) | Provisional palette, seven reusable Shorts backgrounds and readability review |
| [Deployment workflow](deployment-workflow.md) | Local → feature preview → main → sheem.ai; prerequisites only |
| [Technical debt and experiments](technical-debt.md) | Keep/refactor/retire decisions and triggers |
| [Reference guide](reference-guide.md) | Existing learning material and historical document status |

## Authority and preservation

The current user vision takes precedence over earlier plans. These topic documents are the current planning entry point. Repository source is evidence of implementation; unchecked proposals and historical checked boxes are not proof of working behavior.

[sheem-project-plan.md](sheem-project-plan.md) contains valuable Korean planning notes and **pre-existing uncommitted edits**, preserved verbatim during this pass. Its Zelda-level visual target, character-production sequencing, monetization priorities, and broader MVP are historical where they conflict with the current plan. Compatible decisions, particularly third-person presentation and the split audio listener transform, are retained explicitly in the decision register.

[archive/SHEEM.md](archive/SHEEM.md) and [archive/SHEEM_IMPLEMENTATION_PLAN.md](archive/SHEEM_IMPLEMENTATION_PLAN.md) remain historical. [Three.js Journey notes](reference-guide.md) and the four existing `/notes` files remain at their original paths to preserve links; new product documentation belongs under `/docs`. Do not treat tutorial dependencies such as Next.js, Supabase, Zustand, or Rapier as installed product requirements.
