import { performance } from 'node:perf_hooks';
import { COSMETIC_CATALOG } from '../../packages/character-core/dist/cosmetic-catalog.js';
import { createCosmeticIndex } from '../../packages/character-core/dist/cosmetic-index.js';

// Informational local metadata benchmark, not an API/DB/renderer load test.
for (const size of [10_000, 100_000]) {
  const catalog = {};
  for (let i = 0; i < size; i++) {
    const id = `item/test.${String(i).padStart(6, '0')}`;
    catalog[id] = { id, kind: 'item', category: 'appearance', slot: 'hair', groupId: `item/family.${Math.floor(i / 10)}`, itemId: `test.${i}`, label: `Test ${i}` };
  }
  const start = performance.now();
  const index = createCosmeticIndex(catalog);
  const built = performance.now();
  let found = 0;
  for (let i = 0; i < 1_000; i++) found += index.select({ slot: 'hair', groupId: `item/family.${i}` }).length;
  const queried = performance.now();
  console.log(JSON.stringify({ entries: size, buildMs: +(built - start).toFixed(2), groupQueries: 1000, groupQueryMs: +(queried - built).toFixed(2), matches: found }));
}
console.log(JSON.stringify({ actualCatalogEntries: Object.keys(COSMETIC_CATALOG).length }));
