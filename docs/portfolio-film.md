# A life, in the making — `/portfolio/4`

English cinematic résumé direction, following the user's request for a scroll-driven career story inspired by Lusion's immersive storytelling. This is an original procedural implementation, not a copy of Lusion assets. Earlier portfolio routes remain available.

## Story and motion

Seven chapters: prologue, BYU Broadcasting, Neighbor, Fitzza, BYU Archaeology, Bridge, and an invitation to the next chapter. The shared résumé data supplies roles, periods, outcomes, and full contributions. Fitzza remains an explicitly undated interlude because its source dates conflict; no dates were inferred.

Each chapter pairs an editorial introduction with a spatial metaphor: a continuous knot, sound waves, city structures, mobile interfaces, archaeological contours, connecting arches, and an open horizon. A fine thread runs through the 3D sequence. Scroll moves the camera along the same reversible path and blends chapter colors. The first portion of each chapter holds the camera to give the reader time before moving onward.

Native scrolling works with wheel, trackpad, touch, and keyboard. The right-side chapter index, opening CTA, home button, and contact shortcut navigate directly. “Behind this chapter” opens the full résumé record in a native modal with focus containment and Escape dismissal. Email, LinkedIn, and the shared résumé PDF remain directly available. Content stays readable when WebGL is unavailable. Reduced-motion preferences use chapter cuts and disable ambient drift/parallax.

## Implementation

`src/portfolio/film/FilmPortfolio.tsx`, `FilmScene.tsx`, `story.ts`, and `film.css`. R3F, Three.js, procedural shaders and geometry; no new dependencies, external textures, fonts, or audio requests. Frame data lives in refs and Three objects; React updates chapter selection and modal state. R3F owns geometry/material cleanup; page listeners and title changes are cleaned up on unmount. DPR is capped at 1.5.

The source résumé copy remains `docs/Resume.pdf`, served via `/portfolio/jongwoo-lim-resume.pdf`.

## Acceptance

Scroll from the opening sculpture through all career chapters, reverse to the beginning, jump directly to Bridge, open its documented outcomes, and finish at the contact invitation. All five career records must remain accessible on mobile without playing a game.

Checks: `npm run lint`, `npm run build`, and `node scripts/check-portfolio-film-browser.mjs` with Vite at 5173 and a dedicated Chrome CDP instance at 9227. Desktop 1440×1000 and mobile 390×844 captures are inspected. Physical mobile GPU performance and cross-browser behavior remain unmeasured. Existing shared bundle-size warning remains.

Can this become a compelling YouTube Short? A continuous scroll from the opening knot through the career sculptures into the final horizon provides the intended capture sequence. No deployment or publishing has been performed.
