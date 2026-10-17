# Jewelry interior

Source: user-provided `docs/art/jewelry-shop/atlas.png`. Run `python3 tools/jewelry-shop/export-assets.py`, then the game's `prepare-assets` task. Each wall, floor, counter, shelf, plant and decoration is exported separately for future apartment furnishing. Crop rectangles and component masks are in `assets.json`; the counter restores its clear tabletop from a clean strip in the same source.

The center jewelry storefront opens `jewelry-shop`. Its employee uses the shared jewelry NPC and a marker in front of the counter. The existing game has no gem inventory or trading service; interacting currently shows a preparation notice, without a fictional balance or purchase operation.
