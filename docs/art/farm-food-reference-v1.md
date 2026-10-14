# Food reference integration

Runtime migration: committed assets now use organized lossless WebP folders. Source slicing scripts write intermediate PNGs to `tools/.farm-export/`; regenerate the selected runtime set with `python3 tools/build-farm-assets.py`. See [current asset structure](../farm-assets.md). The versioned paths below describe the original integration history.

The user supplied this recipe sheet and requested illustrated selectors. Source: `farm-food-reference-v1.png`; slice bounds: `tools/farm-v22-food-slices.json`; regenerate with `python3 tools/export-farm-v22-food.py` (Pillow required). The exporter keeps the dish component, removes faint coloured halos, labels, arrows and neighbouring utensils, and writes `extracted-v22` artwork.

Seventeen matching recipes now use the reference pictures in the kitchen and warehouse. The five recipes absent from this sheet now use the additional dessert reference; see `farm-dessert-starfruit-reference-v1.md`. Recipe quantities and cooking rules are unchanged. Kitchen ingredients use the shared product pictures, including a new beef icon.

Animal, crop and recipe choices share `FarmPictureSelect`, a select-only combobox with illustrations in the selected item and menu, labels, selected state, scrolling, arrow keys, Home/End, Enter/Space, Escape and outside-click dismissal. Artwork remains pending approval of the integrated result.
