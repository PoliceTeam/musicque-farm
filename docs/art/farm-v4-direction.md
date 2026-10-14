# Farm v4: user-selected visual direction

2026-10-10. User rejected the muted Sunnyside sample and supplied two new references. These define the requested style and layout; they do not approve the existing implementation.

## References

- `references/farm-v4-asset-reference.png`: category sheet, 1536×1024.
- `references/farm-v4-layout-reference.png`: composition with asset legend, 1672×941.

Use the colorful chibi cartoon treatment: clear dark contours, vivid yellow/orange/pink/green tree crowns, readable detailed buildings, soft dirt paths, varied flowers/grass and decorative borders. Do not use the sheet or the assembled example as a farm background.

## Map composition

Animal enclosures on the left; kitchen and storage at the rear; owned soil and reserved expansion lawns in the middle; pond on the right; entry near the lower center. Paths connect each interaction point. Reference labels, legend panels and yellow arrows are presentation annotations, not runtime UI. Keep the user's white selection cursor and no zoom interaction. Preserve 48 stable soil slots, initially six owned patches and only the next purchase sign; reserved soil is lawn until purchased.

## Independent assets and expansion

Terrain/path corners and edges, grass details, soil states and crop stages, tree/bush sprites, fence segments and gates, kitchen/storage, feed/water troughs, nests, animal frames, pond water/shore/corners, fish and ambient effects must be separate renderable assets. Pen/pond bounds remain data-driven and shared with collision and interaction points. Extend fences/shore within reserved zones, without stretching buildings, animals or individual edge modules.

Retain approved character artwork and review scale against soil and doors at real play size. Character sprites shown in the sheet are references, not permission to replace the current avatar/equipment system.

## Extracted prototype pack

The user authorized extraction from the flattened reference. `apps/game/src/assets/farm/extracted-v4` now contains 120 standalone RGBA PNGs and a manifest, exported using `tools/export-farm-v4.py` and the reviewed crop rectangles in `tools/farm-v4-slices.json`. The main sheet was cleaned with ImageGen; four tree variants were separately reconstructed from the reference to separate their silhouettes from adjacent shrubs. These derivatives are not pixel-exact source copies. Source atlases are saved beside this document; the contact sheet and downloadable ZIP are in the workspace's `outputs/farm-review` directory.

The contact sheet was visually reviewed and crop errors corrected, including neighboring animal fragments and objects below buildings. PNG transparency and manifest dimensions were verified. Animal variants remain static poses with `animationReady: false`, not complete walk cycles. Pond boundaries still need modular shore/corner assets for upgrades. Remove the baked-in warehouse arrow before runtime use. The live farm has not yet been migrated to this pack.

Next review should show one cohesive playable garden using these assets, not another full-map substitute background or a mixed-style placeholder scene.

The user identified a duplicated head in cow-1 after initial review. That sprite has now been replaced, and an empty basket added. The new art remains pending user approval. See farm-v4-asset-fixes.md.

The initial extraction omitted most terrain tiles. Added 67 terrain/decor pieces from the existing cleaned atlas on 2026-10-10. A dedicated terrain contact sheet is exported together with the combined sheet and ZIP. Crop errors were corrected for flower clusters, stone slabs and neighboring posts. These are reference cutouts; tile adjacency, collision bounds and modular pond composition remain to be validated during farm integration.

## First playable modular integration

The main `/farm.html` and previous `?style=sample` route now use the extracted pack. Separate trees, building sprites, fence segments, animals, soil slots and water/shore modules are positioned from the same farm data used for collision and interaction. The main layout is 1280×720; the existing approved avatar is rendered at 0.85 scale. The old sample layout has been retired.

Only owned soil and the next purchase sign are rendered. The 48-slot plan includes wider row lanes so every interaction remains reachable when fully unlocked. Grass reservations remain clear. The pond preserves corner and edge module sizes while changing its interior footprint. `?layout=expanded` is still an art/footprint preview, not a playable unit upgrade.

The growing loop uses dry → tilled → seeded → growing → ripe → harvest/replant, with a one-minute prototype duration. Plot commands require the avatar to be at that plot's interaction point. State is saved locally. Barn, poultry, kitchen and pond are visible areas without production gameplay yet. Animal motion uses static poses with gentle movement confined to pens; validated walk-cycle art is still pending.

`soil-tilled` was added using built-in ImageGen so empty tilled earth does not show a pre-existing seedling. Source: `farm-v4-soil-tilled.png`. Prompt: Edit the reference soil tile into freshly TILLED EMPTY soil; preserve rounded tan border, brown palette and chibi perspective; remove the green seedling and replace cracks with three subtle parallel horizontal furrows; no seeds, plants, roots, rocks or grass; isolated tile with true alpha background. Export configuration retains the source and target size.
