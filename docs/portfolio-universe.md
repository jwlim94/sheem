# A universe of work — `/portfolio/2`

Independent English portfolio direction for Jongwoo Lim. The original island at `/portfolio` is preserved. No production deployment was performed.

## Experience

A procedural star field, layered nebula, warm atmospheric planet, and orbital lines introduce five professional experiences. The camera approaches on entry, responds to pointer movement and bounded wheel travel, and smoothly reframes a selected signal. All five chapters are also accessible directly from the HTML navigation.

Experience content comes from `src/portfolio/experience.ts`, adapted from `docs/Resume.pdf`. Fitzza's inconsistent source dates remain omitted. The résumé is served at `/portfolio/jongwoo-lim-resume.pdf`; replace this copy when updating the source résumé. Contact links use the résumé's email and LinkedIn address.

The selected chapter shows role, dates where available, location, outcomes, and contributions. Previous/next controls and left/right arrow keys switch chapters; Escape returns to the overview. Mobile uses a horizontally scrollable chapter list and vertically scrollable reading panel. Reduced-motion preferences disable introductory flight, pointer drift, and ambient motion. Content navigation remains available if WebGL cannot initialize.

## Implementation

- `src/portfolio/universe/UniversePortfolio.tsx`: page, semantic navigation, readable content, contact, error boundary.
- `UniverseScene.tsx`: deterministic 7,200-star field, procedural shaders, signals, camera.
- `universe.css`: isolated styles, responsive composition, reduced motion.
- Lazy route in `src/App.tsx`; no additional dependencies, image assets, character models, or external font requests.

Frame state stays in refs/Three objects. Geometry and materials are declarative R3F resources; event listeners are removed on unmount. Pixel ratio is capped at 1.5. Device-specific GPU performance still needs real mobile testing.

## Acceptance and verification

`npm run lint` and `npm run build`. Browser script: `node scripts/check-portfolio-universe-browser.mjs`, with Vite at port 5173 and a dedicated Chrome launched with `--remote-debugging-port=9227`.

Desktop 1440×1000 and emulated mobile 390×844 were visually inspected. Verified all five chapters, camera parallax/wheel travel, arrow/Escape navigation, contact links, local PDF response, panel scrolling, reduced motion, and no runtime exceptions. Existing shared bundle-size build warning remains.

Observable milestone: open the universe, approach the planet, select Bridge, and read its outcomes without completing any game action. Can this become a compelling YouTube Short? A continuous opening camera movement → hovering a signal → selecting a chapter provides a concrete short capture sequence; no content has been published.
