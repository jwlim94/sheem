# Working on Sheem

Sheem is a browser-first social 3D ASMR world. Prioritize effortless guest entry, convincing spatial audio, simple stylized graphics, and quiet shared presence.

- Start with [docs/README.md](docs/README.md). Read the [repository audit](docs/repository-audit.md) before assuming a prototype is connected or a historical checklist is complete.
- Follow the [product vision](docs/product-vision.md), [MVP scope](docs/mvp-scope.md), and [architecture decisions](docs/technical-architecture.md). Historical plans and learning notes are references, not current requirements.
- Preserve working experiments and user edits. Extract useful behavior incrementally; do not replace the stack, remove experiments, or scaffold empty systems without a concrete task need.
- Keep TypeScript, React, Vite, R3F/Three.js, and the existing npm lockfile. Consult [spatial audio](docs/spatial-audio.md), [multiplayer](docs/multiplayer.md), and [art direction](docs/graphics-art-direction.md) for subsystem work.
- Keep render-frame state outside React rerenders. Own and clean up audio nodes, loaders, subscriptions, and graphics resources; handle React StrictMode remounts.
- Run relevant checks (`npm run lint`, `npm run build`) for implementation changes and manually verify affected interaction/audio. Report environment blockers and untested behavior honestly. See [technical debt](docs/technical-debt.md).
- Give meaningful milestones an observable acceptance test and ask, “Can this become a compelling YouTube Short?” Use the [milestone](docs/milestone-roadmap.md) and [content](docs/content-roadmap.md) roadmaps.
- Deployment is planned in [docs/deployment-workflow.md](docs/deployment-workflow.md). Do not configure DNS, production deployment, or external infrastructure unless a subsequent task explicitly authorizes it. Do not publish content merely because it appears on the roadmap.

Create folders when implementation needs them. Keep durable decisions in `/docs` and update links when documentation moves.
