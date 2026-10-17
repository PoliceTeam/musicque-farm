import assert from 'node:assert/strict';
import test from 'node:test';
import { COSMETIC_CATALOG, COSMETIC_COLOR_IDS } from '@chibi-town/character-core/cosmetic-catalog';
import { colors, items, pets } from '@chibi-town/character-core/item-catalog';

test('every public wearable and every exact pet level has an acquisition ID', () => {
  for (const item of Object.values(items)) {
    const entry = COSMETIC_CATALOG[`item/${item.id}`];
    if (item.hidden || item.slot === 'body') assert.equal(entry, undefined, item.id);
    else {
      assert.equal(entry.itemId, item.id);
      assert.equal(entry.gender, item.gender);
      assert.equal(entry.level, item.level);
    }
  }
  for (const pet of Object.values(pets)) assert.equal(COSMETIC_CATALOG[`pet/${pet.id}`].petId, pet.id);
});

test('every renderer palette has stable unique IDs and colors belong to the exact item', () => {
  for (const [group, palette] of Object.entries(colors)) {
    const ids = Object.values(COSMETIC_COLOR_IDS[group]);
    assert.equal(new Set(ids).size, ids.length, group);
    for (const value of Object.keys(palette)) assert.ok(COSMETIC_COLOR_IDS[group][value], `${group}/${value}`);
  }
  for (const item of Object.values(items).filter((item) => !item.hidden && item.slot !== 'body')) {
    for (const [value, colorId] of Object.entries(COSMETIC_COLOR_IDS[item.slot] ?? {})) {
      const entry = COSMETIC_CATALOG[`item-color/${item.id}/${colorId}`];
      assert.equal(entry.requires, `item/${item.id}`);
      assert.equal(entry.colorValue, value);
    }
  }
  assert.notEqual(COSMETIC_CATALOG['item-color/shirt.tank/red'].id, COSMETIC_CATALOG['item-color/shirt.goku/red'].id);
  assert.notEqual(COSMETIC_CATALOG['pet/cat'].id, COSMETIC_CATALOG['pet/cat.2'].id);
});

test('catalog and entries are immutable and do not grant ownership or publish prices', () => {
  assert.ok(Object.isFrozen(COSMETIC_CATALOG));
  for (const entry of Object.values(COSMETIC_CATALOG)) {
    assert.ok(Object.isFrozen(entry));
    assert.equal(entry.price, undefined);
    assert.equal(entry.owned, undefined);
  }
});

test('all unlocks belong to one business category and grouped cards keep exact ownership IDs', async () => {
  const { COSMETIC_GROUPS, cosmeticCategoryForSlot } = await import('@chibi-town/character-core/cosmetic-catalog');
  const ids = [];
  for (const group of Object.values(COSMETIC_GROUPS)) {
    assert.ok(Object.isFrozen(group));
    assert.ok(Object.isFrozen(group.members));
    assert.ok(Object.isFrozen(group.colors));
    for (const id of [...group.members, ...group.colors]) {
      const entry = COSMETIC_CATALOG[id];
      assert.equal(entry.groupId, group.id);
      assert.equal(entry.category, group.category);
      ids.push(id);
    }
  }
  assert.deepEqual(ids.sort(), Object.keys(COSMETIC_CATALOG).sort());
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(COSMETIC_GROUPS['item/wings.angel'].members.includes('item/wings.angel.1'));
  assert.ok(COSMETIC_GROUPS['item/wings.angel'].members.includes('item/wings.angel.6'));
  assert.ok(COSMETIC_GROUPS['item/hair.goku'].colors.includes('item-color/hair.goku.2/red'));
  assert.deepEqual(COSMETIC_GROUPS['pet/cat'].members, ['pet/cat', 'pet/cat.2', 'pet/cat.3']);
  assert.equal(COSMETIC_GROUPS['item/shirt.tank'].category, 'equipment');
  assert.equal(COSMETIC_GROUPS['item/hair.mop'].category, 'appearance');
  assert.equal(COSMETIC_GROUPS['pet/cat'].category, 'pet');
  assert.throws(() => cosmeticCategoryForSlot('new-unclassified-slot'), /Unclassified/);
});

test('catalog index preserves ordering, intersects filters and safely rejects unknown buckets', async () => {
  const { COSMETIC_INDEX } = await import('@chibi-town/character-core/cosmetic-index');
  const compare = new Intl.Collator('en').compare;
  for (const filters of [
    {},
    { slot: 'hair' },
    { groupId: 'item/hair.goku' },
    { category: 'pet' },
    { slot: 'hair', category: 'equipment' },
    { groupId: '__proto__' },
  ]) {
    const expected = Object.values(COSMETIC_CATALOG)
      .filter(
        (entry) =>
          (!filters.category || entry.category === filters.category) &&
          (!filters.slot || ('slot' in entry && entry.slot === filters.slot)) &&
          (!filters.groupId || entry.groupId === filters.groupId),
      )
      .sort((a, b) => compare(a.id, b.id));
    assert.deepEqual(COSMETIC_INDEX.select(filters), expected);
  }
  assert.equal(COSMETIC_INDEX.hasSlot('hair'), true);
  assert.equal(COSMETIC_INDEX.hasSlot('__proto__'), false);
});

test('a group query inspects its small bucket instead of every entry in a large catalog', async () => {
  const { createCosmeticIndex } = await import('@chibi-town/character-core/cosmetic-index');
  let reads = 0;
  const catalog = {};
  for (let i = 0; i < 20_000; i++) {
    const entry = {
      id: `item/test.${i}`,
      kind: 'item',
      category: 'appearance',
      itemId: `test.${i}`,
      slot: 'hair',
      label: `Test ${i}`,
    };
    Object.defineProperty(entry, 'groupId', {
      get() {
        reads++;
        return `item/family.${Math.floor(i / 10)}`;
      },
    });
    catalog[entry.id] = entry;
  }
  const index = createCosmeticIndex(catalog);
  reads = 0;
  const result = index.select({ slot: 'hair', groupId: 'item/family.1234' });
  assert.equal(result.length, 10);
  assert.equal(reads, 10);
  result.pop();
  assert.equal(index.select({ groupId: 'item/family.1234' }).length, 10);
});
