# Farm visual polish, 2026-10-10

The user accepted the v5 layout structure and requested better presentation, lower front fence, higher houses, softer grass borders, consistent crop tiles, wider paths and an animated pond.

- Front flowers/wall moved down 40px, entry gate down 38px; walk area extends to y=680 with fence collision starting y=686.
- Kitchen/warehouse use baseline y=270, 25px higher. Their front interaction points moved to y=300.
- Lawn panels no longer have the dark continuous outline. Soft grass transitions preserve the four field reservations. Three lower fields have wider intervening paths (45px instead of 17px).
- Pond uses the reserved area's full width at every level. Upgrades add depth; left-side interaction stays outside its largest footprint. Shared livestock upgrades now expand monotonically too.
- All crop states share a 40×40 canvas. Growing plants are separate sprites with the same root anchor (20,34), rather than resizing a different combined soil-and-plant bitmap at each stage. First 20 seconds after watering show a seedling.
- Orange, blue and koi fish swim along bounded paths. 24 heading frames, 24 water ripple/shimmer frames, fish shadows below the ripples and lotus above them. Animation uses a bounded set of texture keys and does not mutate cached canvas textures.
- MENU has direct buttons to the livestock/pond upgrade panels. Maximum-level button remains visible but disabled with explicit 3/3 text. Low balance and movement states have explanations.
- Dev-only `farm.html?review=upgrades` starts a temporary fresh farm and never writes browser storage. Normal saved farms are preserved. `farm-art-review.html` renders the actual shared crop compositor at native and 3× sizes for visual review; neither review page is part of product navigation.

## References

- https://doc.mapeditor.org/en/stable/manual/terrain/ — corner/edge transitions and variation for connected terrain.
- https://kenney.nl/assets/tiny-town — consistent tile-based environmental asset scale. No Kenney assets copied into this revision.

New raster source: farm-v6-crops-fish-atlas.png. Built-in ImageGen prompt: farm-v6-crops-fish-prompt.txt. Deterministic alpha-preserving export: tools/export-farm-v6.py and tools/farm-v6-slices.json. Existing character art unchanged. Final art is still a user-review candidate.

## Validation

- `pnpm check`: 164 game tests pass; lint, formatting and TypeScript pass.
- `pnpm build`: passes.
- Routes to all 48 plots pass with both units fully expanded. Crop interaction points are offset beside the selected tile so the character does not cover its plant.
- Fish path tests sample all nine fish over two minutes for all three pond footprints, including the full rotated sprite margin.
- Browser tested fresh temporary farm: both paid expansions for livestock and pond, correct 20,000 → 11,000 balance, maximum button stays visible, no writes to the existing saved farm.
- Crop state review shows the same runtime compositor at native 40×40 and 3× size for dry, tilled, seeded, seedling, growing and ripe.
