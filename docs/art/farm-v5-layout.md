# Farm layout revision, 2026-10-10

Reference: references/farm-v5-layout-reference.png. This is a layout reference, not a runtime background and not user approval of this implementation.

- One shared livestock enclosure on the left, containing cows, pigs, sheep and poultry. Independent level 0 → 1 → 2 upgrades expand its footprint; no duplicate pens.
- Kitchen and warehouse behind the main path. Upper field holds 24 square 40×40 plots; three lower grass reservations hold eight plots each. Stable IDs total 48; initially six. Only the next plot displays a buy sign.
- Flowers in reservations are regenerated from owned plot count, so a purchased soil slot has no flowers left over it.
- Rounded lawn borders, softened grass texture and reduced sky band. Player art stays approved, drawn at 0.85 scale.
- Pond on the right grows independently through three footprints. One continuous water canvas, individually positioned rock clusters, standalone lotus and shoreline plants replace repeated bitmap shoreline segments.
- Stand points remain outside maximum upgrade footprints. This prevents purchasing an upgrade from trapping the player in new collision bounds.
- Save version remains 1. Old saves without unit levels migrate to both level 0 while retaining coins, crops, timers and owned land. Expansion is charged 1,500 then 3,000 xu per unit, once each; maximum levels cannot be bought again.

New six transparent prop cutouts use built-in ImageGen. Source: farm-v5-shore-props-atlas.png. Deterministic export: tools/export-farm-v5.py with tools/farm-v5-slices.json. Reference artwork used for visual direction only. Existing approved character sprites were not edited.

Current limits: livestock and fish production are not implemented; upgrades currently change area and scenery. The 60-second crop cycle remains a prototype tuning value.

Validation of this revision:
- `pnpm check`: formatting/lint/typecheck and all 163 game tests pass, including routes to all 48 owned plots with both units at maximum size.
- `pnpm build`: passes.
- Browser: both paid upgrades for each unit, correct coin deductions, hidden upgrade button at maximum, buying plot 7, correct square selection cursor and next buy sign.
- Reload preserves 7 owned plots, prior crop state and both level-2 units. Existing saves without unit data retain previous progress.
- Checked desktop 1280×720 and portrait 391×844; care panel fits portrait and keeps the correct selected plot while the camera follows walking.
