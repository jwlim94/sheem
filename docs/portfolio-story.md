# Compiled story — `/portfolio/6`

English software-engineer portfolio told by scroll, following the user's request for Lusion-style storytelling centred on a computer science path: school, work, master's, work. Original procedural implementation; no Lusion assets. Earlier portfolio routes remain unchanged.

## Story

Nine chapters, in résumé order, on two tracks (education / work): Hello → B.S. Computer Science (BYU, May 2019 – Dec 2022, Full Academic Scholarship 2020 – 2022) → BYU Broadcasting → Neighbor (graduation noted, Dec 2022) → Fitzza (undated interlude; source dates conflict) → Master of Information Systems Management (BYU, Sep 2024 – Sep 2025) → BYU Archaeology → Bridge → What's next (résumé skills and contact). Copy uses only `docs/Resume.pdf` facts via `src/portfolio/experience.ts` (`experiences`, `education`, `skills`); no inferred dates or metrics. Each experience/degree opens a full-detail dialog.

## Motion

One particle field (14,336 points desktop, 8,192 mobile) morphs between a shape per chapter: seed sphere, grid lattice, audio waveform, city map with pins, phone screens, decision network, topographic contours, documents → bar chart, and an open orbit. Targets are generated once into a float texture and blended in the vertex shader with per-particle stagger and scatter; the mouse gently pushes nearby points. Native scrolling drives an eased progress value; each chapter holds its shape before morphing in the last half of its span. Copy is pinned inside the scroller (so wheel/touch over text still scrolls); only the active chapter is visible and interactive (others are `inert`). Bright editorial palette with a per-chapter accent.

Reduced motion: no easing, scatter, drift or pointer push; shapes cut between chapters. Content stays readable if WebGL fails.

## Implementation

`src/portfolio/story/`: `StoryPortfolio.tsx` (page, scroll loop, index, timeline, dialog), `StoryScene.tsx` (points + shader), `shapes.ts` (deterministic shape generators), `story.ts` (chapter copy), `story.css`. No new dependencies or external assets. Frame state lives in refs/uniforms; React rerenders only on chapter or dialog change. The rAF loop, media listener and title are cleaned up on unmount; texture, geometry and material are disposed.

## Validation (2026-10-10)

`npm run lint` and `npm run build` pass. Headless Chrome at 1440×900 and 390×844: all nine chapters activate at their scroll positions with no console errors; mid-morph frame checked; wheel over text scrolls; index jump, dialog open and Escape close work. Not yet verified: real touch devices, Safari/Firefox, low-end GPU frame rate.
