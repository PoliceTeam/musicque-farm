# Jeweler material assets

`source-art/materials-atlas.png` is the user's supplied transparent sheet. Top row: Đá lam, lục, tím, hồng, kim. Bottom row: Ngọc huyền linh, tinh tú, thiên linh.

Run `python3 tools/jeweler/export-assets.py` from the repository root. The deterministic exporter crops the eight original items into lossless RGBA WebP files under `apps/game/src/assets/jeweler/`; it does not recolor or regenerate the artwork. Source PNG stays in tooling. Runtime files are discovered by `prepare-assets` and served through generated `publicAssetUrls` with content hashes.
