# Entertainment street

The first playable street is `/play/fun/entertainment-street`, reachable from the world map's entertainment region. It uses the user's three supplied atlases (v3 supplies the main scene; v1 supplies the separate wheel parts) saved under `docs/art/entertainment/`.

The map has six storefronts (ATM, arcade, event hall, auction, prize wheel, pet racing), a central billboard, trees, flower borders, utility poles and lamps. Clicking buildings opens an informational dialog; games, purchases, auctions and racing services are not implemented in this scene yet.

Movement uses the existing location renderer and collision logic. Shop fronts, the road, billboard feet and lamp bases are blocked. Spawn is on the central pedestrian pavement. Canvas submission order uses foot depth, so the avatar can pass in front of and behind street furniture.

`tools/entertainment/export-assets.py` slices the preserved original RGBA art into lossless WebP; run it from the repository root with Pillow. `tools/entertainment/assets.json` records each selected source rectangle. Runtime assets live in `apps/game/src/assets/entertainment/`. Only selected assets are exported; `tools/runtime/prepare-assets.mjs` generates Next static imports with content-hashed URLs, resolved through the map resource loader.

The wheel uses native surface rotation around its center, sharing a single texture across frames. Its pointer stays fixed. Static placements share textures by asset key. Opening a storefront dialog does not recreate the scene. Existing map resource ownership/cleanup applies on navigation.

Ground is baked once from stone-interior texture samples from three paving crops, clipped into staggered cobbles to avoid repeating the entire tile. Yellow entrance hints share the farm's exact drawing helper and are clickable. Baked source signs replace floating white storefront labels. The complete v1 disc is clipped to its circular silhouette, numbered once, and rotates behind the fixed wooden plinth and v3 booth roof. Thin crop intrusions above roofs are excluded; tree exports retain the primary connected silhouette with a one-pixel antialias margin. Camera zoom fits the map on landscape screens; vertical framing is fixed, with horizontal following on narrow screens. The source skyline and utility meter keep their proportions through one-time canvas composition. The supplied artwork is not a verified seamless tileset; this is a repeatable cropped texture for the first layout. Sources have real alpha but predominantly partial opacity, retained during export. Visual checks should include a light and dark background when adding further source rectangles.


## Visual cleanup and atmosphere

Disconnected atlas fragments are removed from the tree, evergreen, shrub, cloud, hall and racing silhouettes. The shrub rectangle includes the full plant rather than a cut-off neighbouring clump. Run `python3 tools/entertainment/validate-assets.py` to check the five concrete crop regressions reported in screenshots (paving beside the evergreen, leaf beside the hall, fragment above racing, skyline beneath cloud, and roof edge under shrub).

A generated continuous cable run replaces the cropped cable segments that contained incomplete posts. A low garden strip covers the skyline edge beneath the shops. These are baked once in the location view alongside the pavement and contact-shadow canvas; they are not re-created per animation frame.

The entertainment scene opts into linear sampling for raster surfaces. Pixel avatars keep their original texture sampling, and other scenes keep their prior default. Surface texture creation is tested over repeated rotation frames. Clouds drift gently; contact shadows ground the buildings, vegetation and player. Ground has less uniform corners and fewer bright edge highlights.


## Cable detail and billboard supports

The continuous cable span now uses the original atlas cable cross-section and clamp images (`cable-profile`, `cable-clamp`), preserving their material detail without retaining cut-off pole pieces. The upper post cap also uses its source artwork. Cable composition happens only when the scene loads.

Billboard source slicing has padding on all sides and a regression check for the support outline touching the crop boundary. Its two outer lower support pieces are assembled ten source pixels lower, extending their original shaft texture so all five feet meet the same ground line. The poster image is untouched. Each foot has an individual contact shadow at its own source anchor; the former whole-panel shadow is removed.
