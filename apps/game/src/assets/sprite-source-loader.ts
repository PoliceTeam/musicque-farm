import type { SpriteSheet } from '@chibi-town/character-core/sprite-types';
import { mergeSheets, parseSprites } from '@/assets/sprite-parser';

export type SpriteSources = Record<string, string>;

/** Separate palette namespaces; a pet letter may have a different color from a character letter. */
export function loadSpriteSources(sources: SpriteSources) {
  const groups: Record<'character' | 'pets' | 'scenery', [string, string][]> = {
    character: [],
    pets: [],
    scenery: [],
  };
  for (const path of Object.keys(sources).sort()) {
    const relative = path.replace(/^\.\/sprites\//, '');
    const group = relative.startsWith('pets/') ? 'pets' : relative.startsWith('scenery/') ? 'scenery' : 'character';
    groups[group].push([path, sources[path]]);
  }

  function load(entries: [string, string][]): SpriteSheet {
    const palettes = entries.filter(([, text]) => !/^@piece /m.test(text));
    const pieces = entries.filter(([, text]) => /^@piece /m.test(text));
    const shared = mergeSheets(...palettes.map(([path, text]) => parseSprites(text, path)));
    return mergeSheets(shared, ...pieces.map(([path, text]) => parseSprites(text, path, shared.palette)));
  }

  return { character: load(groups.character), pets: load(groups.pets), scenery: load(groups.scenery) };
}
