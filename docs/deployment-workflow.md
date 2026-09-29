# Deployment workflow: local → preview → main → sheem.ai

**Planning only.** The user owns `sheem.ai`. No DNS, hosting account, Git integration, secrets, CI, production deployment or other external infrastructure was configured in this pass. Existing repository files do not prove that any external deployment is currently connected.

## Recommended topology

| Component | Proposed location | Responsibility |
| --- | --- | --- |
| Vite frontend | Vercel static hosting/CDN | Serve built app and initial public assets; feature-branch preview URLs and production domain |
| Colyseus rooms | Separate persistent Node service on a managed container/VM host | Own in-memory rooms and secure realtime connections; start with one process/region |
| Assets | Same frontend origin initially; dedicated object storage/CDN only when measured delivery needs justify it | Versioned runtime audio/models/textures, not original masters |
| Persistent data | None for MVP | No mandatory account or player database |

Vercel is recommended because its Git workflow supports branch previews and production-branch deployments, and it supports Vite. [Git deployments](https://vercel.com/docs/git), [Vite integration](https://vercel.com/docs/frameworks/frontend/vite)

A managed persistent host such as Railway or Fly.io is a candidate for the room service, not a selected or verified account/plan. Before choosing, verify Node support, process lifetime, secure WebSockets, room routing, deploy/restart behavior, region, logs, health checks, cost and idle policy. Do not assume a free tier or that a service may sleep without harming guest entry.

Current Vercel material announces WebSocket support in public beta; older “Vercel cannot serve WebSockets” advice is no longer a safe architecture premise. The recommendation for a separate persistent service is about predictable room ownership and lifecycle, not lack of transport support. Multi-instance broadcasts still require coordination. [WebSocket announcement](https://vercel.com/changelog/websocket-support-is-now-in-public-beta), [Vercel presence example](https://vercel.com/kb/guide/real-time-presence-hono-react)

## Local workflow

Use npm with `package-lock.json`. Future clean setup: `npm ci`, then `npm run dev`; verification: `npm run lint`, `npm run build`, then `npm run preview` for the built frontend. The present installation needs repair first; see [audit results](repository-audit.md). Pin a supported Node version once validated and use the same version in local development and CI.

When the server exists, add a separate server development command and documented local endpoint (for example localhost:2567). No such script exists today. Test two browser sessions against that local service. Keep local environment values in ignored `.env.local`; provide a non-secret example file when those settings are actually introduced.

## Environment isolation

| Environment | Frontend | Room backend | Data/credentials |
| --- | --- | --- | --- |
| Local | Vite localhost | Local process | Local settings; no production credentials |
| Feature preview | Unique branch/PR build URL | Ephemeral per-PR service where practical; otherwise staging service with build/protocol-specific room namespace | Preview-only credentials/config; never production rooms |
| Production | Approved `main` build at sheem.ai | Production service | Production-only server secrets and origin allowlist |

If no compatible preview backend is available, run an explicitly labelled solo preview; do not silently connect previews to production. A shared staging backend must refuse incompatible protocol/world versions and isolate branches. Treat untrusted PR code as untrusted: do not expose deployment/server secrets to it.

Proposed frontend configuration: a public room-service endpoint such as `VITE_ROOM_SERVER_URL` and a build/world version. All `VITE_*` values are client-visible; secrets belong only in server/provider settings. Configure exact trusted origins and HTTPS/WSS before hosted tests. Names here are proposals, not existing settings.

## Git and release flow after authorization

1. Work locally on a small feature branch; preserve unrelated working-tree changes. Run relevant checks and record local acceptance.
2. Push/open a PR to trigger an isolated frontend preview and compatible staging/preview server when required. Capture the tested commit and preview URL.
3. Review behavior, audio, compatibility, asset payload and CI results. Protect `main` with required checks and review so an approved merge is the deployment decision.
4. An approved merge/push to `main` automatically builds and deploys production. Use a Git-based pipeline with health/smoke gates; protect direct pushes rather than relying on a second manual deployment ritual.
5. For a protocol change, deploy a backwards-compatible server first or keep versioned rooms/services while old clients drain; then release the matching frontend. Include current-build assets in rollback retention.
6. Verify guest entry, audio start, direct-route refresh, assets, room join and two-client presence. Record commit/build and release outcome.

CI should use the validated Node version, `npm ci`, lint/build and relevant behavioral checks once they exist. Preview approval is about the actual commit to be merged; update checks when it changes. Provider auto-deploy defaults alone are not a substitute for protected branches and backend compatibility.

## Prerequisites before connecting production

- Explicit authorization for infrastructure setup, selected Git/hosting owners, access to the existing repository and domain registrar, and an agreed operating budget.
- Reproducible clean install/build; decide supported browsers; resolve baseline defects and establish required CI checks.
- Documented runtime asset licenses/provenance and size policy. Move or exclude local original audio backups from deployable public assets in a later implementation task; gitignore alone does not exclude them from local Vite output. [Vite public assets](https://vite.dev/guide/assets.html)
- Frontend install/build/output settings (`npm ci`, `npm run build`, `dist`), SPA fallback for BrowserRouter deep links, useful asset 404 handling, and intended treatment of experimental routes.
- HTTPS/WSS, scoped origin rules, environment separation, server rate/capacity limits, health endpoint, basic error/log visibility and bounded log retention.
- Room service lifecycle, restart/reconnect and version compatibility proven in staging; distinguish frontend preview success from a healthy multiplayer backend.
- Confirm the domain's current records and services before any later DNS edit; retain existing records needed by other services. Set canonical apex/www behavior and verify certificate issuance when authorized.
- Document rollback ownership and exact provider steps after providers are selected; rehearse with staging before production traffic.

## Rollback and operation

Keep previous frontend builds, matching assets and compatible backend versions. Roll back to the last verified frontend deployment or revert the failing commit through the same checks. A frontend-only rollback is unsafe if its protocol no longer matches the server; retain compatible rooms or roll back both deliberately. In-memory rooms may be lost on server restart, so test graceful reconnect and communicate the interruption.

Monitor join failures, disconnect/reconnect rate, asset/decode failures, entry time, client frame-time samples and room process health. Start with minimal diagnostics and no invasive analytics requirement. Reassess caching, an asset CDN, server capacity and provider costs only after actual traffic measurements.
