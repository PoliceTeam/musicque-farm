import { itemDefinitions, pets } from '@chibi-town/character-core/item-catalog';
import { loadItems } from '@chibi-town/character-core/item-loader';
// Build preparation discovers source groups for both Next.js and tests.
import { spriteSources as sources } from '@/assets/generated-sprite-sources';
import { loadSpriteSources } from '@/assets/sprite-source-loader';
export const { character: sheet, pets: petSheet, scenery: scenerySheet } = loadSpriteSources(sources);
// Validate sprite dimensions, animation frames and pose references at app startup.
loadItems(itemDefinitions, sheet);
for (const pet of Object.values(pets)) {
  for (const piece of [pet.piece, ...(pet.walk ?? []), ...(pet.flap ?? [])]) {
    if (!petSheet.pieces[piece]) throw new Error(`pet "${pet.id}": missing piece "${piece}"`);
  }
}
