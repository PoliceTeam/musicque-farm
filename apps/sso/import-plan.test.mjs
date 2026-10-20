import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planImport } from './import-plan.mjs';

const farm = { app: 'farm', id: 'f1', username: 'alice' };
const musicque = { app: 'musicque', id: 'm1', username: 'alice' };
const existing = { id: 'kc1', username: 'alice', attributes: { musicqueUserId: ['m1'] } };

test('single-source import and rerun preserve the same subject', () => {
  assert.equal(planImport([musicque]).entries.length, 1);
  assert.equal(planImport([farm]).entries.length, 1);
  assert.equal(planImport([musicque], {}, [existing]).entries[0].existing.id, 'kc1');
  assert.equal(planImport([{ ...farm, linked: true }]).entries.length, 0);
});

test('cross-source collisions require a valid explicit merge or rename', () => {
  assert.equal(planImport([farm, musicque]).collisions.length, 1);
  assert.equal(planImport([farm, musicque], { alice: 'merge:typo' }).collisions.length, 1);
  assert.equal(planImport([farm, musicque], { alice: 'merge:musicque' }).entries[0].passwordFrom, musicque);
  assert.deepEqual(
    planImport([farm, musicque], { alice: 'rename-farm:alice_farm' }).entries.map((item) => item.username),
    ['alice', 'alice_farm'],
  );
});

test('later Farm import reports the existing Musicque subject; never merges silently', () => {
  const plan = planImport([farm], {}, [existing]);
  assert.equal(plan.entries.length, 0);
  assert.equal(plan.collisions[0].keycloakId, 'kc1');
  assert.equal(planImport([farm], { alice: 'merge-keycloak:kc1' }, [existing]).entries[0].existing, existing);
  assert.equal(planImport([farm], { alice: 'merge-keycloak:wrong' }, [existing]).collisions.length, 1);
  assert.equal(planImport([farm], { alice: 'rename-farm:alice_farm' }, [existing]).entries[0].username, 'alice_farm');
});

test('rejects duplicate renamed targets, invalid names and overwriting an app ownership link', () => {
  assert.equal(
    planImport([farm, { ...farm, id: 'f2', username: 'bob' }], { alice: 'rename-farm:bob' }).collisions.length,
    2,
  );
  assert.equal(planImport([farm], { alice: 'rename-farm:x' }).collisions.length, 1);
  assert.equal(
    planImport([farm], { alice: 'merge-keycloak:kc1' }, [{ ...existing, attributes: { farmUserId: ['other'] } }])
      .collisions.length,
    1,
  );
});
