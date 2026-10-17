# Common scenery

Runtime files live in `apps/game/src/assets/common/scenery/`, registered as `scenery:<key>` via `assets.json`. Clouds, skyline, trees, flowers, shrubs, curb and lamp are environment props rather than entertainment-street-owned artwork. The migration moved all nine files byte-for-byte; no artwork was regenerated or recolored.

Entertainment Street, Shopping Street and Pet Racing use the same generated `sceneryUrls` and shared `acquireSceneAssets` resource cache. Cache keys are resolved source URLs; legacy `entertainment:<key>` IDs resolve to the same source during rolling backend updates. Acquired scenes release decoded canvases on exit.

Source crops/masks remain reproducible through `tools/entertainment/export-assets.py` and the retained original atlases under `docs/art/entertainment/`. The exporter writes shared props to this group and feature-specific buildings/fixtures to entertainment. `tools/runtime/prepare-assets.mjs` imports the shared WebP files once using Next's hashed image loader; there are no extra feature-local/public copies. Add this manifest to the asset task inputs when changing the pipeline (already configured).

Shopping adds shared bus-stop, bench, lotus and autumn-tree art through `tools/shopping/export-assets.py`; its original sheets and crop rules are retained separately. ATM, road, paving textures, drain, bin and channel sign now also live here, moved byte-for-byte from Entertainment. Both deterministic exporters preserve the other source group's manifest entries.
