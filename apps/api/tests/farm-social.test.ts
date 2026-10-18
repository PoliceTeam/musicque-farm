import { randomUUID } from 'node:crypto';
import { FARM_CROPS } from '@chibi-town/game-content/farm-catalog';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { playerDocuments } from '@/infrastructure/database/schema';
import { createTestApp } from './test-app.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeEach(async () => {
  t = await createTestApp();
});
afterEach(() => t.close());

async function friends(a: { cookie: string; player: { id: string } }, b: { cookie: string; player: { id: string } }) {
  for (const [self, target, action] of [
    [a, b, 'request'],
    [b, a, 'accept'],
  ] as const) {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/social/friends',
      headers: { cookie: self.cookie },
      payload: { targetId: target.player.id, action },
    });
    expect(response.statusCode).toBe(200);
  }
}

async function ripe(id: string) {
  const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, id));
  const wateredAt = t.clock() - FARM_CROPS.tomato.growMs;
  row.document.farm.plots[0] = { stage: 'growing', cropId: 'tomato', wateredAt };
  await t.db.update(playerDocuments).set({ document: row.document }).where(eq(playerDocuments.playerId, id));
  return wateredAt;
}

it('requires friendship and authentication, and hides private farm data', async () => {
  const a = await t.register('farm_a');
  const b = await t.register('farm_b');
  const sdk = t.sdkFor(a.cookie);
  await expect(sdk.getFarmVisit(b.player.id)).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  await friends(a, b);
  const visit = await sdk.getFarmVisit(b.player.id);
  expect(visit.owner.id).toBe(b.player.id);
  expect(visit.owner).not.toHaveProperty('stats');
  expect(visit.snapshot.farm.coins).toBe(0);
  expect(visit.snapshot.farm.inventory).toEqual({ strawberry: 0, seed: 0 });
  expect(visit.snapshot).not.toHaveProperty('requests');
  expect((await t.app.inject({ url: `/api/farms/${b.player.id}` })).statusCode).toBe(401);
  await expect(sdk.getFarmVisit(a.player.id)).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
  await expect(sdk.getFarmVisit('bad')).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
});

it('transfers one crop once per growth cycle, preserves owner harvest, and records private history', async () => {
  const a = await t.register('steal_a');
  const b = await t.register('steal_b');
  await friends(a, b);
  const wateredAt = await ripe(b.player.id);
  const sdk = t.sdkFor(a.cookie);
  const command = { ownerId: b.player.id, index: 0, wateredAt, requestId: randomUUID() };
  const results = await Promise.all([sdk.stealFarmCrop(command), sdk.stealFarmCrop(command)]);
  expect(results.every((result) => result.snapshot.farm.plots[0].stolen)).toBe(true);
  expect((await sdk.getInventory()).farm.inventory.tomato).toBe(1);
  await expect(sdk.stealFarmCrop({ ...command, requestId: randomUUID() })).rejects.toMatchObject({
    code: 'NOT_ALLOWED',
  });
  await expect(sdk.stealFarmCrop({ ...command, index: 1 })).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
  const history = await t.sdkFor(b.cookie).getFarmTheftHistory();
  expect(history).toEqual([
    { visitorId: a.player.id, visitorName: a.player.name, cropId: 'tomato', index: 0, at: t.clock() },
  ]);
  expect(await sdk.getFarmTheftHistory()).toEqual([]);
  const snapshot = await t
    .sdkFor(b.cookie)
    .execute({ type: 'plot', action: 'harvest', index: 0, requestId: randomUUID(), mapInstanceId: 'home' });
  expect(snapshot.farm.inventory.tomato).toBe(FARM_CROPS.tomato.yield - 1);
  expect(snapshot.farm.plots[0].stolen).toBeUndefined();
});

it('rejects unripe or stale crops, full inventory, and revoked friendship without transfers', async () => {
  const a = await t.register('guard_a');
  const b = await t.register('guard_b');
  await friends(a, b);
  const sdk = t.sdkFor(a.cookie);
  const wateredAt = await ripe(b.player.id);
  const command = { ownerId: b.player.id, index: 0, wateredAt: wateredAt + 1, requestId: randomUUID() };
  await expect(sdk.stealFarmCrop(command)).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  await expect(sdk.stealFarmCrop({ ...command, index: 1 })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, a.player.id));
  Object.assign(
    row.document.farm.inventory,
    Object.fromEntries(
      Object.keys(FARM_CROPS)
        .filter((id) => id !== 'tomato')
        .slice(0, 12)
        .map((id) => [id, 1]),
    ),
  );
  await t.db.update(playerDocuments).set({ document: row.document }).where(eq(playerDocuments.playerId, a.player.id));
  await expect(sdk.stealFarmCrop({ ...command, wateredAt })).rejects.toMatchObject({ code: 'INVENTORY_FULL' });
  expect((await t.sdkFor(b.cookie).getInventory()).farm.plots[0].stolen).toBeUndefined();
  await t.app.inject({
    method: 'POST',
    url: '/api/social/friends',
    headers: { cookie: a.cookie },
    payload: { targetId: b.player.id, action: 'remove' },
  });
  await expect(sdk.getFarmVisit(b.player.id)).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  await expect(sdk.stealFarmCrop({ ...command, wateredAt })).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  expect(await t.sdkFor(b.cookie).getFarmTheftHistory()).toEqual([]);
});

it('takes only ripe produce on the field and never goods from either owner warehouse', async () => {
  const guest = await t.register('field_guest');
  const owner = await t.register('field_owner');
  await friends(guest, owner);
  const [row] = await t.db.select().from(playerDocuments).where(eq(playerDocuments.playerId, owner.player.id));
  row.document.farm.inventory.tomato = 42;
  row.document.farm.homeInventory.tomato = 17;
  row.document.farm.plots[0] = { stage: 'growing', cropId: 'tomato', wateredAt: t.clock() };
  await t.db
    .update(playerDocuments)
    .set({ document: row.document })
    .where(eq(playerDocuments.playerId, owner.player.id));
  // Read through the normal save migration, which merges the legacy home chest into the main chest.
  const before = (await t.sdkFor(owner.cookie).getInventory()).farm;
  const sdk = t.sdkFor(guest.cookie);
  const command = { ownerId: owner.player.id, index: 0, wateredAt: t.clock(), requestId: randomUUID() };
  await expect(sdk.stealFarmCrop(command)).rejects.toMatchObject({ code: 'NOT_ALLOWED' });
  expect((await sdk.getInventory()).farm.inventory.tomato ?? 0).toBe(0);
  t.advance(FARM_CROPS.tomato.growMs);
  await sdk.stealFarmCrop(command);
  expect((await sdk.getInventory()).farm.inventory.tomato).toBe(1);
  const after = (await t.sdkFor(owner.cookie).getInventory()).farm;
  expect(after.inventory).toEqual(before.inventory);
  expect(after.homeInventory).toEqual(before.homeInventory);
  expect(after.plots[0].stolen).toBe(true);
  const visit = await sdk.getFarmVisit(owner.player.id);
  expect(visit.snapshot.farm.inventory.tomato).toBeUndefined();
  expect(visit.snapshot.farm.homeInventory).toEqual({});
});

it('allows only one of two different friends to steal the same crop concurrently', async () => {
  const owner = await t.register('race_owner');
  const first = await t.register('race_first');
  const second = await t.register('race_second');
  await friends(first, owner);
  await friends(second, owner);
  const wateredAt = await ripe(owner.player.id);
  const results = await Promise.allSettled(
    [first, second].map((friend) =>
      t.sdkFor(friend.cookie).stealFarmCrop({ ownerId: owner.player.id, index: 0, wateredAt, requestId: randomUUID() }),
    ),
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  const inventories = await Promise.all([first, second].map((friend) => t.sdkFor(friend.cookie).getInventory()));
  expect(inventories.reduce((total, snapshot) => total + (snapshot.farm.inventory.tomato ?? 0), 0)).toBe(1);
  expect(await t.sdkFor(owner.cookie).getFarmTheftHistory()).toHaveLength(1);
});

it('rejects a stale visit after replanting and permits one theft in the new crop cycle', async () => {
  const owner = await t.register('cycle_owner');
  const guest = await t.register('cycle_guest');
  await friends(guest, owner);
  const wateredAt = await ripe(owner.player.id);
  const sdk = t.sdkFor(guest.cookie);
  const command = { ownerId: owner.player.id, index: 0, wateredAt, requestId: randomUUID() };
  await sdk.stealFarmCrop(command);
  const ownerSdk = t.sdkFor(owner.cookie);
  await ownerSdk.execute({ type: 'plot', action: 'harvest', index: 0, mapInstanceId: 'home', requestId: randomUUID() });
  await ownerSdk.execute({
    type: 'plot',
    action: 'sow',
    cropId: 'tomato',
    index: 0,
    mapInstanceId: 'home',
    requestId: randomUUID(),
  });
  await ownerSdk.execute({ type: 'plot', action: 'water', index: 0, mapInstanceId: 'home', requestId: randomUUID() });
  const nextWateredAt = t.clock();
  t.advance(FARM_CROPS.tomato.growMs);
  await expect(sdk.stealFarmCrop({ ...command, requestId: randomUUID() })).rejects.toMatchObject({
    code: 'NOT_ALLOWED',
  });
  await sdk.stealFarmCrop({ ...command, wateredAt: nextWateredAt, requestId: randomUUID() });
  expect((await sdk.getInventory()).farm.inventory.tomato).toBe(2);
  expect(await ownerSdk.getFarmTheftHistory()).toHaveLength(2);
});
