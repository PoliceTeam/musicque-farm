# Farm style sample — 2026-10-10

Status: playable art-review sample, pending user approval. Entry: `/farm.html?style=sample`. The full farm layout remains available at `/farm.html`.

## Art source

Sunnyside World by Daniel Diggle: https://danieldiggle.itch.io/sunnyside

Downloaded the free `Sunnyside_World_ASSET_PACK_V2.1.zip` from the author's itch.io download page. Only selected PNG artwork was imported; no external scripts or GameMaker code were run. Local assets are under `apps/game/src/assets/farm/sunnyside/`.

The author's current V1 license permits free/commercial projects and modification. Credit is appreciated; assets must not be repackaged/resold or used to train AI. This project does not send these assets to image generation. Preserve attribution if the sample is retained.

Original sources: Tileset/spr_tileset_sunnysideworld_16px.png; Plants/spr_deco_tree_01_strip4.png and spr_deco_tree_02_strip4.png; Animals/spr_deco_chicken_01_strip4.png; Crops/carrot_00.png, soil_00.png and soil_01.png; UI/shovel.png, plant.png and water.png. Files remain as native PNGs. Exact tile extraction and building assembly are reproducible in farm-style-view.ts. Character artwork is unchanged.

## Scope

Independent tree/fence/building/animal surfaces, sparse lawn, continuous paths, six owned soil patches and one expansion sign. UI uses cream, wood and green; the selection panel shows relevant action states. The sample uses its own visible coop footprint and obstacles rather than invisible buildings from the full layout.

Xới đất → Gieo hạt → Tưới nước changes visual states of the selected soil patch for review. This is an ephemeral visual demo: no growth clock, inventory costs, saved progress or production economy. Chickens move inside the pen as visual ambience, not a livestock simulation.

The sample is a direction to review at native play size before replacing the full farm artwork. A passing test/build does not mean art approval.

## Validation

`pnpm check` passed (159 game tests); `pnpm build` passed. A dedicated route test checks all six plot interaction points and the visible coop, including the absence of inherited invisible obstacles. Browser review at 1280×720 and 390×844 checked selection, cursor anchoring, sequential enabled action buttons and independent visual soil states. No console errors observed. This is viewport testing, not testing a physical touch device.
