# Shop employees

The original user-provided sheet is retained in `docs/art/shop-npcs/atlas.png`, including all alternate poses and portraits for future shops. `assets.json` selects the standing pose for each of its 20 roles. Run `python3 tools/shop-npcs/export-assets.py` to export transparent runtime WebP files.

The exporter removes detached sheet fragments, preserves proportions, and anchors every employee to the same feet position on a 100 × 130 canvas. Map layers use `npc:<role>` and retain the typed `npc` role for validation. Existing stores use salon, pets, held, premium, jewelry, and store respectively. Unopened roles remain available without adding storefronts or fake products.
