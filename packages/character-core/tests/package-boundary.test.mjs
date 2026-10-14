import assert from 'node:assert/strict';
import test from 'node:test';
import { Action, AvatarState } from '@chibi-town/character-core/animation-logic';
import { items } from '@chibi-town/character-core/item-catalog';
import { loadItems } from '@chibi-town/character-core/item-loader';
import { gokuOutfit, sanitizeOutfit, toEquip } from '@chibi-town/character-core/outfit-logic';

test('public exports load real outfit data in Node without a renderer', () => {
  const equip = toEquip(sanitizeOutfit(gokuOutfit));
  assert.ok(equip.some(({ item }) => item === 'shirt.goku'));
  assert.ok(equip.some(({ item }) => item === 'hand.grip'));
  for (const { item } of equip) assert.ok(items[item], item);
  assert.equal(typeof globalThis.document, 'undefined');
});

test('animation instances retain independent state through public exports', () => {
  const first = new AvatarState(toEquip(gokuOutfit), () => 0);
  const second = new AvatarState(toEquip(gokuOutfit), () => 0);
  first.setAction(Action.Walk);
  first.step();
  assert.equal(first.pose, 2);
  assert.equal(second.pose, 0);
  assert.equal(second.tick, 0);
});

test('metadata works alone while app sprite validation still rejects missing pieces', () => {
  const raw = { items: [{ id: 'example', label: 'Example', slot: 'hair', layer: 1, poses: { 0: ['missing', 0, 0] } }] };
  assert.equal(loadItems(raw).example.poses.length, 15);
  assert.throws(() => loadItems(raw, { pieces: {}, palette: {} }), /missing piece/);
});
