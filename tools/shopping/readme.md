# Shopping street

`center/shopping-street` uses the shared location renderer, header, movement, channel presence and player actions. The Center region on the world map opens this map. Storefronts are scenery until their shop flows are implemented, so no yellow entry arrows are shown.

The six buildings come directly from the user-supplied transparent sheet retained at `docs/art/shopping/buildings.png`. Crop coordinates live in `assets.json`; each runtime WebP has four transparent pixels of padding. No buildings are stretched or baked into a full-map background.

Run `python3 tools/shopping/export-assets.py` from the repository root with Pillow installed. `scenery.json` extracts the bus shelter and separate stop sign, bench, lotus and two autumn trees from the retained overview atlas. That sheet has a translucent background; the exporter removes its faint backdrop and disconnected neighbouring fragments around trees. The source artwork is otherwise retained.

Shared props are registered in `tools/scenery/assets.json` and exported to `apps/game/src/assets/common/scenery/`. ATM, paving textures, road, drain, bin and channel sign moved there byte-for-byte from Entertainment. Existing `entertainment:*` IDs retain their common-source alias during rolling server updates. Both exporters preserve the other source group's scenery manifest entries.

`prepare-assets.mjs` registers `shopping:*` through Next's content-hashed image imports. Changes to the shopping manifest participate in the existing Turbo asset cache. Original PNG sheets are authoring inputs only; runtime uses WebP.
