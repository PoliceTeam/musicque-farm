# Crop reference v2

Runtime migration: committed assets now use organized lossless WebP folders. Source slicing scripts write intermediate PNGs to `tools/.farm-export/`; regenerate the selected runtime set with `python3 tools/build-farm-assets.py`. See [current asset structure](../farm-assets.md). The versioned paths below describe the original integration history.

User supplied the sheet and requested integration on 11 October 2026. Integrated for review; the in-game result has not yet been approved.

Source: `farm-crop-reference-v2.png`. Rebuild with `python3 tools/export-farm-v21-crops.py` (Pillow required); explicit rectangles are in `tools/farm-v21-crop-slices.json`. The exporter removes faint coloured halos and arrows using alpha/component filtering and outputs distinctly prefixed files under `extracted-v21` so older crops cannot override them.

Eighteen crop sequences use the new sheet. Dragon fruit retains the previous cactus growth sequence because its new row mixes rose plants with dragon fruit; its harvested fruit icon is updated. Pineapple skips the corn flowering poses in its row. Tulip uses pink buds and flowers, excluding the orange/red variants. Cucumber has no gameplay entry and is not added by this artwork update.

The visual number of stages follows each valid reference sequence. Growth duration, seed prices, yields and saved crop IDs are unchanged. All growth stages use one scale per crop and a fixed baseline at y=31 on the 40px soil tile, extending upwards as needed. The farm and art review share the same compositor. `/farm-art-review` now shows every crop stage and its harvested icon, including the dragon fruit fallback.
