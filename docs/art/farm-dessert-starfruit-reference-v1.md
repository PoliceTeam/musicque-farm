# Dessert and starfruit reference v1

Runtime migration: committed assets now use organized lossless WebP folders. Source slicing scripts write intermediate PNGs to `tools/.farm-export/`; regenerate the selected runtime set with `python3 tools/build-farm-assets.py`. See [current asset structure](../farm-assets.md). The versioned paths below describe the original integration history.

User supplied three transparent reference sheets on 2026-10-12:

- `farm-dessert-reference-v1.png`: five columns of dessert variants. The first variant in each column is used for starfruit yogurt, fruit milk tea, sweet soup, peach tea and fried ice cream.
- `farm-starfruit-tree-reference-v1.png`: four stages, from sapling through flowers, green fruit and ripe yellow fruit.
- `farm-starfruit-reference-v1.png`: the fourth fruit illustration is used for the inventory, seed selectors and yogurt ingredient list.

Run `python3 tools/export-farm-v23-reference.py` and `node tools/runtime/prepare-assets.mjs` from the repository root. The saved bounds are in `tools/farm-v23-reference-slices.json`. Alpha threshold and largest connected component remove faint reference-sheet decoration; images retain their supplied shape and palette. Runtime filenames use a v23 prefix to avoid collisions with older artwork.

All 22 existing recipes now have user-supplied raster artwork. Recipe ingredients, cooking times and sell prices remain unchanged. The other four special ingredients (lychee, peach, cream, fruit plate) still have no production source; adding their artwork does not make those recipes cookable.

Starfruit is now a plantable crop. Initial balance matches mango: 10 coins per seed, 24 hours after watering, 360 fruit per harvest and 1 coin per fruit when explicitly sold. It uses existing crop commands, save parsing, storage and kitchen ingredient consumption. The four visual stages map to three growing frames and one ripe frame. Starfruit yogurt needs 96 harvested fruit plus 72 milk.

There are now 20 selectable crops, including strawberry with the supplied v21 growth artwork. All selectable crops have imagery; dragon fruit continues to use the previous cactus growth artwork and the newer fruit icon. All nine available animal species, including the newly enabled dog, have artwork.

Status: integrated for review; user visual approval pending.
