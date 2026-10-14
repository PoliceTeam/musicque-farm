# Farm image performance audit — 2026-10-12

Measured existing repository PNGs with Pillow: RGBA conversion, in-memory WebP encoding using `lossless=True, method=6`. No runtime assets or original art were converted. Source files remain unchanged. This measures encoded file sizes, not browser decode time or FPS.

## Renderer preload set

`prepare-assets.mjs` includes extracted v4, v5, v6, v7, v9, v20, v21, v22 and v23 assets in `farmUrls`. `farmStyleScenery` currently loads and decodes every entry with `Promise.all` at initialization, including older crop variants, unused sheet actions and food icons used only in React UI.

| Set | Images | PNG bytes | Lossless WebP bytes |
| --- | ---: | ---: | ---: |
| v4 | 121 | 1,855,106 | 1,315,140 |
| v5 | 6 | 1,176,844 | 860,352 |
| v6 | 9 | 1,628,704 | 1,161,578 |
| v7 | 4 | 849,573 | 484,680 |
| v9 | 106 | 1,587,397 | 1,268,914 |
| v20 | 161 | 1,010,577 | 742,048 |
| v21 | 110 | 1,291,586 | 976,340 |
| v22 | 18 | 340,735 | 259,642 |
| v23 | 10 | 1,747,591 | 1,194,352 |
| Total | 545 | 11,488,113 | 8,263,046 |

Lossless WebP saves 3,225,067 bytes (28.1%) in this preload set. Decoded width × height × 4 is 33,486,644 bytes for the source images regardless of their encoded format. Actual browser memory also includes image backing stores, compositing canvases, animation frames, textures and overhead; this is not a measured heap or GPU total.

Other farm PNG files were measured too: six modular images total 11,596,659 bytes PNG versus 8,332,350 WebP. They are outside the current `farmUrls` preload set, so do not add them to the main farm load figure.

## Recommendation

1. Preload only images consumed by the current renderer. Load kitchen/warehouse icons through their UI and leave obsolete crop art out of the scene preload. Preserve the review tool's ability to inspect the full library.
2. Generate smaller runtime derivatives for oversized illustrations while retaining the original sources. For example, v23 source crops and desserts are several hundred pixels wide but are displayed around 36–44 pixels in the live game; set target sizes using actual game and review requirements.
3. Use lossless WebP for runtime images where the measured saving is worthwhile. Keep source PNGs and deterministic exporters. This improves transfer size; it does not by itself reduce decoded pixel memory or fix repeated scene construction.
4. Do not use lossy conversion on approved sprite artwork without separate visual review.

A WebP migration must update asset copying/discovery, basename handling in the scene/review loaders, hard-coded PNG icon URLs and existence tests. Renaming image files alone is insufficient. The current commit keeps PNG runtime URLs functional.

Primary format references: [WebP compression](https://developers.google.com/speed/webp/docs/compression), [WebP FAQ](https://developers.google.com/speed/webp/faq).

## Interaction fixes included

Animation canvases are cached per scene. Animal texture keys share frames by species rather than individual animal. Herd updates preserve fixed scenery/crop surfaces and the scene motion clock. Snapshot polling redraws the portrait only on outfit changes and updates collision geometry only on enclosure-level changes. Regression tests cover repeated buying/removing herds with no added canvas allocations or fixed scenery replacements.

## Implemented migration

The recommendations for selective preload and lossless encoding are now implemented. See [farm asset structure](farm-assets.md) for the current manifest and reproducible export workflow. The scene now preloads 193 WebPs / 3,837,272 bytes; 253 WebPs / 4,854,582 bytes cover all farm runtime pictures. No resizing was applied: all converted images retain source dimensions and exact RGBA pixels. The audit above records the pre-migration baseline.
