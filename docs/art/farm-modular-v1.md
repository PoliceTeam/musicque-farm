# Farm modular assets v1

Status: prototype assets, pending visual approval. Generated with the built-in image generation tool on 2026-10-10.

The runtime uses independent grass/path textures, soil patches, trees, buildings, and a hen house. Fences and pond edges are repeated modules; pond water is a separate surface. The former complete panorama is not imported by the farm renderer.

## Source prompts

### soil

Output: apps/game/src/assets/farm/modular/soil-v1.png

Single isolated game sprite: one 2D TOP-DOWN farming soil patch, 4:3 rectangle with organic soft ragged edge, natural loose rich brown earth and small dirt clods, no stone, no bevel, no thick border, no raised platform. Dry uncultivated ground ready to hoe, subtle cracks. High quality detailed warm hand-painted chibi farming game art, readable small scale. Subject occupies middle 75% of canvas. No grass surroundings, no text, no shadow outside dirt, genuinely transparent background.

### tree

Output: apps/game/src/assets/farm/modular/tree-v1.png

Single isolated mature leafy tree game sprite for colorful 2D chibi farming gameplay. Elevated front/topdown view, NOT isometric. Rounded lush green foliage with fine painterly leaf clusters, visible short brown trunk at bottom, soft small ground shadow. Detailed cozy game illustration, bright sunny greens, slim dark outlines, readable at 90px height. No ground tile, no scenery, no text. Whole tree centered with generous transparent margin, genuinely transparent background.

### store

Output: apps/game/src/assets/farm/modular/store-v1.png

Single isolated rustic farm storehouse building game sprite, elevated frontal/top-down view NOT isometric. Charming wooden timber storehouse, teal corrugated roof, front door and small window, baskets and hay beside entrance. High quality detailed colorful painted chibi farming game art, slim warm outlines, sunlight. No people, no sign text, no land or grass, no surrounding fence or trees. Entire standalone building with small ground shadow, centered and generous margins, genuinely transparent background.

### coop

Output: apps/game/src/assets/farm/modular/coop-v1.png

Single isolated small wooden chicken coop building game sprite, elevated frontal/top-down view NOT isometric. Cozy timber hen house with teal roof, small dark hatch and wooden ramp, little nesting sidebox. Detailed colorful painted chibi farming game art matching rustic teal-roof wooden storehouse and lush painted greenery. No animals, no fence, no grass or background ground, no text. Entire building and ramp centered, generous transparent margins, genuinely transparent background.

### grass

Output: apps/game/src/assets/farm/modular/grass-v1.png

A single seamlessly TILEABLE top-down grass ground texture for a lush cozy 2D chibi farming game. Entire image filled edge to edge with warm medium green grass, fine hand-painted clusters of short blades and subtle mottled greens; small scale consistent evenly lit surface. NO flowers, no trees, no rocks, no roads, no perspective, no border, no vignette, no shadow, no blank margins. Seamless edges in both axes, organic subtle detail, not photorealistic, not a map. Bright palette matched to classic painted farming game, clear at 96x96 game tile.

### path

Output: apps/game/src/assets/farm/modular/path-v1.png

A single seamlessly TILEABLE top-down warm sandy dirt road ground texture for a cozy 2D chibi farming game. Entire image filled edge to edge with pale golden tan packed dirt, subtly mottled painterly warm dust, occasional tiny earth grains. NO grass, no stones larger than a dot, no roads drawn through scene, no object, no perspective, no border, no vignette, no lighting gradient, no margins. Seamless edges both axes, even bright sunny colors, readable at 96x96 game tile.

## Expansion verification

Default units start at level 0. `farm.html?layout=expanded` previews level 2 footprints for QA. This preview does not implement purchasing or paid upgrades. Rendering, hit testing, pathfinding and collision use the same unit bounds. Store and barn remain fixed while the pen and pond grow in reserved space.

