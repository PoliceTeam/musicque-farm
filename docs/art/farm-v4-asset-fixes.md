# Farm asset corrections — 2026-10-10

The user rejected `cow-1` for its duplicated head. The initial contact-sheet review missed the anatomy error. Built-in ImageGen was used to replace that sprite using the healthy `cow-2` as a reference, and to derive an empty basket from the existing full basket. The generated sources are saved as `farm-v4-cow-repaired.png` and `farm-v4-basket-empty.png` beside this document. This is new derivative artwork, pending user approval.

Export configuration: `tools/farm-v4-slices.json`, `overrides`. The exporter trims alpha margins and scales proportionally to game size. Both corrected objects were inspected in the contact sheet and at native size plus 3× enlargement. The archive now includes 53 PNGs. `egg-basket-empty` is the visual state for zero eggs; `egg-basket` is the visual state for a positive count. These conditions are recorded in the manifest, but livestock gameplay and runtime basket selection have not been implemented.

## Cow prompt

Use case: precise-object-edit. Create a corrected single farm cow sprite matching this reference's colorful small chibi game style. One brown and white cow, exactly ONE head on the RIGHT side, one muzzle, two ears, two horns, four legs, one tail at the LEFT rear. No second face or head anywhere. Standing idle pose, three-quarter side view facing right. Preserve brown-white patches, rounded proportions, dark clean outline, cute eyes, softly painted shading. Entire isolated animal only, transparent alpha background, no grass, no floor, no text, no shadow outside sprite. Canvas 1024x1024, animal fills about 80% canvas width with generous transparent margin. Asset will be downsampled to about 55px wide; keep coherent readable shapes.

## Empty basket prompt

Use case: precise-object-edit. Edit this farm game wicker egg basket sprite into its EMPTY state. Remove ALL eggs, keep exactly the same brown woven basket silhouette, handles, perspective, dark outline and warm chibi painted shading. Show the empty woven inner bottom and inner walls inside the open rim. There must be zero eggs, zero white oval objects and no straw covering the opening. Single isolated basket, centered, transparent alpha background, no ground, no text, no decorative additions. Canvas 1024x1024 with basket about 80% canvas width. It will be used as the matching empty state for the reference full basket.
