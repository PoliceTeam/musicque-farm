# Entertainment source atlases

User supplied the first two atlases for combined use on 2026-10-12. Preserve these original files as source references.

Both are 1536×1024 RGBA with real transparency (alpha range 0–254). Alpha, edge halos and asset boundaries still need inspection when exporting; these are not validated runtime assets or seamless tilesets.

Suggested selection:
- v1: separated prize-wheel disc, pointer, canopy and base; rectangular sky panels.
- v2: ATM, detached billboard advertisement, skyline and cloud cutouts.
- Either: choose one consistent set of buildings, trees, street furniture and ground pieces instead of overlapping duplicate variants.

Before runtime integration: slice objects with deterministic coordinates, validate the wheel circle/anchor, test repeating ground patches, inspect edges on light and dark backgrounds, then export WebP using the project asset conventions. Do not treat user-supplied tile drawings as verified 64×64 seamless tiles.

On 2026-10-12 the user supplied `entertainment-atlas-v3.png` and requested a closer assembly matching the reference street. It is the primary runtime source for the six storefronts, billboard and landscaping. Keep v1 for the complete separate disc, pointer and wooden support. v3 also has RGBA alpha range 0–254. The partial disc baked above its booth is excluded by cropping the booth at its canopy. Runtime exports remove obsolete variants; preserve all original source atlases.

Crop review: disconnected neighbouring fragments are removed for selected silhouettes, with one-pixel edge padding. The shrub crop was expanded to include its complete shape. The partial utility-wire image is retired from runtime; original source atlases remain preserved. Screenshot regression checks live in `tools/entertainment/validate-assets.py`.
