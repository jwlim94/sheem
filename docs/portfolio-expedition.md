# Career expedition — `/portfolio/3`

An English game-like résumé: pilot a ship, navigate to five career planets, scan within range, and collect the corresponding professional experience. Previous island and universe routes remain separate.

## Interaction and content

- Click a planet, its label, or a numbered sector-map button to autopilot to its docking circle. Click empty space to fly freely; WASD/arrows override autopilot. Bounded movement is independent of frame rate.
- Within scanning range, press E or the scan button. Reading pauses flight. Escape or Close returns to the map. Flight log previews every career record without requiring play; previews do not count as discoveries.
- Five discoveries complete the expedition and expose a contact invitation. Deduplicated IDs persist under `jongwoo-expedition-v1` in localStorage; unavailable or invalid storage safely falls back to in-memory progress.
- Resume copy shares `src/portfolio/experience.ts` and the local PDF with `/portfolio/2`. No fabricated career dates or metrics. Fitzza's inconsistent source dates remain omitted. LinkedIn and email are in Flight log.
- Mobile uses tap navigation and a following camera, plus the persistent sector map. Native modal focus containment, Escape, scrollable reading, reduced ambient motion, and direct reading without WebGL are provided.

## Implementation

`src/portfolio/expedition/`: page, R3F scene, small movement model, deterministic stars, procedural planet shaders, isolated styles. No dependencies or external assets were added. Flight state and camera updates stay outside React render state. Only navigation, docking-range changes, and discoveries update the UI. Event listeners are removed on unmount; R3F owns scene resources.

## Verification

`npm run lint`, `npm run build`, and `node scripts/check-portfolio-expedition-browser.mjs` (Vite 5173, dedicated Chrome CDP 9227).

Desktop browser verified keyboard flight, all five autopilot arrivals, keyboard/button scans, paused flight while reading, five unique saved records, completion, reload persistence, direct flight log, Escape, and mobile reading scroll at 390×844 with no runtime exceptions. Desktop and mobile screenshots were inspected. Actual phone GPU performance has not been measured. Shared main-bundle size warning remains.

Acceptance: launch → arrive at Bridge → scan → read the documented outcomes → fly to the next experience. Can this become a compelling YouTube Short? This continuous ship-to-scan-to-career-record loop is the proposed capture; nothing has been published or deployed.
