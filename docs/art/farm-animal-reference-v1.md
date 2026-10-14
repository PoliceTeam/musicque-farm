# Animal reference integration

Runtime migration: committed assets now use organized lossless WebP folders. Source slicing scripts write intermediate PNGs to `tools/.farm-export/`; regenerate the selected runtime set with `python3 tools/build-farm-assets.py`. See [current asset structure](../farm-assets.md). The versioned paths below describe the original integration history.

Artwork supplied by the user on 11 October 2026; integrated for review, pending approval of the in-game result.

The nine enabled species (hen, duck, cow, sheep, pig, buffalo, turtle, fish and dog) now use this sheet. Dog was enabled on 2026-10-12 as a livestock companion: 1 Gem purchase, 24 hours of fed growth, 1000 coins sale, no production or butchering. The source is `farm-animal-reference-v1.png`; regenerate sprites with `python3 tools/export-farm-animals.py` using `tools/farm-animal-slices.json` (Pillow required).

The sheet headings do not match the actual frame counts: hen/duck have seven walk images, buffalo/fish have five, and the other animals have six. The exporter keeps the actual artwork, removes near-transparent coloured halos and detached specks, and saves transparent individual images in `extracted-v20`.

Four visual growth sizes use existing fed age: birth, one sixth of maturity, one third of maturity, and maturity. Gameplay retains its three life stages, prices, production and saved data. Adults use reference idle and feeding frames. Walking land animals and turtles keep one reference silhouette and animate the lower leg region with alternating foot swing/lift and a small body bob; the same gait applies to juvenile growth artwork. This avoids treating the nearly identical, differently sized walk images as a complete gait cycle. Fish use the reference swim frames. Sleep frames are exported for future use; no automatic sleeping rule is introduced. Egg, duck egg, milk, wool and fish icons use the matching reference products.

The art review page at `/farm-art-review` shows the land animals walking continuously with both facings, plus fish/turtle size previews.

## Motion smoothing

Walk, idle and feeding now share a 32-step cycle at 35 ms per step (previously eight steps at 140 ms). Each action holds one reference silhouette so alternating poses cannot change body proportions. Walking uses the same base silhouette as standing, a smaller smooth body bob, and species-specific leg cut heights; buffalo leg articulation is restricted to the bottom 16% rather than the previous 24%. The preview and farm renderer use the same timing constants.

## Transaction rendering

Scene-owned animation frames are cached across purchases, sales and herd changes. Land animals and poultry share one frame bank; pond frames are reused at each pond size. Static texture keys no longer depend on herd count; animated texture keys include species to prevent reused indices displaying the previous animal. Land motion reads the latest snapshot records, including fed age. Regression tests cover repeated herd rebuilds without allocating more canvases.

### Herd updates without rebuilding scenery

Buying, selling and collecting animals now replace only motion surfaces. Fixed scenery and crop surfaces retain their object references; a complete scenery rebuild is reserved for enclosure/capacity changes and changes to which poultry egg baskets are present. All motion uses a scene-owned start clock so herd updates do not restart roaming phases. Snapshot polling redraws the portrait only after outfit changes and refreshes collision geometry only when enclosure levels change.

Regression coverage executes herd addition/removal while asserting zero additional canvas allocations and unchanged fixed/crop surfaces. Browser verification collected 54 ready animals in the non-persistent storage review farm without JavaScript errors. Checks and build pass; artwork approval remains pending.
