# Sheem content visual identity — draft 01

Status: proposal for review, not an approved product-wide rebrand.

Use the meadow's quiet atmosphere to connect development Shorts to the product. Keep the background restrained so narration, large captions, receipts, and actual product footage carry the story.

## Palette

| Color | Hex | Role |
| --- | --- | --- |
| Forest | `#354C3B` | Primary dark background and text on light backgrounds |
| Cream | `#F4F0DF` | Primary light background and text on forest |
| Sage | `#9EAE8B` | Landscape layers and secondary decoration |
| Sunlight | `#DFC786` | Occasional warm emphasis |
| River | `#86AAA8` | Small cool accents |

Optional expense emphasis: soft coral `#EDA98B`. Do not use sage or river for small essential text without checking contrast. Use bold Korean sans-serif captions; reserve serif lettering for the Sheem name. Keep essential content away from the right-side Shorts controls and bottom caption area; verify with an unlisted upload before publishing.

## Background assets

All backgrounds are original SVG artwork exported as 1080 × 1920 PNGs. They contain no baked-in text or logos, so captions stay editable in CapCut.

- [Forest Light / 숲빛](assets/brand-v1/01-forest.png): default opening, costs, and important numbers. Cream text on forest.
- [Meadow Haze / 초원 안개](assets/brand-v1/02-meadow.png): vision, transitions, and closing questions. Forest text on pale sky.
- [Field Notes / 개발 노트](assets/brand-v1/03-notebook.png): receipts, progress, and comparisons. Forest text on cream.
- [Comparison board](assets/brand-v1/preview.png), [editable HTML preview](assets/brand-v1/preview.html). Sample copy is illustrative, not part of the background files.

SVG sources beside each PNG preserve editability. The earlier grid assets remain an alternative experiment.

## First Short

Start with Forest Light for the first three seconds. Add the spoken hook “아직 게임도 없는데, 먼저 260달러를 썼습니다.” as short editable captions, with a large “−$260”. The amount is supplied by the creator; verify against receipts before publishing. Brief scale/fade animation is enough; leave the background still or move it very subtly.

Then use Field Notes for domain/subscription purchase details, followed by real Sheem screen recordings. Crop receipts to the relevant item and amount. Show the current meadow preview accurately; describe walking and multiplayer as future plans, not shipped features. End with one specific viewer question.

Use only the backgrounds needed by the story. Do not repeat a fixed three-second logo intro in every video. Keep nature audio audible when demonstrating the world, and avoid loud effects that undermine the experience.

## CapCut handoff

Import a background PNG, place it on a 9:16 timeline, and trim to the scene duration. Put text and screenshots on separate tracks. Save a clean project copy before making each episode so the palette, typography, and placements can be reused. Test the first three-second export on a phone for readability before editing the full Short.

No app styling, deployment settings, or external publishing is changed by these assets.

## World collection — draft extension

Four additional static backgrounds share the forest/cream palette with muted blue-green weather and night colors. These are illustrations of possible future environments, not screenshots of implemented worlds. Use PNGs in CapCut and retain the SVGs for edits.

| Background | Asset | Suggested use / text color |
| --- | --- | --- |
| Cloud & Mist / 하늘과 안개 | [PNG](assets/brand-v1/04-clouds.png) | New environments, explanations; forest text |
| Rain in the Woods / 비 오는 숲 | [PNG](assets/brand-v1/05-rain.png) | Rain and audio development; cream text |
| After Sundown / 밤의 캠핑 | [PNG](assets/brand-v1/06-camp.png) | Campfire and quiet presence; cream text |
| Constellation / 별자리 하늘 | [PNG](assets/brand-v1/07-constellations.png) | Future ideas and viewer questions; cream text |

[World collection comparison](assets/brand-v1/world-preview.png) · [HTML](assets/brand-v1/world-preview.html)

The central area is intentionally quiet. Rain, fire, and stars are drawn into static artwork, not animated. Constellation lines are decorative invented patterns, not astronomical diagrams. Choose a background to match each episode's subject rather than changing backgrounds on every sentence. Gentle scale changes can add motion; keep the supplied still image available as the reduced-motion baseline.

## Static quality review — 2026-09-29

Inspected all seven PNGs individually and with identical sample captions at 360 × 640 CSS pixels. All PNG dimensions are 1080 × 1920. [Readability comparison](assets/brand-v1/readability-review.png) / [HTML](assets/brand-v1/readability-review.html). The mock right/bottom controls illustrate potential overlap, not exact YouTube UI geometry. No physical phone, video encoding, motion, or uploaded playback was tested.

- Forest: very low visual noise; strongest general-purpose dark canvas. Preserve.
- Meadow: very low noise; landscape stays below captions. Use forest-colored text, not white. Preserve.
- Notebook: low noise; dots are faint at reduced size. Best for screenshot/card overlays. Preserve.
- Clouds: low noise; sun and fog add hierarchy without entering central copy. Similar role to Meadow; use as an alternative, not a mandatory additional scene. Preserve.
- Rain: highest relative noise in the collection, but sample captions remain readable. Fine diagonal rain crosses the text region and repeated tree shapes look more schematic than the other landscapes. Suitable for rain-specific episodes; avoid adding dense animated rain or placing small text over the lower forest. No blocking defect in the current static version.
- Camp: low central noise, strong warm focal point at the bottom. Tent/fire may be covered by playback UI; they are decorative, so no essential meaning should rely on them being visible. Preserve.
- Constellations: low-to-moderate noise. Stars are subtle, connecting lines more prominent; keep primary copy in the central upper-middle area and avoid long copy over the lower-right constellation. Preserve.

Decision: sufficient variety and quality to begin editing. No background artwork changes needed in this pass. Use Forest/Meadow/Notebook as the everyday set and select themed variants when relevant. Validate actual caption placement and compressed gradients on the first video export before calling the complete video final.
