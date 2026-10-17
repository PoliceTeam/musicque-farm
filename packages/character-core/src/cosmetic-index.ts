import {
  COSMETIC_CATALOG,
  type CosmeticCategory,
  type CosmeticDefinition,
  type CosmeticId,
} from './cosmetic-catalog.js';

type Entry = Readonly<CosmeticDefinition>;
type Filters = { category?: CosmeticCategory; slot?: string; groupId?: string };
const compare = new Intl.Collator('en').compare;

/** Immutable catalog metadata only. Never cache a player's ownership, wallet or purchase permissions. */
export function createCosmeticIndex(catalog: Readonly<Record<CosmeticId, Entry>>) {
  const all = Object.freeze(Object.values(catalog).sort((a, b) => compare(a.id, b.id)));
  const categories = new Map<string, Entry[]>();
  const slots = new Map<string, Entry[]>();
  const groups = new Map<string, Entry[]>();

  function add(index: Map<string, Entry[]>, key: string, entry: Entry) {
    const bucket = index.get(key);
    if (bucket) bucket.push(entry);
    else index.set(key, [entry]);
  }

  for (const entry of all) {
    add(categories, entry.category, entry);
    add(groups, entry.groupId, entry);
    if ('slot' in entry) add(slots, entry.slot, entry);
  }
  for (const index of [categories, slots, groups]) for (const bucket of index.values()) Object.freeze(bucket);
  return Object.freeze({
    hasSlot: (slot: string) => slots.has(slot),

    select(filters: Filters): readonly Entry[] {
      let candidates: readonly Entry[] = all;
      for (const [key, index] of [
        [filters.category, categories],
        [filters.slot, slots],
        [filters.groupId, groups],
      ] as const) {
        if (key === undefined) continue;
        const bucket = index.get(key) ?? [];
        if (bucket.length < candidates.length) candidates = bucket;
      }
      return candidates.filter(
        (entry) =>
          (!filters.category || entry.category === filters.category) &&
          (!filters.slot || ('slot' in entry && entry.slot === filters.slot)) &&
          (!filters.groupId || entry.groupId === filters.groupId),
      );
    },
  });
}

export const COSMETIC_INDEX = createCosmeticIndex(COSMETIC_CATALOG);
