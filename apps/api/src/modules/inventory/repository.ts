import { type CharacterInventoryState, ensureCharacterInventory, type PlayerDocument } from '@chibi-town/game-service';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '@/infrastructure/database/database';
import {
  characterGrants,
  characterInstances,
  characterInventories,
  characterUnlocks,
} from '@/infrastructure/database/schema';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Caller must already hold the player document row lock, shared with wallet/arcade transactions. */
export async function loadCharacterInventory(tx: Transaction, playerId: string, document: PlayerDocument, now: number) {
  const where = and(eq(characterInventories.playerId, playerId), eq(characterInventories.characterId, 'main'));
  const [saved] = await tx.select().from(characterInventories).where(where);
  if (!saved) {
    delete document.characterInventory;
    ensureCharacterInventory(document, now);
    return undefined;
  }
  const owner = { playerId, characterId: 'main' };
  const [instances, unlocks, grants] = await Promise.all([
    tx
      .select()
      .from(characterInstances)
      .where(and(eq(characterInstances.playerId, playerId), eq(characterInstances.characterId, owner.characterId))),
    tx
      .select()
      .from(characterUnlocks)
      .where(and(eq(characterUnlocks.playerId, playerId), eq(characterUnlocks.characterId, owner.characterId))),
    tx
      .select()
      .from(characterGrants)
      .where(and(eq(characterGrants.playerId, playerId), eq(characterGrants.characterId, owner.characterId))),
  ]);
  document.characterInventory = {
    version: 1,
    characterId: 'main',
    bagSlots: saved.bagSlots,
    instances: Object.fromEntries(instances.map((row) => [row.instanceId, row.data])),
    unlocks: Object.fromEntries(unlocks.map((row) => [row.cosmeticId, row.data])),
    grants: Object.fromEntries(grants.map((row) => [row.grantId, row.data])),
  };
  return structuredClone(document.characterInventory);
}

export async function saveCharacterInventory(
  tx: Transaction,
  playerId: string,
  state: CharacterInventoryState,
  before?: CharacterInventoryState,
) {
  const owner = { playerId, characterId: state.characterId };
  if (!before) await tx.insert(characterInventories).values({ ...owner, bagSlots: state.bagSlots });
  else if (before.bagSlots !== state.bagSlots)
    await tx
      .update(characterInventories)
      .set({ bagSlots: state.bagSlots })
      .where(and(eq(characterInventories.playerId, playerId), eq(characterInventories.characterId, state.characterId)));
  // Remove only changed instances first: swaps must not violate unique bag/equipment positions mid-transaction.
  const changed = Object.values(state.instances).filter(
    (item) => JSON.stringify(item) !== JSON.stringify(before?.instances[item.instanceId]),
  );
  const removed = Object.keys(before?.instances ?? {}).filter((id) => !Object.hasOwn(state.instances, id));
  const replaced = [...changed.map((item) => item.instanceId), ...removed];
  if (replaced.length)
    await tx
      .delete(characterInstances)
      .where(
        and(
          eq(characterInstances.playerId, playerId),
          eq(characterInstances.characterId, state.characterId),
          inArray(characterInstances.instanceId, replaced),
        ),
      );
  if (changed.length)
    await tx.insert(characterInstances).values(
      changed.map((item) => ({
        ...owner,
        instanceId: item.instanceId,
        container: item.location.container,
        bagSlot: item.location.container === 'bag' ? item.location.slot : null,
        equippedSlot: item.location.container === 'equipped' ? item.location.slot : null,
        data: item,
      })),
    );
  const unlocks = Object.values(state.unlocks).filter(
    (item) => !before || !Object.hasOwn(before.unlocks, item.cosmeticId),
  );
  if (unlocks.length)
    await tx
      .insert(characterUnlocks)
      .values(unlocks.map((item) => ({ ...owner, cosmeticId: item.cosmeticId, data: item })));
  const grants = Object.values(state.grants).filter((item) => !before || !Object.hasOwn(before.grants, item.id));
  if (grants.length)
    await tx.insert(characterGrants).values(grants.map((item) => ({ ...owner, grantId: item.id, data: item })));
}
